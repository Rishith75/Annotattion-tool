import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, Image, Button } from 'react-bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { API_ROUTES } from './api';

function Profile() {
  const [user, setUser] = useState({});
  const [edit, setEdit] = useState(false);
  const [formData, setFormData] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user'));
    setUser(u);
    setFormData({ ...u, confirmPassword: '' });
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleUpdate = async () => {
    if (formData.password && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const updatedData = { ...formData };
    if (!formData.password) {
      delete updatedData.password; // Don't send password if not changed
    }
    delete updatedData.confirmPassword;

    try {
      const response = await fetch(API_ROUTES.updateProfile(user.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      

      // Handle the response and parse as JSON only if it's OK
      if (response.ok) {
        const updated = await response.json();
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
        setEdit(false);
      } else {
        const data = await response.json();
        setError(data.detail || 'Update failed.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <>
      {/* Navbar */}
      <Navbar bg="light" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand onClick={() => navigate(user?.role === 'manager' ? '/superprojects' : '/projects')} style={{ cursor: 'pointer' }}>
            Annotation Tool
          </Navbar.Brand>
          <Nav className="me-auto">
            {user?.role === 'manager' && (
              <Nav.Link onClick={() => navigate('/superprojects')}>Super Projects</Nav.Link>
            )}
            <Nav.Link onClick={() => navigate('/projects')}>Projects</Nav.Link>
            <Nav.Link onClick={() => navigate('/tasks')}>Tasks</Nav.Link>
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
          <Nav.Link onClick={() => { localStorage.removeItem('user'); navigate('/'); }} className="ms-3 text-danger">Logout</Nav.Link>
        </Container>
      </Navbar>

      {/* Profile */}
      <div className="container mt-5">
        <h2 className="text-center mb-4">Profile</h2>
        <div className="card p-4 shadow rounded">
          <div className="mb-3">
            <label className="form-label">Full Name:</label>
            <input
              className="form-control"
              name="full_name"
              disabled={!edit}
              value={formData.full_name || ''}
              onChange={handleChange}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Username:</label>
            <input
              className="form-control"
              name="username"
              disabled={!edit}
              value={formData.username || ''}
              onChange={handleChange}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Email:</label>
            <input
              className="form-control"
              name="email"
              disabled={!edit}
              value={formData.email || ''}
              onChange={handleChange}
            />
          </div>

          {edit && (
            <>
              <div className="mb-3 position-relative">
                <label className="form-label">New Password:</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  name="password"
                  value={formData.password || ''}
                  onChange={handleChange}
                />
                <i
                  className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'} position-absolute top-50 end-0 translate-middle-y me-3`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowPassword(!showPassword)}
                ></i>
              </div>

              <div className="mb-3 position-relative">
                <label className="form-label">Confirm Password:</label>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="form-control"
                  name="confirmPassword"
                  value={formData.confirmPassword || ''}
                  onChange={handleChange}
                />
                <i
                  className={`bi ${showConfirm ? 'bi-eye-slash' : 'bi-eye'} position-absolute top-50 end-0 translate-middle-y me-3`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowConfirm(!showConfirm)}
                ></i>
              </div>
            </>
          )}

          {error && <div className="text-danger mb-3">{error}</div>}

          <div className="d-flex gap-3">
            {edit ? (
              <button className="btn btn-success" onClick={handleUpdate}>Save</button>
            ) : (
              <button className="btn btn-primary" onClick={() => setEdit(true)}>Edit Profile</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Profile;
