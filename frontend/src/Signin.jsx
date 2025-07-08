import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_ROUTES } from './api';
import 'bootstrap-icons/font/bootstrap-icons.css';

function Signin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      if (user.role === 'manager') {
        navigate('/superprojects');
      } else {
        navigate('/projects');
      }
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(API_ROUTES.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('user', JSON.stringify(data));

        if (data.role === 'manager') {
          navigate('/superprojects');
        } else {
          navigate('/projects');
        }
      } else {
        setError('Invalid credentials. Try again.');
      }
    } catch {
      setError('Server error. Try again later.');
    }
  };

  return (
    <div className="container-fluid min-vh-100 d-flex justify-content-center align-items-center bg-light">
      <div className="card p-4 shadow rounded-4" style={{ minWidth: '40vw', minHeight: '45vh' }}>
        <h2 className="text-center mb-4">Sign In</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3 row align-items-center">
            <label className="col-sm-3 col-form-label text-end">Username:</label>
            <div className="col-sm-9">
              <input type="text" className="form-control" value={username}
                     onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </div>

          <div className="mb-4 row align-items-center position-relative">
            <label className="col-sm-3 col-form-label text-end">Password:</label>
            <div className="col-sm-9 position-relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <i
                className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'} position-absolute top-50 end-0 translate-middle-y me-3`}
                style={{ cursor: 'pointer' }}
                onClick={() => setShowPassword(!showPassword)}
              ></i>
            </div>
          </div>

          {error && <div className="text-danger text-center mb-3">{error}</div>}

          <div className="text-center">
            <button type="submit" className="btn btn-primary px-4">Sign In</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Signin;
