import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Form,
  Container,
  Row,
  Col,
  InputGroup,
  FormControl,
  Navbar,
  Nav,
  Image,
  Modal,
  Spinner
} from 'react-bootstrap';
import axios from 'axios';
import { API_ROUTES } from './api';

function EditProject() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [projectName, setProjectName] = useState('');
  const [dataType, setDataType] = useState('train');
  const [displayWaveform, setDisplayWaveform] = useState(false);
  const [displaySpectrogram, setDisplaySpectrogram] = useState(false);
  const [optimize, setOptimize] = useState(false);
  const [degree, setDegree] = useState(1);
  const [labels, setLabels] = useState([]);
  const [allAnnotators, setAllAnnotators] = useState([]);
  const [selectedAnnotators, setSelectedAnnotators] = useState([]);
  const [loading, setLoading] = useState(false);  // Track loading state
  const [successMessage, setSuccessMessage] = useState('');
  const [modelType, setModelType] = useState('others'); // default
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    setLoading(true);  // Start loading when the component mounts
    axios.get(API_ROUTES.getProjectById(id))
      .then((res) => {
        const p = res.data;
        setProjectName(p.name);
        setDataType(p.data_type);
        setDisplayWaveform(p.display_waveform);
        setDisplaySpectrogram(p.display_spectrogram);
        setOptimize(p.optimize);
        setDegree(p.degree);
        setModelType(p.model_type || 'others');

        const normalizedLabels = (p.labels || []).map(label => ({
          name: label.name,
          attributes: (label.attributes || []).map(attr => ({
            name: attr.name,
            values: (attr.values || []).map(v =>
              typeof v === 'string' ? v : v.value
            )
          }))
        }));
        setLabels(normalizedLabels);
        setSelectedAnnotators(p.assigned_annotators || []);
        setLoading(false);  // Stop loading after project data is fetched
      })
      .catch((err) => {
        setLoading(false);  // Stop loading on error
        console.error('Error fetching project:', err);
        alert('Could not load project.');
      });

    axios.get(API_ROUTES.getUsers)
      .then(res => {
        const annotators = res.data.filter(u => u.role === 'annotator');
        setAllAnnotators(annotators);
      });
  }, [id]);

  const handleLabelNameChange = (li, v) => {
    const L = [...labels];
    L[li].name = v;
    setLabels(L);
  };

  const addLabel = () => setLabels([...labels, { name: '', attributes: [] }]);
  const removeLabel = (li) => {
    const L = [...labels]; L.splice(li, 1); setLabels(L);
  };

  const handleAttributeNameChange = (li, ai, v) => {
    const L = [...labels];
    L[li].attributes[ai].name = v;
    setLabels(L);
  };

  const addAttribute = (li) => {
    const L = [...labels];
    L[li].attributes.push({ name: '', values: [''] });
    setLabels(L);
  };

  const handleAttributeValueChange = (li, ai, vi, v) => {
    const L = [...labels];
    L[li].attributes[ai].values[vi] = v;
    setLabels(L);
  };

  const addAttributeValue = (li, ai) => {
    const L = [...labels];
    L[li].attributes[ai].values.push('');
    setLabels(L);
  };

  const removeAttributeValue = (li, ai, vi) => {
    const L = [...labels];
    L[li].attributes[ai].values.splice(vi, 1);
    setLabels(L);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);  // Set loading state before submitting the form

    const cleanedLabels = labels.map(l => ({
      name: l.name || '',
      attributes: (l.attributes || []).map(a => ({
        name: a.name || '',
        values: (a.values || []).map(v => v || '')
      })),
    }));

    try {
      await axios.put(API_ROUTES.updateProject(id), {
        name: projectName,
        data_type: dataType,
        display_waveform: displayWaveform,
        display_spectrogram: displaySpectrogram,
        optimize,
        degree,
        labels: cleanedLabels,
        model_type: modelType,
        ...(user.role === 'manager' && { assigned_annotators: selectedAnnotators }),
      });

      setSuccessMessage('Project successfully updated!');
      setLoading(false);  // Hide loading spinner after success

      setTimeout(() => setSuccessMessage(''), 5000);  // Hide success message after 5 seconds

      navigate('/projects');
    } catch (err) {
      setLoading(false);  // Hide loading spinner on error
      console.error('Error updating project:', err.response?.data || err);
      alert('Update failed — check console for details.');
    }
  };

  const userRole = user?.role;

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <Container className="mt-4">
      {/* Loading Modal */}
      <Modal show={loading} backdrop="static" keyboard={false}>
        <Modal.Header>
          <Modal.Title>Updating Project</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex justify-content-center">
            <Spinner animation="border" />
          </div>
          <p className="text-center mt-3">Please wait while the project is being updated...</p>
        </Modal.Body>
      </Modal>

      {/* Success Message */}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

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

      <h3>Edit Project</h3>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="projectName">
          <Form.Label>Project Name</Form.Label>
          <Form.Control
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="dataType">
          <Form.Label>Data Type</Form.Label>
          <Form.Select
            value={dataType}
            onChange={e => setDataType(e.target.value)}
          >
            <option value="train">Train</option>
            <option value="test">Test</option>
            <option value="validation">Validation</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check
            type="checkbox"
            label="Display Waveform"
            checked={displayWaveform}
            onChange={e => setDisplayWaveform(e.target.checked)}
          />
          <Form.Check
            type="checkbox"
            label="Display Spectrogram"
            checked={displaySpectrogram}
            onChange={e => setDisplaySpectrogram(e.target.checked)}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check
            type="checkbox"
            label="Optimize Audio Chunks"
            checked={optimize}
            onChange={e => setOptimize(e.target.checked)}
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="modelType">
          <Form.Label>Model Type</Form.Label>
          <Form.Select
            value={modelType}
            onChange={(e) => setModelType(e.target.value)}
          >
            <option value="others">None (Manual)</option>
            <option value="beats">Beats</option>
            <option value="yamnet">YAMNet</option>
          </Form.Select>
          <Form.Text className="text-muted">
            Changing this will re-run model predictions and overwrite model-based annotations.
          </Form.Text>
        </Form.Group>

        {/* Labels Section */}
        <Form.Group className="mb-3">
          <Form.Label>Labels</Form.Label>
          {labels.map((label, li) => (
            <div key={li} className="border rounded p-3 mb-3" style={{ backgroundColor: '#f8f9fa' }}>
              <Row className="mb-2">
                <Col>
                  <Form.Control
                    type="text"
                    placeholder="Label name"
                    value={label.name}
                    onChange={e => handleLabelNameChange(li, e.target.value)}
                  />
                </Col>
                <Col xs="auto">
                  <Button variant="outline-danger" size="sm" onClick={() => removeLabel(li)}>
                    Remove Label
                  </Button>
                </Col>
              </Row>

              {label.attributes.map((attr, ai) => (
                <div key={ai} className="mb-3">
                  <Row className="mb-2">
                    <Col md={5}>
                      <FormControl
                        placeholder="Attribute name"
                        value={attr.name}
                        onChange={e => handleAttributeNameChange(li, ai, e.target.value)}
                      />
                    </Col>
                  </Row>

                  {attr.values.map((val, vi) => (
                    <InputGroup className="mb-2" key={vi}>
                      <FormControl
                        placeholder="Value"
                        value={val}
                        onChange={e => handleAttributeValueChange(li, ai, vi, e.target.value)}
                      />
                      <Button
                        variant="outline-danger"
                        disabled={attr.values.length === 1}
                        onClick={() => removeAttributeValue(li, ai, vi)}
                      >
                        &times;
                      </Button>
                    </InputGroup>
                  ))}

                  <Button variant="secondary" size="sm" onClick={() => addAttributeValue(li, ai)}>
                    + Add Value
                  </Button>
                </div>
              ))}

              <Button variant="secondary" size="sm" onClick={() => addAttribute(li)}>
                + Add Attribute
              </Button>
            </div>
          ))}
          <Button variant="secondary" onClick={addLabel}>
            + Add Label
          </Button>
        </Form.Group>

        <Form.Group className="mb-3" controlId="degree">
          <Form.Label>Degree</Form.Label>
          <Form.Control
            type="number"
            min={1}
            value={degree}
            onChange={e => setDegree(Number(e.target.value))}
            required
          />
        </Form.Group>

        {/* 🔒 Only managers can assign annotators */}
        {user?.role === 'manager' && (
          <Form.Group className="mb-3">
            <Form.Label>Assign Annotators</Form.Label>
            {allAnnotators.map(user => (
              <Form.Check
                key={user.id}
                type="checkbox"
                label={user.username}
                checked={selectedAnnotators.includes(user.id)}
                onChange={() => {
                  if (selectedAnnotators.includes(user.id)) {
                    setSelectedAnnotators(selectedAnnotators.filter(id => id !== user.id));
                  } else {
                    setSelectedAnnotators([...selectedAnnotators, user.id]);
                  }
                }}
              />
            ))}
          </Form.Group>
        )}

        <Button variant="primary" type="submit" disabled={loading}>
          Update Project
        </Button>
      </Form>
    </Container>
  );
}

export default EditProject;
