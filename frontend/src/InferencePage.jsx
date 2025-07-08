import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import axios from 'axios';
import { API_ROUTES } from './api';
import { useNavigate } from 'react-router-dom';
import {Navbar,Container,Image,Nav } from 'react-bootstrap';

const featureOptions = [
  { value: 'rms', label: 'RMS' },
  { value: 'spectral_rolloff', label: 'Spectral Roll-off' },
  { value: 'spectral_bandwidth', label: 'Spectral Bandwidth' },
  { value: 'spectral_flatness', label: 'Spectral Flatness' },
  { value: 'custom', label: 'Custom' },
];

const LABEL_COLORS = ['red', 'blue', 'green', 'violet'];

const InferencePage = () => {
  const [xFeature, setXFeature] = useState('rms');
  const [yFeature, setYFeature] = useState('spectral_rolloff');
  const [xFun, setXFun] = useState('');
  const [yFun, setYFun] = useState('');
  const [customFun, setCustomFun] = useState('');
  const [points, setPoints] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState('');
  const [showCustomFunInput, setShowCustomFunInput] = useState(false);

  const fetchData = async () => {
    try {
      setError('');
      
      // Build request body based on whether custom function is provided
      const requestData = customFun 
        ? { custom_fun: customFun } // Only send custom_fun if provided
        : {
            x_feature: xFeature,
            y_feature: yFeature,
            x_fun: xFun,
            y_fun: yFun
          };
  
      console.log('Request body:', requestData);  // Add this to inspect the request body
      
      const res = await axios.post(API_ROUTES.inference, requestData);
      console.log('Response:', res.data);  // Add this to inspect the response
      setPoints(res.data.filter(p => !p.error));
    } catch (err) {
      setError('Error fetching inference data.');
      console.error(err);
    }
  };
  

  const handleDelete = async () => {
    if (!selectedIds.length) return;
    try {
      await axios.post(API_ROUTES.deleteAnnotationsBulk, {
        annotation_ids: selectedIds,
      });
      setPoints(prev => prev.filter(p => !selectedIds.includes(p.annotation_id)));
      setSelectedIds([]);
    } catch (err) {
      setError('Error deleting annotations.');
      console.error(err);
    }
  };

  const handlePointClick = (e) => {
    const annId = e.points[0].customdata;
    setSelectedIds(prev =>
      prev.includes(annId) ? prev.filter(id => id !== annId) : [...prev, annId]
    );
  };

  // Group points by label
  const groupedPoints = {};
  points.forEach(p => {
    if (!groupedPoints[p.label]) groupedPoints[p.label] = [];
    groupedPoints[p.label].push(p);
  });

  const labelColorMap = {};
  const uniqueLabels = Object.keys(groupedPoints);
  uniqueLabels.forEach((label, index) => {
    labelColorMap[label] = LABEL_COLORS[index % LABEL_COLORS.length];
  });

  const plotData = uniqueLabels.map(label => {
    const pts = groupedPoints[label];
    const color = labelColorMap[label];

    return {
      x: pts.map(p => p.x),
      y: pts.map(p => p.y),
      text: pts.map(p => `ID: ${p.annotation_id}`),
      customdata: pts.map(p => p.annotation_id),
      type: 'scatter',
      mode: 'markers',
      name: label,
      marker: {
        size: 12,
        color: pts.map(p =>
          selectedIds.includes(p.annotation_id) ? 'black' : color
        ),
        line: { width: 2, color: 'white' },
      },
    };
  });

  const handleLogout = () => {
    // Clear authentication data, e.g., remove token from localStorage
    localStorage.removeItem('authToken');
    navigate('/login');  // Redirect to login page
  };
  

  return (
    <>
        {/* Navbar */}
      <Navbar bg="light" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand onClick={() => navigate('/superprojects')} style={{ cursor: 'pointer' }}>
            Annotation Tool
          </Navbar.Brand>
          
          <Nav className="me-auto">
            <Nav.Link onClick={() => navigate('/superprojects')}>Super Projects</Nav.Link>
            <Nav.Link onClick={() => navigate('/projects')}>Projects</Nav.Link>
            <Nav.Link onClick={() => navigate('/tasks')}>Tasks</Nav.Link>
            <Nav.Link onClick={() => navigate('/inference')}>Inference</Nav.Link>
          </Nav>

          <Image
            src="https://cdn-icons-png.flaticon.com/512/847/847969.png"
            roundedCircle
            width={40}
            height={40}
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/profile')}
          />
          <Nav.Link onClick={handleLogout} className="ms-3 text-danger">Logout</Nav.Link>
        </Container>
      </Navbar>
      <Container>
    <div className="container mt-4">
      <h2 className="text-center mb-4">Inference Plot (All Annotations)</h2>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row mb-3">
        <div className="col-md-6">
          <label>X Feature:</label>
          <select className="form-control" value={xFeature} onChange={e => setXFeature(e.target.value)}>
            {featureOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {xFeature === 'custom' && (
            <textarea
              className="form-control mt-2"
              rows={2}
              placeholder="Custom X function"
              value={xFun}
              onChange={e => setXFun(e.target.value)}
            />
          )}
        </div>

        <div className="col-md-6">
          <label>Y Feature:</label>
          <select className="form-control" value={yFeature} onChange={e => setYFeature(e.target.value)}>
            {featureOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {yFeature === 'custom' && (
            <textarea
              className="form-control mt-2"
              rows={2}
              placeholder="Custom Y function"
              value={yFun}
              onChange={e => setYFun(e.target.value)}
            />
          )}
        </div>
      </div>

      <button className="btn btn-primary mb-3" onClick={fetchData}>Generate Plot</button>
      <button
        className="btn btn-danger mb-3 ml-3"
        disabled={!selectedIds.length}
        onClick={handleDelete}
      >
        Delete Selected
      </button>

      {/* Button to show custom function input */}
      <button
        className="btn btn-info mb-3 ml-3"
        onClick={() => setShowCustomFunInput(prev => !prev)}
      >
        {showCustomFunInput ? 'Cancel Custom Function' : 'Add Custom Function'}
      </button>

      {showCustomFunInput && (
        <textarea
          className="form-control mt-2"
          rows={4}
          placeholder="Enter custom function"
          value={customFun}
          onChange={e => setCustomFun(e.target.value)}
        />
      )}

      {points.length > 0 && (
        <Plot
          data={plotData}
          layout={{
            width: '100%',
            height: 600,
            title: 'Inference Scatter Plot (All Annotations)',
            xaxis: {
              title: xFeature,
              titlefont: { size: 14, family: 'Arial, sans-serif', color: '#333' },
              tickfont: { size: 12, family: 'Arial, sans-serif', color: '#666' },
              gridcolor: '#ddd',
            },
            yaxis: {
              title: yFeature,
              titlefont: { size: 14, family: 'Arial, sans-serif', color: '#333' },
              tickfont: { size: 12, family: 'Arial, sans-serif', color: '#666' },
              gridcolor: '#ddd',
            },
            legend: {
              title: { text: 'Labels' },
              font: { size: 12, family: 'Arial, sans-serif', color: '#333' },
              orientation: 'h',
            },
            plot_bgcolor: '#fff',
            paper_bgcolor: '#f9f9f9',
            margin: { t: 50, b: 50, l: 50, r: 50 },
            showlegend: true,
          }}
          onClick={handlePointClick}
        />
      
      )}
    </div>
    </Container>
    </>
  );

};

export default InferencePage;
