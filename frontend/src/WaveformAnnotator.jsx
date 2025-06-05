import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import SpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram';
import RegionPlugin from 'wavesurfer.js/dist/plugins/regions';

function WaveformAnnotator({ audioUrl, initialAnnotations = [], onAnnotationsChange }) {
  const containerRef = useRef();
  const spectrogramRef = useRef();
  const wavesurferRef = useRef(null);
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'gray',
      progressColor: 'purple',
      height: 100,
      url: audioUrl,
      plugins: [
        RegionPlugin.create({ drag: true, resize: true }),
        SpectrogramPlugin.create({
          container: spectrogramRef.current,
          labels: true,
        })
      ]
    });

    wavesurfer.on('ready', () => {
      // Load initial annotations
      initialAnnotations.forEach(ann => {
        wavesurfer.addRegion({
          start: ann.start_time,
          end: ann.end_time,
          data: { label_id: ann.label_id },
          color: 'rgba(255, 0, 0, 0.3)'
        });
      });
    });

    const updateRegions = () => {
      const updatedRegions = Object.values(wavesurfer.regions.list).map(r => ({
        start_time: r.start,
        end_time: r.end,
        label_id: r.data.label_id || null,  // default null if not set
        attributes: r.data.attributes || [],  // for future use
      }));
      setRegions(updatedRegions);
      onAnnotationsChange(updatedRegions);
    };

    wavesurfer.on('region-created', updateRegions);
    wavesurfer.on('region-updated', updateRegions);
    wavesurfer.on('region-removed', updateRegions);

    wavesurferRef.current = wavesurfer;

    return () => wavesurfer.destroy();
  }, [audioUrl]);

  return (
    <div>
      <div ref={containerRef}></div>
      <div ref={spectrogramRef} style={{ height: '128px' }}></div>
      <p><i>Click and drag on waveform to create annotation regions</i></p>
    </div>
  );
}

export default WaveformAnnotator;
