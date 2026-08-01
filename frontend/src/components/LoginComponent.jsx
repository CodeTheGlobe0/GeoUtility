import React, { useState } from 'react';
import { API_ENDPOINTS } from '../config';
import { IconUser, IconKey, IconSparkle } from './Icons';
import loginBg from '../assets/login_bg.jpg';
import ytIcon from '../assets/yticon.png';
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
    <div className="login-page" style={{ backgroundImage: `url(${loginBg})` }}>
      <div className="login-page-overlay" />

      {/* Top-left brand lockup over the map */}
      <div className="login-brand-corner">
        <img src={ytIcon} alt="GeoUtility Logo" className="login-logo-img" />
        <span className="login-brand-text">GeoUtility</span>
      </div>

      {/* Centered auth card */}
      <div className="login-card">
        <div className="login-card-brand">
          <img src={ytIcon} alt="GeoUtility Logo" className="login-logo-img card" />
          <span className="login-brand-text card">GeoUtility</span>
        </div>
        <p className="login-card-subtitle">Validate Your Data</p>

        {error && <div className="login-error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-input-group">
            <IconUser size={18} className="login-input-icon" />
            <input
              type="text"
              className="login-input"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
              required
            />
          </div>

          <div className="login-input-group">
            <IconKey size={18} className="login-input-icon" />
            <input
              type="password"
              className="login-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="login-forgot-row">
            <span className="login-inert-link" title="Coming soon">Forgot Password?</span>
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading && <span className="login-btn-spinner" />}
            {loading ? 'Signing In...' : 'Login'}
          </button>
        </form>

        <div className="login-footer-links">
          <p>Need access? <span className="login-inert-link" title="Contact your system administrator">Contact Admin</span></p>
          <p>Need Help? <span className="login-inert-link" title="Support coming soon">Contact Support</span></p>
        </div>
      </div>

      <span className="login-page-caption">GeoUtility &middot; GIS Data Validation Platform</span>
      <IconSparkle size={20} className="login-page-sparkle" />
    </div>
  );
};

export default LoginComponent;
