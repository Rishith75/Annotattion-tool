/* Tasks.jsx */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Navbar, Nav, Image, Form } from 'react-bootstrap';
import axios from 'axios';
import { API_ROUTES } from './api';
import 'bootstrap/dist/css/bootstrap.min.css';

function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    axios.get(API_ROUTES.getTasks)
      .then(res => setTasks(res.data))
      .catch(err => console.error('Error fetching tasks:', err));
  }, []);

  const filteredTasks = tasks.filter(task => filter === 'All' || task.status === filter);

  return (
    <>
      <Navbar bg="light" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand>Annotation Tool</Navbar.Brand>
          <Nav className="me-auto">
            <Nav.Link onClick={() => navigate('/Home')}>Projects</Nav.Link>
            <Nav.Link active>Tasks</Nav.Link>
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
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4>Tasks</h4>
          <Form.Select style={{ width: '200px' }} onChange={e => setFilter(e.target.value)}>
            <option>All</option>
            <option>New</option>
            <option>In Progress</option>
            <option>Completed</option>
          </Form.Select>
        </div>

        <Row className="g-3">
          {filteredTasks.map(task => (
            <Col md={4} key={task.id}>
              <Card onClick={() => navigate(`/annotate/${task.id}`)} style={{ cursor: 'pointer' }}>
                <Card.Body>
                  <h5>Task #{task.id}</h5>
                  <p>Status: {task.status}</p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </>
  );
}

export default Tasks;
