import React, { useEffect, useState } from 'react';
import { API_ROUTES } from './api';
import 'bootstrap-icons/font/bootstrap-icons.css';

function Profile() {
  const [user, setUser] = useState({});
  const [edit, setEdit] = useState(false);
  const [formData, setFormData] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

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

    const response = await fetch(`${API_ROUTES.updateProfile}${user.id}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });

    if (response.ok) {
      const updated = await response.json();
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
      setEdit(false);
    } else {
      const data = await response.json();
      setError(data.detail || 'Update failed.');
    }
  };

  return (
    <div className="container mt-5">
      <h2>Profile</h2>
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
  );
}

export default Profile;
