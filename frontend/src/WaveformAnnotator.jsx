import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';

const WaveformAnnotator = ({ audioUrl, labels, attributes, taskId, onSaveAnnotation, existingAnnotations }) => {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [regionData, setRegionData] = useState({ labelId: '', attributeValues: {} });

  useEffect(() => {
    if (!audioUrl || !waveformRef.current) return;

    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy();
      } catch (e) {
        console.warn('WaveSurfer destroy failed:', e);
      }
    }

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#ccc',
      progressColor: '#4f46e5',
      height: 100,
      responsive: true,
      plugins: [
        RegionsPlugin.create({
          dragSelection: {
            slop: 5,
            color: 'rgba(79, 70, 229, 0.3)',
          }
        })
      ]
    });

    wavesurferRef.current = ws;
    ws.load(audioUrl);

    // Allow drag to create region from any point (like Audino)
    ws.on('region-created', (region) => {
      setSelectedRegionId(region.id);
      setRegionData({ labelId: '', attributeValues: {} });
    });

    ws.on('region-click', (region, e) => {
      e.stopPropagation();
      setSelectedRegionId(region.id);
      const annotation = existingAnnotations?.find(a => a.region_id === region.id);
      setRegionData({
        labelId: annotation?.label_id || '',
        attributeValues: annotation?.attribute_values || {}
      });
    });

    ws.on('ready', () => {
      existingAnnotations?.forEach((a) => {
        ws.addRegion({
          id: a.region_id,
          start: a.start_time,
          end: a.end_time,
          color: 'rgba(79, 70, 229, 0.3)',
        });
      });
    });

    return () => {
      try {
        ws.destroy();
      } catch (err) {
        console.warn('WaveSurfer destroy error on unmount:', err);
      }
    };
  }, [audioUrl]);

  const handleLabelChange = (e) => {
    const labelId = e.target.value;
    setRegionData({ labelId, attributeValues: {} });
  };

  const handleAttributeChange = (attributeId, value) => {
    setRegionData((prev) => ({
      ...prev,
      attributeValues: {
        ...prev.attributeValues,
        [attributeId]: value,
      },
    }));
  };

  const handleSave = () => {
    const region = wavesurferRef.current.regions.list[selectedRegionId];
    if (!region || !regionData.labelId) return;
    onSaveAnnotation({
      region_id: region.id,
      start_time: region.start,
      end_time: region.end,
      label_id: regionData.labelId,
      attribute_values: regionData.attributeValues,
    });
    setSelectedRegionId(null);
    setRegionData({ labelId: '', attributeValues: {} });
  };

  return (
    <div>
      <div ref={waveformRef} className="mb-3" />

      {selectedRegionId && (
        <div className="border p-3 rounded shadow-sm bg-light">
          <h6>Annotate Region</h6>

          <label className="form-label">Label</label>
          <select className="form-select mb-2" value={regionData.labelId} onChange={handleLabelChange}>
            <option value="">-- Select Label --</option>
            {labels?.map((label) => (
              <option key={label.id} value={label.id}>{label.name}</option>
            ))}
          </select>

          {regionData.labelId && attributes?.[regionData.labelId]?.map((attr) => (
            <div key={attr.id} className="mb-2">
              <label className="form-label">{attr.name}</label>
              <select
                className="form-select"
                value={regionData.attributeValues[attr.id] || ''}
                onChange={(e) => handleAttributeChange(attr.id, e.target.value)}
              >
                <option value="">-- Select --</option>
                {attr.values.map((val, idx) => (
                  <option key={idx} value={val}>{val}</option>
                ))}
              </select>
            </div>
          ))}

          <button className="btn btn-primary mt-2" onClick={handleSave}>Save Annotation</button>
        </div>
      )}
    </div>
  );
};

export default WaveformAnnotator;
