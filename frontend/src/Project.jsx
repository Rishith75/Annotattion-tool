import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Navbar,
  Nav,
  Container,
  Card,
  Row,
  Col,
  Image,
  Button // ✅ Just add Button here
} from 'react-bootstrap';
import axios from 'axios';
import FileSaver from 'file-saver';
import { API_ROUTES } from './api';


function Project() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('user'));
    if (!stored) {
      navigate('/');
    } else {
      setUser(stored);
    }
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
  
    fetch(API_ROUTES.getProjectsByUserOrManager(user))
      .then((res) => res.json())
      .then((data) => setProjects(data))
      .catch((err) => console.error('Failed to fetch projects:', err));
  }, [user]);
  

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  const exportProjectAnnotations = async (projectId, e) => {
    e.stopPropagation(); // prevent card click
    try {
      const res = await axios.get(API_ROUTES.exportProjectAnnotations(projectId), {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/zip' });
      FileSaver.saveAs(blob, `project_${projectId}_annotations.zip`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export project annotations.');
    }
  };
  

  return (
    <>
      {/* Navbar */}
      <Navbar bg="light" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand
            onClick={() => navigate(user?.role === 'manager' ? '/superprojects' : '/projects')}
            style={{ cursor: 'pointer' }}
          >
            Annotation Tool
          </Navbar.Brand>

          <Nav className="me-auto">
            {user?.role === 'manager' && (
                <Nav.Link onClick={() => navigate('/superprojects')}>Super Projects</Nav.Link>
            )}
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

      {/* Project Grid */}
      <Container>
        <h2 className="mb-4">Your Projects</h2>
        <Row>
          {projects.length === 0 ? (
            <p>No projects available.</p>
          ) : (
            projects.map((proj) => (
              <Col md={4} key={proj.id} className="mb-4">
                <Card
                  className="shadow-sm h-100"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/edit_project/${proj.id}`)}
                >
                  <Card.Body>
                    <Card.Title>{proj.name}</Card.Title>
                    <Card.Text>
                      <strong>ID:</strong> {proj.id}<br />
                      <strong>Data Type:</strong> {proj.data_type}<br />
                      <strong>Degree:</strong> {proj.degree}
                    </Card.Text>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={(e) => exportProjectAnnotations(proj.id, e)}
                    >
                      Export Annotations
                    </Button>
                  </Card.Body>

                </Card>
              </Col>
            ))
          )}
        </Row>
      </Container>
    </>
  );
}

export default Project;
