import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Form, Container } from 'react-bootstrap';
import axios from 'axios';
import { API_ROUTES } from './api';

function EditProject() {
  const { id } = useParams();
  const [projectName, setProjectName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API_ROUTES.getProjects}${id}/`)
      .then(res => setProjectName(res.data.name))
      .catch(err => console.error('Error fetching project:', err));
  }, [id]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_ROUTES.updateProject}${id}/`, { name: projectName });
      navigate('/home');
    } catch (err) {
      console.error('Error updating project:', err);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_ROUTES.deleteProject}${id}/`);
      navigate('/home');
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  return (
    <Container className="mt-4">
      <h3>Edit Project</h3>
      <Form onSubmit={handleUpdate}>
        <Form.Group className="mb-3">
          <Form.Label>Project Name</Form.Label>
          <Form.Control
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />
        </Form.Group>
        <Button type="submit" className="me-2">Update</Button>
        <Button variant="danger" onClick={handleDelete}>Delete</Button>
      </Form>
    </Container>
  );
}

export default EditProject;
