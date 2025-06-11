import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Form,
  Container,
  Row,
  Col,
  InputGroup,
  FormControl,
} from 'react-bootstrap';
import axios from 'axios';
import { API_ROUTES } from './api';

function CreateProject() {
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState('');
  const [dataType, setDataType] = useState('train');
  const [displayWaveform, setDisplayWaveform] = useState(false);
  const [displaySpectrogram, setDisplaySpectrogram] = useState(false);
  const [optimize, setOptimize] = useState(false);
  const [degree, setDegree] = useState(1);
  const [audioFiles, setAudioFiles] = useState([]);
  const [labels, setLabels] = useState([]); // start with no labels

  const handleLabelNameChange = (index, value) => {
    const newLabels = [...labels];
    newLabels[index].name = value;
    setLabels(newLabels);
  };

  const addLabel = () => {
    setLabels([...labels, { name: '', attributes: [] }]);
  };

  const handleAttributeNameChange = (labelIndex, attrIndex, value) => {
    const newLabels = [...labels];
    newLabels[labelIndex].attributes[attrIndex].name = value;
    setLabels(newLabels);
  };

  const addAttribute = (labelIndex) => {
    const newLabels = [...labels];
    newLabels[labelIndex].attributes.push({ name: '', values: [''] });
    setLabels(newLabels);
  };

  const handleAttributeValueChange = (labelIndex, attrIndex, valueIndex, value) => {
    const newLabels = [...labels];
    newLabels[labelIndex].attributes[attrIndex].values[valueIndex] = value;
    setLabels(newLabels);
  };

  const addAttributeValue = (labelIndex, attrIndex) => {
    const newLabels = [...labels];
    newLabels[labelIndex].attributes[attrIndex].values.push('');
    setLabels(newLabels);
  };

  const removeAttributeValue = (labelIndex, attrIndex, valueIndex) => {
    const newLabels = [...labels];
    newLabels[labelIndex].attributes[attrIndex].values.splice(valueIndex, 1);
    setLabels(newLabels);
  };

  const removeLabel = (index) => {
    const newLabels = [...labels];
    newLabels.splice(index, 1);
    setLabels(newLabels);
  };

  const handleAudioChange = (e) => {
    setAudioFiles(e.target.files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.id) {
      alert('User not found. Please log in again.');
      return;
    }

    const formData = new FormData();
    formData.append('name', projectName);
    formData.append('data_type', dataType);
    formData.append('display_waveform', displayWaveform.toString());
    formData.append('display_spectrogram', displaySpectrogram.toString());
    formData.append('optimize', optimize.toString());
    formData.append('degree', degree.toString());
    formData.append('user', user.id);

    Array.from(audioFiles).forEach((file) => {
      formData.append('audio_files', file);
    });

    const cleanedLabels = labels.map((label) => ({
      name: String(label.name || ''),
      attributes: (label.attributes || []).map((attr) => ({
        name: String(attr.name || ''),
        values: (attr.values || []).map((v) => String(v || '')),
      })),
    }));

    formData.append('labels', JSON.stringify(cleanedLabels));

    try {
      await axios.post(API_ROUTES.createProject, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/home');
    } catch (error) {
      console.error('Error creating project:', error.response?.data || error);
      alert('Failed to create project. Check console for details.');
    }
  };

  return (
    <Container className="mt-4">
      <h3>Create Project</h3>
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="projectName">
          <Form.Label>Project Name</Form.Label>
          <Form.Control
            type="text"
            placeholder="Enter project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="dataType">
          <Form.Label>Data Type</Form.Label>
          <Form.Select value={dataType} onChange={(e) => setDataType(e.target.value)}>
            <option value="train">Train</option>
            <option value="test">Test</option>
            <option value="validation">Validation</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check
            type="checkbox"
            id="displayWaveform"
            label="Display Waveform"
            checked={displayWaveform}
            onChange={(e) => setDisplayWaveform(e.target.checked)}
          />
          <Form.Check
            type="checkbox"
            id="displaySpectrogram"
            label="Display Spectrogram"
            checked={displaySpectrogram}
            onChange={(e) => setDisplaySpectrogram(e.target.checked)}
          />
        </Form.Group>

        {/* Labels Section */}
        <Form.Group className="mb-3">
          <Form.Label>Labels (Optional)</Form.Label>
          {labels.map((label, labelIndex) => (
            <div
              key={labelIndex}
              className="border rounded p-3 mb-3"
              style={{ backgroundColor: '#f8f9fa' }}
            >
              <Row className="mb-2">
                <Col>
                  <Form.Control
                    type="text"
                    placeholder="Label name"
                    value={label.name}
                    onChange={(e) => handleLabelNameChange(labelIndex, e.target.value)}
                  />
                </Col>
                <Col xs="auto">
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => removeLabel(labelIndex)}
                  >
                    Remove Label
                  </Button>
                </Col>
              </Row>

              {/* Attributes */}
              {(label.attributes || []).map((attr, attrIndex) => (
                <div key={attrIndex} className="mb-3">
                  <Row className="mb-2">
                    <Col md={5}>
                      <FormControl
                        placeholder="Attribute name"
                        value={attr.name}
                        onChange={(e) =>
                          handleAttributeNameChange(labelIndex, attrIndex, e.target.value)
                        }
                      />
                    </Col>
                  </Row>

                  {(attr.values || []).map((val, valIndex) => (
                    <InputGroup className="mb-2" key={valIndex}>
                      <FormControl
                        placeholder="Value"
                        value={val}
                        onChange={(e) =>
                          handleAttributeValueChange(
                            labelIndex,
                            attrIndex,
                            valIndex,
                            e.target.value
                          )
                        }
                      />
                      <Button
                        variant="outline-danger"
                        onClick={() =>
                          removeAttributeValue(labelIndex, attrIndex, valIndex)
                        }
                        disabled={attr.values.length === 1}
                      >
                        &times;
                      </Button>
                    </InputGroup>
                  ))}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => addAttributeValue(labelIndex, attrIndex)}
                  >
                    + Add Value
                  </Button>
                </div>
              ))}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => addAttribute(labelIndex)}
              >
                + Add Attribute
              </Button>
            </div>
          ))}

          <Button variant="secondary" onClick={addLabel}>
            + Add Label
          </Button>
        </Form.Group>

        <Form.Group controlId="audioFiles" className="mb-3">
          <Form.Label>Upload Audio Files</Form.Label>
          <Form.Control
            type="file"
            accept="audio/*"
            multiple
            onChange={handleAudioChange}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check
            type="checkbox"
            id="optimize"
            label="Optimize Audio Chunks"
            checked={optimize}
            onChange={(e) => setOptimize(e.target.checked)}
          />
        </Form.Group>

        <Form.Group className="mb-3" controlId="degree">
          <Form.Label>Degree (Number of annotators per chunk)</Form.Label>
          <Form.Control
            type="number"
            min={1}
            value={degree}
            onChange={(e) => setDegree(Number(e.target.value))}
            required
          />
        </Form.Group>

        <Button variant="primary" type="submit">
          Create Project
        </Button>
      </Form>
    </Container>
  );
}

export default CreateProject;
