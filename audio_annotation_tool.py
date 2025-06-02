import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import numpy as np
import librosa
import soundfile as sf
import pygame
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
import threading
import time
import json
import os

class AudioAnnotationTool:
    def __init__(self, root):
        self.root = root
        self.root.title("Audio Annotation Tool")
        self.root.geometry("1200x800")
        
        # Audio data
        self.audio_data = None
        self.sample_rate = None
        self.duration = 0
        self.current_file = None
        
        # Selection data
        self.start_selection = None
        self.end_selection = None
        self.selecting = False
        
        # Annotations
        self.annotations = []  # List of dicts: {'start': float, 'end': float, 'label': str, 'color': str}
        self.label_colors = {'red': '#FF6B6B', 'green': '#4ECDC4', 'blue': '#45B7D1'}
        self.current_label = 'red'
        
        # Playback
        pygame.mixer.init()
        self.is_playing = False
        self.play_thread = None
        
        self.setup_ui()
        
    def setup_ui(self):
        # Main frame
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Control frame
        control_frame = ttk.Frame(main_frame)
        control_frame.pack(fill=tk.X, pady=(0, 10))
        
        # File operations
        ttk.Button(control_frame, text="Load Audio", command=self.load_audio).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(control_frame, text="Save Annotations", command=self.save_annotations).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(control_frame, text="Load Annotations", command=self.load_annotations).pack(side=tk.LEFT, padx=(0, 5))
        
        # Separator
        ttk.Separator(control_frame, orient='vertical').pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # Playback controls
        ttk.Button(control_frame, text="Play All", command=self.play_audio).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(control_frame, text="Play Selection", command=self.play_selection).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(control_frame, text="Stop", command=self.stop_audio).pack(side=tk.LEFT, padx=(0, 5))
        
        # Separator
        ttk.Separator(control_frame, orient='vertical').pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # Label selection
        ttk.Label(control_frame, text="Label:").pack(side=tk.LEFT, padx=(0, 5))
        self.label_var = tk.StringVar(value='red')
        label_combo = ttk.Combobox(control_frame, textvariable=self.label_var, 
                                  values=['red', 'green', 'blue'], state='readonly', width=8)
        label_combo.pack(side=tk.LEFT, padx=(0, 5))
        label_combo.bind('<<ComboboxSelected>>', self.on_label_change)
        
        ttk.Button(control_frame, text="Add Annotation", command=self.add_annotation).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(control_frame, text="Clear All", command=self.clear_annotations).pack(side=tk.LEFT, padx=(0, 5))
        
        # Waveform frame
        waveform_frame = ttk.Frame(main_frame)
        waveform_frame.pack(fill=tk.BOTH, expand=True)
        
        # Create matplotlib figure
        self.fig = Figure(figsize=(12, 6), dpi=100)
        self.ax = self.fig.add_subplot(111)
        self.canvas = FigureCanvasTkAgg(self.fig, waveform_frame)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
        # Bind mouse events
        self.canvas.mpl_connect('button_press_event', self.on_mouse_press)
        self.canvas.mpl_connect('button_release_event', self.on_mouse_release)
        self.canvas.mpl_connect('motion_notify_event', self.on_mouse_motion)
        
        # Annotations list frame
        annotations_frame = ttk.Frame(main_frame)
        annotations_frame.pack(fill=tk.X, pady=(10, 0))
        
        ttk.Label(annotations_frame, text="Annotations:").pack(anchor=tk.W)
        
        # Create treeview for annotations
        self.annotations_tree = ttk.Treeview(annotations_frame, columns=('Start', 'End', 'Duration', 'Label'), show='headings', height=6)
        self.annotations_tree.heading('Start', text='Start (s)')
        self.annotations_tree.heading('End', text='End (s)')
        self.annotations_tree.heading('Duration', text='Duration (s)')
        self.annotations_tree.heading('Label', text='Label')
        
        self.annotations_tree.column('Start', width=100)
        self.annotations_tree.column('End', width=100)
        self.annotations_tree.column('Duration', width=100)
        self.annotations_tree.column('Label', width=100)
        
        # Scrollbar for treeview
        scrollbar = ttk.Scrollbar(annotations_frame, orient=tk.VERTICAL, command=self.annotations_tree.yview)
        self.annotations_tree.configure(yscrollcommand=scrollbar.set)
        
        self.annotations_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Bind double-click to delete annotation
        self.annotations_tree.bind('<Double-1>', self.delete_annotation)
        
        # Status bar
        self.status_var = tk.StringVar(value="Load an audio file to start")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief=tk.SUNKEN)
        status_bar.pack(fill=tk.X, pady=(10, 0))
        
    def load_audio(self):
        file_path = filedialog.askopenfilename(
            title="Select Audio File",
            filetypes=[("Audio files", "*.wav *.mp3 *.flac *.m4a *.ogg"), ("All files", "*.*")]
        )
        
        if file_path:
            try:
                self.audio_data, self.sample_rate = librosa.load(file_path, sr=None)
                self.duration = len(self.audio_data) / self.sample_rate
                self.current_file = file_path
                
                self.plot_waveform()
                self.status_var.set(f"Loaded: {os.path.basename(file_path)} | Duration: {self.duration:.2f}s | Sample Rate: {self.sample_rate}Hz")
                
                # Clear previous annotations
                self.annotations = []
                self.update_annotations_list()
                
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load audio file:\n{str(e)}")
    
    def plot_waveform(self):
        if self.audio_data is None:
            return
            
        self.ax.clear()
        
        # Create time axis
        time_axis = np.linspace(0, self.duration, len(self.audio_data))
        
        # Plot waveform
        self.ax.plot(time_axis, self.audio_data, color='black', alpha=0.7, linewidth=0.5)
        self.ax.set_xlabel('Time (seconds)')
        self.ax.set_ylabel('Amplitude')
        self.ax.set_title('Audio Waveform')
        self.ax.grid(True, alpha=0.3)
        
        # Plot annotations
        for ann in self.annotations:
            color = self.label_colors[ann['label']]
            self.ax.axvspan(ann['start'], ann['end'], alpha=0.3, color=color, label=ann['label'])
            
        # Plot current selection
        if self.start_selection is not None and self.end_selection is not None:
            self.ax.axvspan(self.start_selection, self.end_selection, alpha=0.5, color='yellow', linestyle='--')
        
        self.canvas.draw()
    
    def on_mouse_press(self, event):
        if event.inaxes != self.ax or self.audio_data is None:
            return
            
        self.selecting = True
        self.start_selection = event.xdata
        self.end_selection = event.xdata
        
    def on_mouse_motion(self, event):
        if not self.selecting or event.inaxes != self.ax or self.audio_data is None:
            return
            
        self.end_selection = event.xdata
        self.plot_waveform()
        
    def on_mouse_release(self, event):
        if not self.selecting or event.inaxes != self.ax or self.audio_data is None:
            return
            
        self.selecting = False
        if self.start_selection is not None and self.end_selection is not None:
            # Ensure start < end
            if self.start_selection > self.end_selection:
                self.start_selection, self.end_selection = self.end_selection, self.start_selection
            
            # Clamp to audio bounds
            self.start_selection = max(0, self.start_selection)
            self.end_selection = min(self.duration, self.end_selection)
            
            self.plot_waveform()
            
            # Update status
            duration = self.end_selection - self.start_selection
            self.status_var.set(f"Selection: {self.start_selection:.2f}s - {self.end_selection:.2f}s (Duration: {duration:.2f}s)")
    
    def on_label_change(self, event):
        self.current_label = self.label_var.get()
    
    def add_annotation(self):
        if self.start_selection is None or self.end_selection is None:
            messagebox.showwarning("Warning", "Please select a region first")
            return
            
        if abs(self.end_selection - self.start_selection) < 0.01:
            messagebox.showwarning("Warning", "Selection too small")
            return
        
        # Check for overlaps
        for ann in self.annotations:
            if not (self.end_selection <= ann['start'] or self.start_selection >= ann['end']):
                messagebox.showwarning("Warning", "Selection overlaps with existing annotation")
                return
        
        annotation = {
            'start': self.start_selection,
            'end': self.end_selection,
            'label': self.current_label,
            'color': self.label_colors[self.current_label]
        }
        
        self.annotations.append(annotation)
        self.annotations.sort(key=lambda x: x['start'])  # Sort by start time
        
        self.update_annotations_list()
        self.plot_waveform()
        
        # Clear selection
        self.start_selection = None
        self.end_selection = None
        
        self.status_var.set(f"Added {self.current_label} annotation")
    
    def update_annotations_list(self):
        # Clear existing items
        for item in self.annotations_tree.get_children():
            self.annotations_tree.delete(item)
        
        # Add annotations
        for i, ann in enumerate(self.annotations):
            duration = ann['end'] - ann['start']
            self.annotations_tree.insert('', 'end', values=(
                f"{ann['start']:.2f}",
                f"{ann['end']:.2f}",
                f"{duration:.2f}",
                ann['label']
            ))
    
    def delete_annotation(self, event):
        selection = self.annotations_tree.selection()
        if selection:
            item = selection[0]
            index = self.annotations_tree.index(item)
            
            if 0 <= index < len(self.annotations):
                del self.annotations[index]
                self.update_annotations_list()
                self.plot_waveform()
                self.status_var.set("Annotation deleted")
    
    def clear_annotations(self):
        if self.annotations:
            if messagebox.askyesno("Confirm", "Clear all annotations?"):
                self.annotations = []
                self.update_annotations_list()
                self.plot_waveform()
                self.status_var.set("All annotations cleared")
    
    def play_audio(self):
        if self.audio_data is None:
            return
            
        self.stop_audio()
        
        # Save audio to temporary file
        temp_file = "temp_audio.wav"
        sf.write(temp_file, self.audio_data, self.sample_rate)
        
        def play_thread():
            try:
                pygame.mixer.music.load(temp_file)
                pygame.mixer.music.play()
                self.is_playing = True
                
                while pygame.mixer.music.get_busy() and self.is_playing:
                    time.sleep(0.1)
                    
            except Exception as e:
                print(f"Playback error: {e}")
            finally:
                self.is_playing = False
                try:
                    os.remove(temp_file)
                except:
                    pass
        
        self.play_thread = threading.Thread(target=play_thread)
        self.play_thread.daemon = True
        self.play_thread.start()
        
        self.status_var.set("Playing audio...")
    
    def play_selection(self):
        if self.audio_data is None or self.start_selection is None or self.end_selection is None:
            messagebox.showwarning("Warning", "No selection to play")
            return
            
        self.stop_audio()
        
        # Extract selected portion
        start_sample = int(self.start_selection * self.sample_rate)
        end_sample = int(self.end_selection * self.sample_rate)
        selected_audio = self.audio_data[start_sample:end_sample]
        
        # Save to temporary file
        temp_file = "temp_selection.wav"
        sf.write(temp_file, selected_audio, self.sample_rate)
        
        def play_thread():
            try:
                pygame.mixer.music.load(temp_file)
                pygame.mixer.music.play()
                self.is_playing = True
                
                while pygame.mixer.music.get_busy() and self.is_playing:
                    time.sleep(0.1)
                    
            except Exception as e:
                print(f"Playback error: {e}")
            finally:
                self.is_playing = False
                try:
                    os.remove(temp_file)
                except:
                    pass
        
        self.play_thread = threading.Thread(target=play_thread)
        self.play_thread.daemon = True
        self.play_thread.start()
        
        duration = self.end_selection - self.start_selection
        self.status_var.set(f"Playing selection ({duration:.2f}s)...")
    
    def stop_audio(self):
        self.is_playing = False
        pygame.mixer.music.stop()
    
    def save_annotations(self):
        if not self.annotations:
            messagebox.showwarning("Warning", "No annotations to save")
            return
            
        file_path = filedialog.asksaveasfilename(
            title="Save Annotations",
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        
        if file_path:
            try:
                data = {
                    'audio_file': self.current_file,
                    'sample_rate': self.sample_rate,
                    'duration': self.duration,
                    'annotations': self.annotations
                }
                
                with open(file_path, 'w') as f:
                    json.dump(data, f, indent=2)
                    
                self.status_var.set(f"Annotations saved to {os.path.basename(file_path)}")
                
            except Exception as e:
                messagebox.showerror("Error", f"Failed to save annotations:\n{str(e)}")
    
    def load_annotations(self):
        file_path = filedialog.askopenfilename(
            title="Load Annotations",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        
        if file_path:
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                
                self.annotations = data.get('annotations', [])
                self.update_annotations_list()
                
                if self.audio_data is not None:
                    self.plot_waveform()
                
                self.status_var.set(f"Loaded {len(self.annotations)} annotations from {os.path.basename(file_path)}")
                
            except Exception as e:
                messagebox.showerror("Error", f"Failed to load annotations:\n{str(e)}")

if __name__ == "__main__":
    root = tk.Tk()
    app = AudioAnnotationTool(root)
    root.mainloop()