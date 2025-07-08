import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { API_ROUTES } from './api';

function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'annotator', // Default role
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    setError('');
  };

  const validatePassword = (password) => {
    const specialCharRegex = /[!@#$%^&*_]/;
    return password.length >= 8 && specialCharRegex.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { full_name, username, email, password, confirmPassword, role } = formData;

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters and include a special character (!@#$%^&*_)');
      return;
    }

    try {
      const res = await fetch(API_ROUTES.createUser, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name, username, email, password, role }),
      });

      if (res.ok) {
        navigate('/signin');
      } else {
        const data = await res.json();
        setError(
          data.detail || Object.values(data).flat().join(', ') || 'Something went wrong.'
        );
      }
    } catch (err) {
      console.error(err);
      setError('Network error. Please try again later.');
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center bg-light" style={{ height: '700px', width: '100%', padding: '1rem' }}>
      <div className="card p-4 shadow rounded-4" style={{ width: '500px', minHeight: '550px' }}>
        <h2 className="text-center mb-4">Sign Up</h2>
        <form onSubmit={handleSubmit}>
          {[
            { label: 'Full Name', type: 'text', field: 'full_name', placeholder: 'Enter full name' },
            { label: 'Username', type: 'text', field: 'username', placeholder: 'Choose a username' },
            { label: 'Email', type: 'email', field: 'email', placeholder: 'Enter your email' },
          ].map(({ label, type, field, placeholder }, index) => (
            <div className="mb-3 row align-items-center" key={index}>
              <label className="col-sm-4 col-form-label text-end">{label}:</label>
              <div className="col-sm-8">
                <input
                  type={type}
                  className="form-control"
                  placeholder={placeholder}
                  value={formData[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  required
                />
              </div>
            </div>
          ))}

          {/* Role dropdown */}
          <div className="mb-3 row align-items-center">
            <label className="col-sm-4 col-form-label text-end">Role:</label>
            <div className="col-sm-8">
              <select
                className="form-control"
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
              >
                <option value="annotator">Annotator</option>
                <option value="manager">Project Manager</option>
              </select>
            </div>
          </div>

          <div className="mb-3 row align-items-center position-relative">
            <label className="col-sm-4 col-form-label text-end">Password:</label>
            <div className="col-sm-8 position-relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
              />
              <i
                className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'} position-absolute top-50 end-0 translate-middle-y me-3`}
                style={{ cursor: 'pointer' }}
                onClick={() => setShowPassword(!showPassword)}
              ></i>
            </div>
          </div>

          <div className="mb-3 row align-items-center position-relative">
            <label className="col-sm-4 col-form-label text-end">Confirm:</label>
            <div className="col-sm-8 position-relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className="form-control"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                required
              />
              <i
                className={`bi ${showConfirm ? 'bi-eye-slash' : 'bi-eye'} position-absolute top-50 end-0 translate-middle-y me-3`}
                style={{ cursor: 'pointer' }}
                onClick={() => setShowConfirm(!showConfirm)}
              ></i>
            </div>
          </div>

          {error && <div className="text-danger text-center mb-3">{error}</div>}

          <div className="d-grid">
            <button type="submit" className="btn btn-primary">Sign Up</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Signup;
