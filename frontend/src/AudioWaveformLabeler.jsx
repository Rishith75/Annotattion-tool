import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Upload, Tag } from 'lucide-react';

const AudioWaveformLabeler = () => {
  const [audioFile, setAudioFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [regions, setRegions] = useState({});
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [currentLabel, setCurrentLabel] = useState('');
  const [editingRegionId, setEditingRegionId] = useState(null);
 
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const regionsPlugin = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Initialize WaveSurfer when component mounts
    const initWaveSurfer = async () => {
      // Dynamically import WaveSurfer
      const WaveSurfer = (await import('https://cdnjs.cloudflare.com/ajax/libs/wavesurfer.js/7.7.0/wavesurfer.esm.min.js')).default;
      const RegionsPlugin = (await import('https://cdnjs.cloudflare.com/ajax/libs/wavesurfer.js/7.7.0/plugins/regions.esm.min.js')).default;
     
      if (waveformRef.current) {
        // Create regions plugin
        regionsPlugin.current = RegionsPlugin.create();
       
        // Initialize WaveSurfer
        wavesurfer.current = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#4f46e5',
          progressColor: '#7c3aed',
          cursorColor: '#ef4444',
          barWidth: 2,
          barRadius: 3,
          responsive: true,
          height: 200,
          plugins: [regionsPlugin.current]
        });

        // Event listeners
        wavesurfer.current.on('play', () => setIsPlaying(true));
        wavesurfer.current.on('pause', () => setIsPlaying(false));
        wavesurfer.current.on('finish', () => setIsPlaying(false));

        // Region events
        regionsPlugin.current.on('region-created', (region) => {
          handleRegionClick(region);
        });

        regionsPlugin.current.on('region-clicked', (region) => {
          setSelectedRegion(region);
          handleRegionClick(region);
        });

        // Enable region creation on click and drag
        regionsPlugin.current.enableDragSelection({
          color: 'rgba(99, 102, 241, 0.3)'
        });
      }
    };

    initWaveSurfer();

    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
    };
  }, []);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
     
      if (wavesurfer.current) {
        wavesurfer.current.load(url);
      }
     
      // Clear previous regions
      setRegions({});
      setSelectedRegion(null);
    }
  };

  const handleRegionClick = (region) => {
    const regionId = region.id;
   
    if (regions[regionId]) {
      // Region already has a label, show it
      setCurrentLabel(regions[regionId]);
      setEditingRegionId(regionId);
      setShowLabelModal(true);
    } else {
      // New region, ask for label
      setCurrentLabel('');
      setEditingRegionId(regionId);
      setShowLabelModal(true);
    }
  };

  const handleLabelSave = () => {
    if (editingRegionId && currentLabel.trim()) {
      setRegions(prev => ({
        ...prev,
        [editingRegionId]: currentLabel.trim()
      }));
     
      // Update region color to indicate it's labeled
      const region = regionsPlugin.current.getRegions().find(r => r.id === editingRegionId);
      if (region) {
        region.setOptions({
          color: 'rgba(34, 197, 94, 0.3)',
          borderColor: '#22c55e'
        });
      }
    }
   
    setShowLabelModal(false);
    setCurrentLabel('');
    setEditingRegionId(null);
  };

  const handlePlay = () => {
    if (!wavesurfer.current) return;

    if (selectedRegion) {
      // Play selected region
      wavesurfer.current.setTime(selectedRegion.start);
      wavesurfer.current.play();
     
      // Stop at region end
      const stopTime = selectedRegion.end;
      const checkTime = () => {
        if (wavesurfer.current.getCurrentTime() >= stopTime) {
          wavesurfer.current.pause();
        } else if (isPlaying) {
          requestAnimationFrame(checkTime);
        }
      };
      requestAnimationFrame(checkTime);
    } else {
      // Play entire audio
      if (isPlaying) {
        wavesurfer.current.pause();
      } else {
        wavesurfer.current.play();
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            Audio Waveform Labeler
          </h1>

          {/* File Upload */}
          <div className="mb-8">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="audio/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed border-indigo-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
            >
              <Upload className="w-6 h-6 text-indigo-500" />
              <span className="text-lg text-gray-700">
                {audioFile ? audioFile.name : 'Select Audio File'}
              </span>
            </button>
          </div>

          {/* Waveform Container */}
          <div className="mb-6">
            <div
              ref={waveformRef}
              className="border rounded-lg bg-gray-50"
              style={{ minHeight: '200px' }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={handlePlay}
              disabled={!audioFile}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              {selectedRegion ? 'Play Region' : 'Play Audio'}
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">Instructions:</h3>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Upload an audio file to see the waveform</li>
              <li>• Click and drag on the waveform to create regions</li>
              <li>• Click on a region to label it or edit existing labels</li>
              <li>• Select a region and click "Play Region" to play only that part</li>
              <li>• Green regions are labeled, blue regions are unlabeled</li>
            </ul>
          </div>

          {/* Region Info */}
          {selectedRegion && (
            <div className="bg-gray-50 border rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">Selected Region:</h3>
              <div className="text-sm text-gray-600">
                <p>Start: {formatTime(selectedRegion.start)}</p>
                <p>End: {formatTime(selectedRegion.end)}</p>
                <p>Duration: {formatTime(selectedRegion.end - selectedRegion.start)}</p>
                {regions[selectedRegion.id] && (
                  <p className="mt-2">
                    <span className="font-medium">Label:</span> {regions[selectedRegion.id]}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Region Labels List */}
          {Object.keys(regions).length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Labeled Regions
              </h3>
              <div className="space-y-2">
                {Object.entries(regions).map(([regionId, label]) => {
                  const region = regionsPlugin.current?.getRegions().find(r => r.id === regionId);
                  return (
                    <div key={regionId} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-green-700">{label}</span>
                      {region && (
                        <span className="text-green-600">
                          {formatTime(region.start)} - {formatTime(region.end)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Label Modal */}
      {showLabelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {regions[editingRegionId] ? 'Edit Label' : 'Add Label'}
            </h3>
            <input
              type="text"
              value={currentLabel}
              onChange={(e) => setCurrentLabel(e.target.value)}
              placeholder="Enter label for this region..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleLabelSave();
                }
              }}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowLabelModal(false);
                  setCurrentLabel('');
                  setEditingRegionId(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLabelSave}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioWaveformLabeler;