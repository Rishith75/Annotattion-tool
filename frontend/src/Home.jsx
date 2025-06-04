/* Home.jsx */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Navbar, Nav, Image } from 'react-bootstrap';
import axios from 'axios';
import { API_ROUTES } from './api';
import 'bootstrap/dist/css/bootstrap.min.css';

function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    axios.get(API_ROUTES.getProjects)
      .then(res => setProjects(res.data))
      .catch(err => console.error('Error fetching projects:', err));
  }, []);

  return (
    <>
      <Navbar bg="light" expand="lg" className="mb-4">
      <Container>
        <Navbar.Brand>Annotation Tool</Navbar.Brand>
        <Nav className="me-auto">
          <Nav.Link onClick={() => navigate('/')}>Projects</Nav.Link>
          <Nav.Link onClick={() => navigate('/tasks')}>Tasks</Nav.Link>
        </Nav>
        <Image
          src="https://cdn-icons-png.flaticon.com/512/847/847969.png"
          roundedCircle
          width={40}
          height={40}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/profile')}
        />
      </Container>
    </Navbar>


      <Container>
        <Row className="g-4">
          <Col xs={12} md={4}>
            <Card
              onClick={() => navigate('/create_project')}
              style={{ cursor: 'pointer', minHeight: '150px' }}
              className="d-flex align-items-center justify-content-center"
            >
              <Card.Body>
                <h4 className="text-center">+ Create New Project</h4>
              </Card.Body>
            </Card>
          </Col>
          {projects.map(project => (
            <Col xs={12} md={4} key={project.id}>
              <Card
                onClick={() => navigate(`/edit_project/${project.id}`)}
                style={{ cursor: 'pointer', minHeight: '150px' }}
              >
                <Card.Body>
                  <h5 className="text-center">{project.name}</h5>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </>
  );
}

export default Home;
