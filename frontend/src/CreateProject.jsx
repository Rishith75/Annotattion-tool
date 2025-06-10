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

  // Labels with attributes and multiple values
  const [labels, setLabels] = useState([
    { name: '', attributes: [{ name: '', values: [''] }] },
  ]);

  // Handle label name change
  const handleLabelNameChange = (index, value) => {
    const newLabels = [...labels];
    newLabels[index].name = value;
    setLabels(newLabels);
  };

  // Add new label
  const addLabel = () => {
    setLabels([...labels, { name: '', attributes: [{ name: '', values: [''] }] }]);
  };

  // Handle attribute name change
  const handleAttributeNameChange = (labelIndex, attrIndex, value) => {
    const newLabels = [...labels];
    newLabels[labelIndex].attributes[attrIndex].name = value;
    setLabels(newLabels);
  };

  // Add new attribute to a label
  const addAttribute = (labelIndex) => {
    const newLabels = [...labels];
    newLabels[labelIndex].attributes.push({ name: '', values: [''] });
    setLabels(newLabels);
  };

  // Handle change for a single attribute value input
  const handleAttributeValueChange = (labelIndex, attrIndex, valueIndex, value) => {
    const newLabels = [...labels];
    newLabels[labelIndex].attributes[attrIndex].values[valueIndex] = value;
    setLabels(newLabels);
  };

  // Add new value input to an attribute
  const addAttributeValue = (labelIndex, attrIndex) => {
    const newLabels = [...labels];
    newLabels[labelIndex].attributes[attrIndex].values.push('');
    setLabels(newLabels);
  };

  // Remove value input from attribute
  const removeAttributeValue = (labelIndex, attrIndex, valueIndex) => {
    const newLabels = [...labels];
    if (newLabels[labelIndex].attributes[attrIndex].values.length > 1) {
      newLabels[labelIndex].attributes[attrIndex].values.splice(valueIndex, 1);
      setLabels(newLabels);
    }
  };

  // Handle audio file selection
  const handleAudioChange = (e) => {
    setAudioFiles(e.target.files);
  };

  // Submit handler
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
  
    // Add audio files
    Array.from(audioFiles).forEach((file) => {
      formData.append('audio_files', file);
    });
  
    // Ensure labels, attributes, and values are all strings
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
        {/* Project Name */}
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

        {/* Data Type Select */}
        <Form.Group className="mb-3" controlId="dataType">
          <Form.Label>Data Type</Form.Label>
          <Form.Select
            value={dataType}
            onChange={(e) => setDataType(e.target.value)}
            required
          >
            <option value="train">Train</option>
            <option value="test">Test</option>
            <option value="validation">Validation</option>
          </Form.Select>
        </Form.Group>

        {/* Display Options */}
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

        {/* Labels & Attributes */}
        <Form.Group className="mb-3">
          <Form.Label>Labels & Attributes</Form.Label>
          {labels.map((label, labelIndex) => (
            <div
              key={labelIndex}
              className="border rounded p-3 mb-3"
              style={{ backgroundColor: '#f8f9fa' }}
            >
              {/* Label Name */}
              <Form.Control
                type="text"
                placeholder="Label name"
                value={label.name}
                onChange={(e) => handleLabelNameChange(labelIndex, e.target.value)}
                required
                className="mb-3"
              />

              {/* Attributes */}
              {label.attributes.map((attr, attrIndex) => (
                <div key={attrIndex} className="mb-3">
                  <Row className="align-items-center mb-2">
                    <Col xs={12} md={5}>
                      <FormControl
                        placeholder="Attribute name"
                        value={attr.name}
                        onChange={(e) =>
                          handleAttributeNameChange(labelIndex, attrIndex, e.target.value)
                        }
                        required
                      />
                    </Col>
                  </Row>

                  {/* Values Inputs */}
                  {attr.values.map((val, valIndex) => (
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
                        required
                      />
                      <Button
                        variant="outline-danger"
                        onClick={() =>
                          removeAttributeValue(labelIndex, attrIndex, valIndex)
                        }
                        disabled={attr.values.length === 1}
                        title={
                          attr.values.length === 1
                            ? 'At least one value required'
                            : 'Remove this value'
                        }
                      >
                        &times;
                      </Button>
                    </InputGroup>
                  ))}

                  {/* Add Value Button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => addAttributeValue(labelIndex, attrIndex)}
                  >
                    + Add Value
                  </Button>
                </div>
              ))}

              {/* Add Attribute Button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addAttribute(labelIndex)}
                className="mt-2"
              >
                + Add Attribute
              </Button>
            </div>
          ))}

          {/* Add Label Button */}
          <Button variant="secondary" onClick={addLabel}>
            + Add Label
          </Button>
        </Form.Group>

        {/* Audio Files Upload */}
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

        {/* Optimize Checkbox */}
        <Form.Group className="mb-3">
          <Form.Check
            type="checkbox"
            id="optimize"
            label="Optimize Audio Chunks"
            checked={optimize}
            onChange={(e) => setOptimize(e.target.checked)}
          />
        </Form.Group>

        {/* Degree Number Input */}
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
