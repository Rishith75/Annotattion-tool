import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Card,
  Navbar,
  Nav,
  Image,
  Form,
  Button,
  Spinner,
} from 'react-bootstrap';
import axios from 'axios';
import FileSaver from 'file-saver';
import { API_ROUTES } from './api';

function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loadingTaskId, setLoadingTaskId] = useState(null);

  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?.id;
  const userRole = user?.role;

  useEffect(() => {
    if (!userId || !userRole) {
      navigate('/');
      return;
    }

    const fetchTasks = async () => {
      try {
        const params = userRole === 'manager'
          ? { manager_id: userId }
          : { user_id: userId };

        const res = await axios.get(API_ROUTES.getTasks, { params });
        setTasks(res.data);
      } catch (err) {
        console.error('Error fetching tasks:', err);
        alert('Failed to fetch tasks.');
      }
    };

    fetchTasks();
  }, [userId, userRole, navigate]);

  const filteredTasks = filter === 'All'
    ? tasks
    : tasks.filter(t => t.status === filter);

  const exportAnnotations = async (taskId, e) => {
    e.stopPropagation();
    try {
      const res = await axios.get(API_ROUTES.exportAnnotations(taskId), {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/zip' });
      FileSaver.saveAs(blob, `task_${taskId}_annotations.zip`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export annotations.');
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
          <Navbar.Brand
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(userRole === 'manager' ? '/superprojects' : '/projects')}
          >
            Annotation Tool
          </Navbar.Brand>

          <Nav className="me-auto">
            {userRole === 'manager' && (
              <Nav.Link onClick={() => navigate('/superprojects')}>Super Projects</Nav.Link>
            )}

            {(userRole === 'manager' || userRole === 'annotator') && (
              <Nav.Link onClick={() => navigate('/projects')}>Projects</Nav.Link>
            )}

            <Nav.Link active>Tasks</Nav.Link>
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


      <Container>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4>Tasks</h4>
          <Form.Select
            style={{ width: '200px' }}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option>All</option>
            <option>New</option>
            <option>In Progress</option>
            <option>Completed</option>
          </Form.Select>
        </div>

        {filteredTasks.length === 0 ? (
          <p className="text-muted">No tasks found for this filter.</p>
        ) : (
          <Row className="g-3">
            {filteredTasks.map(task => (
              <Col md={4} key={task.id}>
                <Card
                  onClick={() => navigate(`/annotate/${task.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <Card.Body>
                    <h5>Task #{task.id}</h5>
                    <p>Status: {task.status}</p>

                    
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={(e) => exportAnnotations(task.id, e)}
                        >
                          Export
                        </Button>
                      </div>
                    
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Container>
    </>
  );
}

export default Tasks;
