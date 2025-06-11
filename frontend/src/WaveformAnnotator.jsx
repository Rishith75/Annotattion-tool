import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

const WaveformAnnotator = ({ audioUrl, labels, initialAnnotations, onAnnotationsChange }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [regions, setRegions] = useState({});
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [editingRegionId, setEditingRegionId] = useState(null);
  const [selectedLabelId, setSelectedLabelId] = useState('');
  const [selectedAttributes, setSelectedAttributes] = useState({});
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [error, setError] = useState('');
  const [isAudioReady, setIsAudioReady] = useState(false);

  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const regionsPlugin = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const initWaveSurfer = async () => {
      const WaveSurfer = (await import('wavesurfer.js')).default;
      const RegionsPlugin = (await import('wavesurfer.js/dist/plugins/regions.esm.js')).default;

      if (!isMounted) return;

      regionsPlugin.current = RegionsPlugin.create();
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#4f46e5',
        progressColor: '#7c3aed',
        cursorColor: '#ef4444',
        barWidth: 2,
        barRadius: 3,
        responsive: true,
        height: 200,
        plugins: [regionsPlugin.current],
      });

      wavesurfer.current.on('play', () => setIsPlaying(true));
      wavesurfer.current.on('pause', () => setIsPlaying(false));
      wavesurfer.current.on('finish', () => setIsPlaying(false));

      regionsPlugin.current.on('region-created', handleRegionClick);
      regionsPlugin.current.on('region-clicked', (region) => {
        setSelectedRegion(region);
        handleRegionClick(region);
      });

      regionsPlugin.current.enableDragSelection({ color: 'rgba(99, 102, 241, 0.3)' });

      wavesurfer.current.load(audioUrl);
      wavesurfer.current.on('ready', () => setIsAudioReady(true));
    };

    initWaveSurfer();

    return () => {
      isMounted = false;
      wavesurfer.current?.destroy();
      wavesurfer.current = null;
    };
  }, [audioUrl]);

  // ✅ Load annotations when audio is ready and annotations arrive
  useEffect(() => {
    if (isAudioReady && initialAnnotations?.length > 0 && regionsPlugin.current) {
      const newRegions = {};

      initialAnnotations.forEach((ann) => {
        const region = regionsPlugin.current.addRegion({
          start: ann.start_time,
          end: ann.end_time,
          color: 'rgba(34, 197, 94, 0.3)',
          drag: true,
          resize: true,
          data: { annotationId: ann.id },
        });

        newRegions[region.id] = {
          label: ann.label_id,
          attributes: Array.isArray(ann.attributes)
            ? ann.attributes.reduce((acc, val) => {
                acc[val.attribute_id] = val.value_id;
                return acc;
              }, {})
            : {},
        };
      });

      setRegions(newRegions);
    }
  }, [isAudioReady, initialAnnotations]);

  useEffect(() => {
    if (editingRegionId && regions[editingRegionId]) {
      setSelectedLabelId(regions[editingRegionId].label || '');
      setSelectedAttributes(regions[editingRegionId].attributes || {});
    }
  }, [editingRegionId]);

  const handleRegionClick = (region) => {
    const existing = regions[region.id];

    setSelectedRegion(region);
    setEditingRegionId(region.id);
    setSelectedLabelId(existing?.label || '');
    setSelectedAttributes(existing?.attributes || {});
    setError('');
    setShowLabelModal(true);
  };

  const handleLabelSave = () => {
    if (!editingRegionId) return;

    if (!selectedLabelId) {
      setError('Label is required.');
      return;
    }

    const region = regionsPlugin.current.getRegions().find((r) => r.id === editingRegionId);
    if (region) {
      region.setOptions({
        color: 'rgba(34, 197, 94, 0.3)',
        borderColor: '#22c55e',
      });
    }

    const updatedRegions = {
      ...regions,
      [editingRegionId]: {
        label: selectedLabelId,
        attributes: selectedAttributes,
      },
    };

    setRegions(updatedRegions);
    setShowLabelModal(false);
    setEditingRegionId(null);
    setSelectedLabelId('');
    setSelectedAttributes({});
    setError('');

    const outputAnnotations = Object.entries(updatedRegions).map(([id, value]) => {
      const r = regionsPlugin.current.getRegions().find((r) => r.id === id);
      return {
        start_time: r.start,
        end_time: r.end,
        label_id: parseInt(value.label),
        attributes: Object.entries(value.attributes).map(([attrId, valId]) => ({
          attribute_id: parseInt(attrId),
          value_id: parseInt(valId),
        })),
      };
    });

    onAnnotationsChange(outputAnnotations);
  };

  const handlePlay = () => {
    if (!wavesurfer.current) return;

    if (selectedRegion) {
      wavesurfer.current.setTime(selectedRegion.start);
      wavesurfer.current.play();

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
      isPlaying ? wavesurfer.current.pause() : wavesurfer.current.play();
    }
  };

  return (
    <div className="w-full">
      <div ref={waveformRef} className="w-full h-40 bg-gray-100 rounded-lg mb-4" />
      <div className="flex justify-center mb-4">
        <button
          onClick={handlePlay}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          {selectedRegion ? ' Play Region' : ' Play Audio'}
        </button>
      </div>

      {showLabelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-md w-96">
            <h3 className="text-lg font-bold mb-2">
              {regions[editingRegionId] ? 'Edit Annotation' : 'Add Annotation'}
            </h3>

            <label className="block text-sm font-medium mb-1">Label *</label>
            <select
              value={selectedLabelId}
              onChange={(e) => {
                const labelId = parseInt(e.target.value);
                setSelectedLabelId(labelId);
                setSelectedAttributes({});
              }}
              className="w-full border px-3 py-2 rounded mb-2"
            >
              <option value="">Select a label</option>
              {labels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </select>

            {selectedLabelId &&
              labels
                .find((l) => l.id === selectedLabelId)
                ?.attributes.map((attr) => (
                  <div key={attr.id} className="mb-3">
                    <label className="block text-sm font-medium mb-1">{attr.name}</label>
                    <select
                      value={selectedAttributes[attr.id] || ''}
                      onChange={(e) => {
                        const valId = e.target.value;
                        const attrId = attr.id;

                        setSelectedAttributes((prev) => ({
                          ...prev,
                          [attrId]: valId,
                        }));
                      }}
                      className="w-full border px-3 py-2 rounded"
                    >
                      <option value="">Select a value</option>
                      {attr.values.map((val) => (
                        <option key={val.id} value={val.id}>
                          {val.value}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

            {error && <div className="text-red-500 text-sm mb-2">{error}</div>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowLabelModal(false);
                  setEditingRegionId(null);
                  setSelectedAttributes({});
                  setError('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleLabelSave}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
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

export default WaveformAnnotator;
