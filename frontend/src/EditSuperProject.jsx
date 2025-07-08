import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Form,
  Button,
  Modal,
  ListGroup,
  Navbar,
  Nav,
  Image
} from 'react-bootstrap';
import { API_ROUTES } from './api';

function EditSuperProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [superProject, setSuperProject] = useState(null);
  const [allAnnotators, setAllAnnotators] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetch(API_ROUTES.getSuperProjectById(id))
      .then(res => res.json())
      .then(data => {
        setSuperProject(data);
        setProjectName(data.name);
        setSelectedMembers(data.annotators || []);
      });

    fetch(API_ROUTES.getUsers)
      .then(res => res.json())
      .then(data => {
        const annotators = data.filter(user => user.role === 'annotator');
        setAllAnnotators(annotators);
      });
  }, [id]);

  const handleCheckboxChange = (uid) => {
    if (selectedMembers.includes(uid)) {
      setSelectedMembers(selectedMembers.filter(id => id !== uid));
    } else {
      setSelectedMembers([...selectedMembers, uid]);
    }
  };

  const handleUpdate = async () => {
    const res = await fetch(API_ROUTES.updateSuperProject(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectName,
        annotators: selectedMembers
      })
    });

    if (res.ok) {
      alert('Super Project updated successfully');
      navigate('/superprojects');
    } else {
      alert('Failed to update Super Project');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <>
      <Navbar bg="light" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand onClick={() => navigate('/superprojects')} style={{ cursor: 'pointer' }}>
            Annotation Tool
          </Navbar.Brand>
          
          <Nav className="me-auto">
            <Nav.Link onClick={() => navigate('/superprojects')}>Super Projects</Nav.Link>
            <Nav.Link onClick={() => navigate('/projects')}>Projects</Nav.Link>
            <Nav.Link onClick={() => navigate('/tasks')}>Tasks</Nav.Link>

            {/* Show only for project managers */}
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
          <Nav.Link onClick={handleLogout} className="ms-3 text-danger">Logout</Nav.Link>
        </Container>
      </Navbar>

      <Container className="mt-4">
        <h2 className="mb-4">Edit Super Project</h2>
        <div className="mb-4 text-end">
          <Button
            variant="success"
            onClick={() => {
              const selectedAnnotatorObjects = allAnnotators.filter(user =>
                selectedMembers.includes(user.id)
              );
              navigate(`/create_project?super_project_id=${id}`, {
                state: { annotators: selectedAnnotatorObjects }
              });
            }}
          >
            + Create Project
          </Button>
        </div>

        <Form onSubmit={(e) => { e.preventDefault(); handleUpdate(); }}>
          <Form.Group className="mb-3">
            <Form.Label>Super Project Name</Form.Label>
            <Form.Control
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
            />
          </Form.Group>

          <Button variant="info" className="mb-3" onClick={() => setShowModal(true)}>
            Edit Members
          </Button>

          {selectedMembers.length > 0 && (
            <div className="mb-4">
              <strong>Current Members:</strong>
              <ul>
                {allAnnotators
                  .filter(user => selectedMembers.includes(user.id))
                  .map(user => (
                    <li key={user.id}>{user.username}</li>
                  ))}
              </ul>
            </div>
          )}

          <Button type="submit" variant="primary">Save Changes</Button>
          <Button variant="secondary" className="ms-2" onClick={() => navigate('/superprojects')}>
            Cancel
          </Button>
        </Form>

        <Modal show={showModal} onHide={() => setShowModal(false)} centered size="md">
          <Modal.Header closeButton>
            <Modal.Title>Select Annotators</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {allAnnotators.length === 0 ? (
              <p>No annotators available.</p>
            ) : (
              <ListGroup variant="flush">
                {allAnnotators.map(user => (
                  <ListGroup.Item key={user.id}>
                    <Form.Check
                      type="checkbox"
                      label={user.username}
                      checked={selectedMembers.includes(user.id)}
                      onChange={() => handleCheckboxChange(user.id)}
                    />
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="primary" onClick={() => setShowModal(false)}>
              Done
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  );
}

export default EditSuperProject;
