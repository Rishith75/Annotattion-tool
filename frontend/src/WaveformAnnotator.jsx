import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Trash2 } from 'lucide-react';
import axios from 'axios';
import { API_ROUTES } from './api';
import { Button } from 'react-bootstrap';

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

      wavesurfer.current.on('play',  () => setIsPlaying(true));
      wavesurfer.current.on('pause', () => setIsPlaying(false));
      wavesurfer.current.on('finish',() => setIsPlaying(false));

      // New region: initialize with no annotationId
      regionsPlugin.current.on('region-created', region => {
        setRegions(prev => ({
          ...prev,
          [region.id]: { annotationId: null, label: '', attributes: {} }
        }));
      });

      // Click region: open modal
      regionsPlugin.current.on('region-clicked', region => {
        handleRegionClick(region);
      });

      wavesurfer.current.on('interaction', () => {
        setSelectedRegion(null);
      });

      regionsPlugin.current.enableDragSelection({ color: 'rgba(99, 102, 241, 0.3)' });

      wavesurfer.current.load(audioUrl);
      wavesurfer.current.on('ready', () => setIsAudioReady(true));
    };

    initWaveSurfer();
    return () => { isMounted = false; wavesurfer.current?.destroy(); };
  }, [audioUrl]);

  // Load existing annotations ONCE
  useEffect(() => {
    if (!isAudioReady || !initialAnnotations?.length || Object.keys(regions).length) return;
    const newRegions = {};
    initialAnnotations.forEach(ann => {
      const region = regionsPlugin.current.addRegion({
        start: ann.start_time,
        end: ann.end_time,
        color: 'rgba(34, 197, 94, 0.3)',
        drag: true,
        resize: true,
        data: { annotationId: ann.id },
      });
  
      newRegions[region.id] = {
        annotationId: ann.id,
        label: ann.label_id || '',
        attributes: Array.isArray(ann.attributes)
          ? ann.attributes.reduce((acc, v) => { acc[v.attribute_id] = v.value_id; return acc; }, {})
          : {},
        modelLabel: ann.model_label || null,  // Include modelLabel from the fetched annotation
      };
    });
    setRegions(newRegions);
  }, [isAudioReady, initialAnnotations, regions]);
  

  useEffect(() => {
    if (editingRegionId && regions[editingRegionId]) {
      const rd = regions[editingRegionId];
      setSelectedLabelId(rd.label);
      setSelectedAttributes(rd.attributes);
    }
  }, [editingRegionId, regions]);

  const handleRegionClick = region => {
    const rd = regions[region.id] || { annotationId: null, label: '', attributes: {} };
    setSelectedRegion(region);
    setEditingRegionId(region.id);
    setSelectedLabelId(rd.label);
    setSelectedAttributes(rd.attributes);
    setError('');
    setShowLabelModal(true);
  };

  const handleLabelSave = () => {
    if (!editingRegionId || !selectedLabelId) {
      setError('Label is required.');
      return;
    }
  
    const region = regionsPlugin.current.getRegions().find(r => r.id === editingRegionId);
    region.setOptions({ color: 'rgba(34, 197, 94, 0.3)', borderColor: '#22c55e' });
  
    // Determine if this annotation is model-generated or user-created
    const isModelGenerated = regions[editingRegionId]?.modelLabel ? true : false;
  
    const updated = {
      ...regions,
      [editingRegionId]: {
        annotationId: regions[editingRegionId].annotationId,
        label: selectedLabelId,
        attributes: selectedAttributes,
        modelLabel: regions[editingRegionId]?.modelLabel || null,  // Retain modelLabel if present
        isModelGenerated,  // Add the model-generated flag
      },
    };
  
    setRegions(updated);
    setShowLabelModal(false);
    setEditingRegionId(null);
    setSelectedLabelId('');
    setSelectedAttributes({});
    setError('');
  
    // Prepare output data for backend, including the new flag
    const out = Object.entries(updated).map(([id, val]) => {
      const r = regionsPlugin.current.getRegions().find(x => x.id === id);
      return {
        start_time: r.start,
        end_time: r.end,
        label_id: val.label,
        attributes: Object.entries(val.attributes).map(([a, v]) => ({ attribute_id: +a, value_id: +v })),
        model_label: val.modelLabel,
        is_model_generated: val.isModelGenerated,  // Send the flag
      };
    });
  
    onAnnotationsChange(out);
  };
  

  const handleDelete = async () => {
    if (!editingRegionId) return;
    const rd = regions[editingRegionId];
    if (rd.annotationId) {
      try { await axios.delete(API_ROUTES.deleteAnnotation(rd.annotationId)); }
      catch(e){ console.error(e); }
    }
    const region = regionsPlugin.current.getRegions().find(r=>r.id===editingRegionId);
    region.remove();
    const updated = {...regions}; delete updated[editingRegionId];
    setRegions(updated);
    setShowLabelModal(false);
    setEditingRegionId(null);
    const out = Object.entries(updated).map(([id,val])=>{
      const r=regionsPlugin.current.getRegions().find(x=>x.id===id);
      return { start_time:r.start,end_time:r.end,label_id:val.label,attributes:Object.entries(val.attributes).map(([a,v])=>({attribute_id:+a,value_id:+v})) };
    });
    onAnnotationsChange(out);
  };

  const handlePlayAudio = () => {
    if (!wavesurfer.current) return;
    wavesurfer.current.isPlaying() ? wavesurfer.current.pause() : wavesurfer.current.play();
  };

  const handlePlayRegion = () => {
    if (!wavesurfer.current || !selectedRegion) return;
    const { start, end } = selectedRegion;
    wavesurfer.current.setTime(start);
    wavesurfer.current.play();
    const stopper = () => {
      if (wavesurfer.current.getCurrentTime() >= end) {
        wavesurfer.current.pause();
        wavesurfer.current.un('audioprocess', stopper);
      }
    };
    wavesurfer.current.on('audioprocess', stopper);
  };

  return (
    <div className="w-full">
      <div ref={waveformRef} className="w-full h-40 bg-gray-100 rounded-lg mb-4" />
      
      <div className="flex justify-center mb-4 gap-4">
      <Button variant="success" onClick={handlePlayAudio} className="d-flex align-items-center gap-2">
  {isPlaying ? <Pause size={16}/> : <Play size={16}/>} Play Audio
</Button>


        {selectedRegion && (
          <button
            onClick={handlePlayRegion}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
          >
            <Play size={16}/> Play Region
          </button>
        )}
      </div>

      {showLabelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-md w-96">
            <h3 className="text-lg font-bold mb-2">{
              regions[editingRegionId] ? 'Edit Annotation' : 'Add Annotation'
            }</h3>

            <label className="block text-sm font-medium mb-1">Label *</label>
            <select
              value={selectedLabelId}
              onChange={e=>{setSelectedLabelId(+e.target.value);setSelectedAttributes({});}}
              className="w-full border px-3 py-2 rounded mb-2"
            >
              <option value="">Select a label</option>
              {labels.map(l=>(
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>

            {regions[editingRegionId]?.modelLabel && (
              <div className="text-sm text-muted mb-2">
                Model Label Suggestion:{' '}
                <strong>{regions[editingRegionId].modelLabel}</strong>
              </div>
            )}


            {selectedLabelId && labels.find(l=>l.id===selectedLabelId).attributes.map(attr=>(
              <div key={attr.id} className="mb-3">
                <label className="block text-sm font-medium mb-1">{attr.name}</label>
                <select
                  value={selectedAttributes[attr.id]||''}
                  onChange={e=>setSelectedAttributes(prev=>({...prev,[attr.id]:+e.target.value}))}
                  className="w-full border px-3 py-2 rounded"
                >
                  <option value="">Select a value</option>
                  {attr.values.map(v=>(
                    <option key={v.id} value={v.id}>{v.value}</option>
                  ))}
                </select>
              </div>
            ))}

            {error && <div className="text-red-500 text-sm mb-2">{error}</div>}

            <div className="d-flex align-items-center gap-2 mt-4">
              <Button variant="danger" onClick={handleDelete} className="d-flex align-items-center gap-1">
                <Trash2 size={16}/> Delete
              </Button>

              <Button variant="primary" onClick={handleLabelSave}>
                Save Annotation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaveformAnnotator;
