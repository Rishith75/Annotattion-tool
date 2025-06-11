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

  useEffect(() => {
  axios.get(API_ROUTES.getProjectById(id))
    .then((res) => {
      const p = res.data;
      setProjectName(p.name);
      setDataType(p.data_type);
      setDisplayWaveform(p.display_waveform);
      setDisplaySpectrogram(p.display_spectrogram);
      setOptimize(p.optimize);
      setDegree(p.degree);

      // Normalize each attribute’s values array from [{id,value},…] to ['value',…]
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
    })
    .catch((err) => {
      console.error('Error fetching project:', err);
      alert('Could not load project.');
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
      });
      navigate('/home');
    } catch (err) {
      console.error('Error updating project:', err.response?.data || err);
      alert('Update failed — check console for details.');
    }
  };

  return (
    <Container className="mt-4">
      <h3>Edit Project</h3>
      <Form onSubmit={handleSubmit}>
        {/* Name */}
        <Form.Group className="mb-3" controlId="projectName">
          <Form.Label>Project Name</Form.Label>
          <Form.Control
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            required
          />
        </Form.Group>

        {/* Data Type */}
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

        {/* Waveform / Spectrogram */}
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

        {/* Optimize */}
        <Form.Group className="mb-3">
          <Form.Check
            type="checkbox"
            label="Optimize Audio Chunks"
            checked={optimize}
            onChange={e => setOptimize(e.target.checked)}
          />
        </Form.Group>

        {/* Labels */}
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

        {/* Degree */}
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

        <Button variant="primary" type="submit">
          Update Project
        </Button>
      </Form>
    </Container>
  );
}

export default EditProject;
