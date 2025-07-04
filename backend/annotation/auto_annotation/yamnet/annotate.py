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

# Annotate audio with YAMNet
def annotate(file_path, chunk_duration=0.5, top_k=1):
    waveform, sr = librosa.load(file_path, sr=16000, mono=True)
    waveform = waveform.astype(np.float32)

    model, class_names, params = load_yamnet_model()
    chunk_size = int(chunk_duration * 16000)

    merged_results = []

    prev_label = None
    prev_start = None
    prev_end = None

    for start_sample in range(0, len(waveform), chunk_size):
        end_sample = min(start_sample + chunk_size, len(waveform))
        chunk = waveform[start_sample:end_sample]

        if len(chunk) < chunk_size:
            continue

        chunk_tensor = tf.convert_to_tensor(chunk, dtype=tf.float32)
        padded = features_lib.pad_waveform(chunk_tensor, params)
        _, log_mel_patches = features_lib.waveform_to_log_mel_spectrogram_patches(padded, params)

        predictions, _ = model.predict(log_mel_patches, verbose=0)
        mean_scores = np.mean(predictions, axis=0)
        top_indices = np.argsort(mean_scores)[::-1][:top_k]

        idx = top_indices[0]
        confidence = float(mean_scores[idx])
        label = class_names[idx] if confidence >= 0.5 else "silence"

        start_time = round(start_sample / 16000, 2)
        end_time = round(end_sample / 16000, 2)

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

# CLI usage
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python annotate.py <audio_file>")
        sys.exit(1)

    audio_path = sys.argv[1]
    annotations = annotate(audio_path)
    print(json.dumps(annotations, indent=2))
