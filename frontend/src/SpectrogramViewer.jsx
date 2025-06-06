import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import SpectrogramPlugin from 'wavesurfer.js/plugins/spectrogram';

function SpectrogramViewer({ audioUrl }) {
  const waveformRef = useRef();
  const spectrogramRef = useRef();
  const wavesurferRef = useRef(null);

  useEffect(() => {
    if (!waveformRef.current || !spectrogramRef.current) return;

    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'lightgray',
      progressColor: 'blue',
      height: 1, // Must not be zero
      url: audioUrl,
      plugins: [
        SpectrogramPlugin.create({
          container: spectrogramRef.current,
          labels: true,
        }),
      ]
    });

    wavesurferRef.current = wavesurfer;

    return () => wavesurfer.destroy();
  }, [audioUrl]);

  return (
    <div>
      <div
        ref={waveformRef}
        style={{ height: '1px', visibility: 'hidden' }}
      ></div>
      <div
        ref={spectrogramRef}
        style={{ height: '128px', width: '100%' }}
      ></div>
      <p><i>Spectrogram display</i></p>
    </div>
  );
}

export default SpectrogramViewer;
