import React, { useEffect, useState } from 'react';
import {
  Container,
  Form,
  Button,
  Modal,
  ListGroup,
  Navbar,
  Nav,
  Image,
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_ROUTES } from './api';

function CreateSuperProject() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const [name, setName] = useState('');
  const [annotators, setAnnotators] = useState([]);
  const [selectedAnnotators, setSelectedAnnotators] = useState([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch(API_ROUTES.getUsers)

      .then((res) => res.json())
      .then((data) => {
        const onlyAnnotators = data.filter((user) => user.role === 'annotator');
        setAnnotators(onlyAnnotators);
      })
      .catch((err) => console.error('Failed to fetch annotators:', err));
  }, []);

  const handleCheckboxChange = (id) => {
    if (selectedAnnotators.includes(id)) {
      setSelectedAnnotators(selectedAnnotators.filter((uid) => uid !== id));
    } else {
      setSelectedAnnotators([...selectedAnnotators, id]);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(API_ROUTES.createSuperProject, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          manager: user.id,
          annotators: selectedAnnotators,
        }),
      });

      if (res.ok) {
        alert('Super Project created successfully');
        navigate('/superprojects');
      } else {
        const errorData = await res.json();
        alert('Failed to create Super Project: ' + JSON.stringify(errorData));
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Network error while creating Super Project');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <>
      {/* Navbar (same as SuperProject.jsx) */}
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


      {/* Create Super Project Form */}
      <Container className="mt-4">
        <h2 className="mb-4">Create Super Project</h2>
        <Form onSubmit={handleCreate}>
          <Form.Group className="mb-3">
            <Form.Label>Super Project Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Form.Group>

          <Button variant="info" className="mb-3" onClick={() => setShowModal(true)}>
            Add Members
          </Button>

          {selectedAnnotators.length > 0 && (
            <div className="mb-3">
              <strong>Selected Members:</strong>
              <ul>
                {annotators
                  .filter((user) => selectedAnnotators.includes(user.id))
                  .map((user) => (
                    <li key={user.id}>{user.username}</li>
                  ))}
              </ul>
            </div>
          )}

          <Button type="submit" variant="primary">
            Create
          </Button>
          <Button variant="secondary" className="ms-2" onClick={() => navigate('/superprojects')}>
            Cancel
          </Button>
        </Form>

        {/* Modal for selecting annotators */}
        <Modal show={showModal} onHide={() => setShowModal(false)} centered size="md">
          <Modal.Header closeButton>
            <Modal.Title>Select Annotators</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {annotators.length === 0 ? (
              <p>No annotators available.</p>
            ) : (
              <ListGroup variant="flush">
                {annotators.map((user) => (
                  <ListGroup.Item key={user.id}>
                    <Form.Check
                      type="checkbox"
                      id={`annotator-${user.id}`}
                      label={user.username}
                      checked={selectedAnnotators.includes(user.id)}
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

export default CreateSuperProject;
