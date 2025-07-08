import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Navbar, Nav, Image, Button, Form, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { API_ROUTES } from './api';
import WaveformAnnotator from './WaveformAnnotator';
import SpectrogramViewer from './SpectrogramViewer';

function Annotate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [status, setStatus] = useState('New');
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    const fetchTaskAndAnnotations = async () => {
      try {
        const taskRes = await axios.get(API_ROUTES.getTask(id));
        setTask(taskRes.data);
        setStatus(taskRes.data.status);

        const annoRes = await axios.get(API_ROUTES.getAnnotations(id));
        console.log("Fetched Annotations:", annoRes.data.annotations);
        setAnnotations(annoRes.data.annotations);
      } catch (err) {
        console.error('Error fetching task or annotations:', err);
        alert('Failed to load annotation task.');
      } finally {
        setLoading(false);
      }
    };

    fetchTaskAndAnnotations();
  }, [id]);

  const handleSave = () => {
    axios.post(API_ROUTES.saveAnnotations(id), {
      annotations,
      status,
    })
    .then(() => navigate('/tasks'))
    .catch(err => {
      console.error('Error saving annotations:', err);
      alert('Failed to save annotations.');
    });
  };

  const userRole = user?.role;

const handleLogout = () => {
  localStorage.removeItem('user');
  navigate('/');
};


  if (loading || !task) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status" />
        <p className="mt-2">Loading task...</p>
      </Container>
    );
  }

  return (
    <>
      <Navbar bg="light" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(userRole === 'manager' ? '/superprojects' : '/projects')}
          >
            Annotation Tool
          </Navbar.Brand>

          <Nav className="me-auto">
            {userRole === 'manager' && (
              <Nav.Link onClick={() => navigate('/superprojects')}>Super Projects</Nav.Link>
            )}

            {(userRole === 'manager' || userRole === 'annotator') && (
              <Nav.Link onClick={() => navigate('/projects')}>Projects</Nav.Link>
            )}

            <Nav.Link onClick={() => navigate('/tasks')}>Tasks</Nav.Link>
            {user?.role === 'manager' && (
              <Nav.Link onClick={() => navigate('/inference')}>Inference</Nav.Link>
            )}
          </Nav>

          <Image
            src="https://cdn-icons-png.flaticon.com/512/847/847969.png"
            roundedCircle
            width={40}
            height={40}
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/profile')}
          />
          <Nav.Link onClick={handleLogout} className="ms-3 text-danger">
            Logout
          </Nav.Link>
        </Container>
      </Navbar>


      <Container>
        <h4>Task #{task.id}</h4>

        <Form.Group className="my-3" style={{ maxWidth: '300px' }}>
          <Form.Label>Status</Form.Label>
          <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>New</option>
            <option>In Progress</option>
            <option>Completed</option>
          </Form.Select>
        </Form.Group>

        {task.project.display_spectrogram && (
          <div className="my-3">
            <SpectrogramViewer audioUrl={task.audio_file.file} />
          </div>
        )}

        {task.project.display_waveform && (
          <WaveformAnnotator
            audioUrl={task.audio_file.file}
            labels={task.project.labels}
            initialAnnotations={annotations}
            onAnnotationsChange={setAnnotations}
          />
        )}

        <Button onClick={handleSave} className="mt-4">
          Save
        </Button>
      </Container>
    </>
  );
}

export default Annotate;
