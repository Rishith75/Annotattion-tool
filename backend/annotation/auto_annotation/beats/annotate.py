import torch
import torchaudio
import json
import os
import sys
import csv

# Append path for BEATs module
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from BEATs import BEATs, BEATsConfig

# Load label map from CSV
def load_label_map():
    label_map = {}
    label_path = os.path.join(os.path.dirname(__file__), "class_labels_indices.csv")  # Removed space
    with open(label_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            label = row.get("display_name") or row.get("name")
            hash = row.get("mid")
            label_map[hash] = label
    return label_map

# Model checkpoint path
CKPT_PATH = os.path.join(os.path.dirname(__file__), 'checkpoint', 'BEATs_iter3_finetuned_on_AS2M_cpt1.pt')

# Load model and config
def load_model():
    checkpoint = torch.load(CKPT_PATH, map_location='cpu')
    cfg = BEATsConfig(checkpoint['cfg'])
    model = BEATs(cfg)
    model.load_state_dict(checkpoint['model'])
    model.eval()
    label_dict = load_label_map()
    model_label_dict = checkpoint['label_dict']
    return model, label_dict, model_label_dict

# Annotate audio file
def annotate(file_path, chunk_duration=0.5, top_k=1):
    waveform, sr = torchaudio.load(file_path)

    if sr != 16000:
        waveform = torchaudio.transforms.Resample(sr, 16000)(waveform)

    waveform = waveform.mean(dim=0).unsqueeze(0)

    model, label_dict, model_label_dict = load_model()

    chunk_size = int(chunk_duration * 16000)
    merged_results = []

    prev_label = None
    prev_start = None
    prev_end = None

    for start_sample in range(0, waveform.size(1), chunk_size):
        end_sample = min(start_sample + chunk_size, waveform.size(1))
        chunk = waveform[:, start_sample:end_sample]

        if chunk.size(1) < chunk_size:
            continue

        with torch.no_grad():
            logits = model.extract_features(chunk)[0]

        probs = logits.squeeze()
        top_val, top_idx = torch.topk(probs, top_k)

        prob = top_val[0].item()
        idx = top_idx[0].item()
        hash = model_label_dict[int(idx)]
        label = label_dict.get(hash, "unknown")

        # Replace low confidence labels with "silence"
        if prob < 0.5:
            label = "silence"

        start_time = round(start_sample / 16000, 2)
        end_time = round(end_sample / 16000, 2)

        # Merge consecutive segments with the same label
        if label == prev_label:
            prev_end = end_time
        else:
            if prev_label is not None:
                merged_results.append({
                    "start_time": prev_start,
                    "end_time": prev_end,
                    "label": prev_label
                })
            prev_label = label
            prev_start = start_time
            prev_end = end_time

    if prev_label is not None:
        merged_results.append({
            "start_time": prev_start,
            "end_time": prev_end,
            "label": prev_label
        })

    return merged_results

# For CLI usage
if __name__ == "__main__":
    audio_path = sys.argv[1]
    results = annotate(audio_path)
    print(json.dumps(results, indent=2))
