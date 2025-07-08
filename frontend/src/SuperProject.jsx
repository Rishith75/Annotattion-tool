// SuperProject.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, Image, Row, Col, Card } from 'react-bootstrap';
import { Button } from 'react-bootstrap';
import { API_ROUTES } from './api';


function SuperProject() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [superProjects, setSuperProjects] = useState([]);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (!storedUser) {
      navigate('/');
    } else {
      setUser(storedUser);
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetch(API_ROUTES.getSuperProjects(user.id))
        .then((res) => res.json())
        .then((data) => setSuperProjects(data))
        .catch((err) => console.error('Error fetching super projects:', err));
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  const exportSuperProjectAnnotations = (superProjectId, e) => {
    e.stopPropagation(); // prevent card click
    fetch(API_ROUTES.exportSuperProjectAnnotations(superProjectId))
      .then((response) => {
        if (response.ok) {
          return response.blob();
        }
        throw new Error('Failed to export');
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `superproject_${superProjectId}_export.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => {
        console.error('Export error:', err);
        alert('Failed to export annotations');
      });
  };
  

  return (
    <>
      {/* Navbar */}
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


      {/* Super Projects View */}
      <Container>
        <h2 className="mb-4">Your Super Projects</h2>
        <Row>
          {/* Create New Super Project Card */}
          <Col md={4} className="mb-4">
            <Card
              className="shadow-sm h-100 d-flex align-items-center justify-content-center text-center"
              onClick={() => navigate('/create_superproject')}
              style={{ cursor: 'pointer', border: '2px dashed #aaa' }}
            >
              <Card.Body>
                <Card.Title>+ Create New Super Project</Card.Title>
              </Card.Body>
            </Card>
          </Col>

          {/* Existing Super Projects */}
          {superProjects.map((sp) => (
            <Col md={4} key={sp.id} className="mb-4">
              <Card
                className="shadow-sm h-100"
                onClick={() => navigate(`/edit_superproject/${sp.id}`)}
                style={{ cursor: 'pointer' }}
              >
                    <Card.Body>
                    <Card.Title>{sp.name}</Card.Title>
                    <Card.Text>
                      <strong>ID:</strong> {sp.id}<br />
                      <strong>Manager:</strong> {user.username}
                    </Card.Text>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={(e) => exportSuperProjectAnnotations(sp.id, e)}
                    >
                      Export Annotations
                    </Button>
                  </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </>
  );
}

export default SuperProject;
