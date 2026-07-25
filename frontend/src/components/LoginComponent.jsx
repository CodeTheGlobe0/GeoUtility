import React, { useState } from 'react';
import { API_ENDPOINTS } from '../config';
import './LoginComponent.css';

const LoginComponent = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic Validation
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);

    try {
      // API call to the Django authentication backend
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Save token & user details in localStorage
        localStorage.setItem('accessToken', data.access);
        localStorage.setItem('refreshToken', data.refresh);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Call success handler
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      } else {
        // Display backend error messages
        setError(data.detail || 'Invalid username or password. Please try again.');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Unable to connect to the authentication server. Please ensure the Django backend is running at http://localhost:8000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left Pane: Artwork Background */}
      <div className="login-graphic-pane">
        <div className="graphic-content">
          <h1>GeoUtility Portal</h1>
          <p>
            An advanced platform for geographical data operations, visualization, and network analytics. 
            Sign in to access interactive mapping utilities, staff administrative resources, and automated workflows.
          </p>
        </div>
      </div>

      {/* Right Pane: Authentication Form */}
      <div className="login-form-pane">
        <div className="login-card">
          <div className="login-header">
            <h2>Welcome Back</h2>
            <p>Please enter your credentials to login</p>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="error-banner">
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="username"
                  className="form-input"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  id="password"
                  className="form-input"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginComponent;
