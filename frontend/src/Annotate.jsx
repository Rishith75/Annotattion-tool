/* Annotate.jsx */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Navbar, Nav, Image, Button, Form } from 'react-bootstrap';
import axios from 'axios';
import { API_ROUTES } from './api';
import WaveformAnnotator from './WaveformAnnotator';

function Annotate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [status, setStatus] = useState('New');

  useEffect(() => {
    console.log("Fetching task with ID:", id);
    axios.get(API_ROUTES.getTask(id))
      .then(res => {
        setTask(res.data);
        setStatus(res.data.status);
  
        // Fetch annotations
        return axios.get(API_ROUTES.getAnnotations(id));
      })
      .then(res => {
        setAnnotations(res.data);
      })
      .catch(err => console.error('Error:', err));
  }, [id]);
  

  const handleSave = () => {
    axios.post(API_ROUTES.saveAnnotations(id), {
      annotations,
      status
    })
      .then(() => navigate('/tasks'))
      .catch(err => console.error('Error saving annotation:', err));
  };
  

  if (!task) return <div>Loading...</div>;
  console.log("Audio URL:", task.audio_file.file);

  return (
    <>
      <Navbar bg="light" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand>Annotation Tool</Navbar.Brand>
          <Nav className="me-auto">
            <Nav.Link onClick={() => navigate('/')}>Projects</Nav.Link>
            <Nav.Link onClick={() => navigate('/tasks')}>Tasks</Nav.Link>
          </Nav>
          <Image
            src="https://cdn-icons-png.flaticon.com/512/847/847969.png"
            roundedCircle
            width={40}
            height={40}
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/profile')}
          />
        </Container>
      </Navbar>

      <Container>
        <h4>Task #{task.id}</h4>
        <p>Status:</p>
        <Form.Select value={status} onChange={e => setStatus(e.target.value)} style={{ maxWidth: '200px' }}>
          <option>New</option>
          <option>In Progress</option>
          <option>Completed</option>
        </Form.Select>

        {task?.project?.display_waveform  && (
          <WaveformAnnotator
          audioUrl={task.audio_file.file}
          initialAnnotations={annotations}
          onAnnotationsChange={setAnnotations}
        />
        )}
        {task?.project?.display_spectrogram  && (
          <div className="my-3">
            <h6>Spectrogram View (Placeholder)</h6>
            {/* Add spectrogram viewer here */}
          </div>
        )}

        <div className="my-3">
          <h5>Annotations</h5>
          {/* Replace below with real annotation UI */}
          <Form.Control
            as="textarea"
            rows={5}
            value={annotations.map(a => `${a.label} - ${a.start}s to ${a.end}s`).join('\n')}
            onChange={e => setAnnotations(e.target.value.split('\n').map(line => {
              const [label, range] = line.split(' - ');
              const [start, end] = range?.replace('s', '').split(' to ') || [0, 0];
              return { label, start: parseFloat(start), end: parseFloat(end) };
            }))}
          />
        </div>

        <Button onClick={handleSave}>Save</Button>
      </Container>
    </>
  );
}

export default Annotate;
