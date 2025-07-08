import os
import sys
import csv
import json
import torch
import torchaudio
import numpy as np

# Add src to path for BEATs import
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
from BEATs import BEATs, BEATsConfig


def db_to_power(db):
    return 10 ** (db / 10)


def getAudacityStyleNonSilence(
    data,
    sample_rate=16000,
    frame_duration_ms=10,
    db_threshold=-18.0,
    threshold_measurement="peak",
    min_silence_sec=0.01,
    min_label_interval_sec=0.02,
    min_non_silence_sec=0.1,
    max_leading_silence=0.0,
    max_trailing_silence=0.0
):
    frame_len = int(sample_rate * frame_duration_ms / 1000)
    num_frames = len(data) // frame_len

    if threshold_measurement == "peak":
        frame_powers = np.array([
            np.max(np.abs(data[i * frame_len:(i + 1) * frame_len])) ** 2
            for i in range(num_frames)
        ])
    else:
        raise NotImplementedError("Only 'peak' thresholding is implemented")

    power_threshold = db_to_power(db_threshold)
    is_loud = frame_powers > power_threshold

    min_silence_frames = int(min_silence_sec * sample_rate / frame_len)
    min_label_interval_frames = int(min_label_interval_sec * sample_rate / frame_len)
    min_non_silence_frames = int(min_non_silence_sec * sample_rate / frame_len)
    lead_frames = int(max_leading_silence * sample_rate / frame_len)
    trail_frames = int(max_trailing_silence * sample_rate / frame_len)

    segments = []
    in_segment = False
    seg_start = None
    silence_counter = 0

    for i, loud in enumerate(is_loud):
        if loud:
            if not in_segment:
                in_segment = True
                seg_start = max(0, i - lead_frames)
            silence_counter = 0
        else:
            if in_segment:
                silence_counter += 1
                if silence_counter >= min_silence_frames:
                    seg_end = min(i - silence_counter + trail_frames, num_frames - 1)
                    num_frames_in_segment = seg_end - seg_start + 1
                    if (num_frames_in_segment >= min_label_interval_frames and
                            num_frames_in_segment >= min_non_silence_frames):
                        segments.append((seg_start * frame_len, (seg_end + 1) * frame_len))
                    in_segment = False
                    silence_counter = 0

    if in_segment:
        seg_end = min(num_frames - 1, num_frames - 1 + trail_frames)
        num_frames_in_segment = seg_end - seg_start + 1
        if (num_frames_in_segment >= min_label_interval_frames and
                num_frames_in_segment >= min_non_silence_frames):
            segments.append((seg_start * frame_len, (seg_end + 1) * frame_len))

    return segments


# Load label map from CSV
def load_label_map():
    label_map = {}
    label_path = os.path.join(os.path.dirname(__file__), "class_labels_indices.csv")
    with open(label_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            label = row.get("display_name") or row.get("name")
            hash = row.get("mid")
            label_map[hash] = label
    return label_map


# Load BEATs model and config
def load_model():
    ckpt_path = os.path.join(os.path.dirname(__file__), 'checkpoint', 'BEATs_iter3_finetuned_on_AS2M_cpt1.pt')
    checkpoint = torch.load(ckpt_path, map_location='cpu')
    cfg = BEATsConfig(checkpoint['cfg'])
    model = BEATs(cfg)
    model.load_state_dict(checkpoint['model'])
    model.eval()
    label_dict = load_label_map()
    model_label_dict = checkpoint['label_dict']
    return model, label_dict, model_label_dict


def pad_or_crop(chunk, target_len=40000):
    if chunk.size(-1) > target_len:
        return chunk[..., :target_len]
    elif chunk.size(-1) < target_len:
        pad_amt = target_len - chunk.size(-1)
        return torch.nn.functional.pad(chunk, (0, pad_amt))
    return chunk

def annotate(file_path, top_k=1, energy_threshold=0.01):
    waveform, sr = torchaudio.load(file_path)
    if sr != 16000:
        waveform = torchaudio.transforms.Resample(sr, 16000)(waveform)
    waveform = waveform.mean(dim=0).numpy()  # to numpy for getAudacityStyleNonSilence

    model, label_dict, model_label_dict = load_model()

    merged_results = []

    for start_sample, end_sample in getAudacityStyleNonSilence(waveform):
        segment = waveform[start_sample:end_sample]
        segment_tensor = torch.from_numpy(segment).float().unsqueeze(0)

        padded = pad_or_crop(segment_tensor)

        with torch.no_grad():
            logits = model.extract_features(padded)[0]

        probs = logits.squeeze()
        top_val, top_idx = torch.topk(probs, top_k)

        prob = top_val[0].item()
        idx = top_idx[0].item()

        # Use hashed label
        hash = model_label_dict[int(idx)]
        label = label_dict.get(hash, "unknown")

        start_time = round(start_sample / 16000, 2)
        end_time = round(end_sample / 16000, 2)

        merged_results.append({
            "start_time": start_time,
            "end_time": end_time,
            "label": label
        })

    return merged_results


# CLI usage
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python annotate.py <audio_file>")
        sys.exit(1)

    audio_file = sys.argv[1]
    output = annotate(audio_file)
    print(json.dumps(output, indent=2))
