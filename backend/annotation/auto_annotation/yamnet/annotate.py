import os
import sys
import numpy as np
import tensorflow as tf
import librosa
import csv
import json

# Add src to path to import yamnet modules
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
import yamnet as yamnet_model
import params as yamnet_params
import features as features_lib

# Load class names from CSV
def load_class_map():
    class_map_path = os.path.join(os.path.dirname(__file__), 'yamnet_class_map.csv')
    class_names = []
    with open(class_map_path, 'r') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        for row in reader:
            class_names.append(row[2])  # display_name
    return class_names

# Load YAMNet model
def load_yamnet_model():
    params = yamnet_params.Params()
    model = yamnet_model.yamnet_frames_model(params)
    checkpoint_path = os.path.join(os.path.dirname(__file__), 'checkpoint', 'yamnet.h5')
    model.load_weights(checkpoint_path)
    class_names = load_class_map()
    return model, class_names, params

# Check if chunk is silent
def is_silent(chunk, threshold=0.01):
    return np.mean(np.abs(chunk)) < threshold

import numpy as np
from scipy.ndimage import uniform_filter1d



def db_to_power(db):
    """Convert dB to linear power ratio (peak power)."""
    return 10 ** (db / 10)

def getAudacityStyleNonSilence(
    data,
    sample_rate=16000,
    frame_duration_ms=10,
    db_threshold=-18.0,
    threshold_measurement="peak",  # Only 'peak' implemented
    min_silence_sec=0.01,
    min_label_interval_sec=0.02,
    min_non_silence_sec=0.1,          # <-- New!
    max_leading_silence=0.0,
    max_trailing_silence=0.0
):
    """
    Mimics Audacity's 'Label Sounds' tool with added min_non_silence_sec filtering.
    Returns (start_sample, end_sample) tuples.
    """
    frame_len = int(sample_rate * frame_duration_ms / 1000)
    num_frames = len(data) // frame_len

    # Compute per-frame power
    if threshold_measurement == "peak":
        frame_powers = np.array([
            np.max(np.abs(data[i*frame_len:(i+1)*frame_len]))**2
            for i in range(num_frames)
        ])
    else:
        raise NotImplementedError("Only 'peak' thresholding is implemented")

    power_threshold = db_to_power(db_threshold)

    is_loud = frame_powers > power_threshold

    # Frame-based thresholds
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

    # Handle segment at the end
    if in_segment:
        seg_end = min(num_frames - 1, num_frames - 1 + trail_frames)
        num_frames_in_segment = seg_end - seg_start + 1
        if (num_frames_in_segment >= min_label_interval_frames and
            num_frames_in_segment >= min_non_silence_frames):
            segments.append((seg_start * frame_len, (seg_end + 1) * frame_len))

    return segments

        

# Annotate audio with YAMNet
def annotate(file_path, chunk_duration=0.5, top_k=1, energy_threshold=0.01):
    waveform, sr = librosa.load(file_path, sr=16000, mono=True)
    waveform = waveform.astype(np.float32)

    model, class_names, params = load_yamnet_model()
    merged_results = []

    prev_label = None
    prev_start = None
    prev_end = None

    for start_sample,end_sample in getAudacityStyleNonSilence(waveform):#librosa.effects.split(waveform,top_db=52, frame_length=400, hop_length=200):#getNonSilence(waveform):
        chunk = waveform[start_sample:end_sample]

        if False:
            label = "Silence"
            confidence = 0.0
        else:
            chunk_tensor = tf.convert_to_tensor(chunk, dtype=tf.float32)
            padded = features_lib.pad_waveform(chunk_tensor, params)
            _, log_mel_patches = features_lib.waveform_to_log_mel_spectrogram_patches(padded, params)

            predictions, _ = model.predict(log_mel_patches, verbose=0)
            mean_scores = np.mean(predictions, axis=0)
            top_indices = np.argsort(mean_scores)[::-1][:top_k]

            idx = top_indices[0]
            confidence = float(mean_scores[idx])
            label = class_names[idx] 

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

    audio_path = sys.argv[1]
    annotations = annotate(audio_path)
    print(json.dumps(annotations, indent=2))
