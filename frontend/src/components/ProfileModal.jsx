import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config';
import './ProfileModal.css';

const ProfileModal = ({ onClose, onUpdateSuccess }) => {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [project, setProject] = useState('');
  const [email, setEmail] = useState('');
  const [analysisTypes, setAnalysisTypes] = useState([]); // read-only, assigned by an admin
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      setError('');
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        setError('You are not authenticated. Please log in.');
        setLoading(false);
        return;
      }

      try {
        // Fetch current user details: GET /api/auth/users/me/
        const response = await fetch(`${API_ENDPOINTS.USERS}me/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        const data = await response.json();

        if (response.ok) {
          setUsername(data.username || '');
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
          setProject(data.project || '');
          setEmail(data.email || '');
          setAnalysisTypes(data.analysis_types || []);
        } else {
          setError(data.detail || 'Failed to retrieve profile details.');
        }
      } catch (err) {
        console.error('Fetch profile details error:', err);
        setError('Connection failure. Unable to fetch user profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      setError('You are not authenticated. Please log in.');
      setLoading(false);
      return;
    }

    // Build PUT payload
    const payload = {
      username: username,
      first_name: firstName,
      last_name: lastName,
      project: project,
      email: email,
    };
    if (password.trim() !== '') {
      payload.password = password;
    }

    try {
      // Update profile: PUT /api/auth/users/me/
      const response = await fetch(`${API_ENDPOINTS.USERS}me/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Profile updated successfully.');
        setPassword(''); // Clear password field

        // Update stored user details in localStorage
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedUser = {
          ...storedUser,
          username: data.username,
          first_name: data.first_name,
          last_name: data.last_name,
          project: data.project,
          email: data.email,
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));

        // Notify parent application
        if (onUpdateSuccess) {
          onUpdateSuccess(updatedUser);
        }

        // Auto-close modal after 1 second
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        // Parse error details
        let errDetail = data.detail || '';
        if (!errDetail) {
          const errors = [];
          Object.keys(data).forEach((key) => {
            errors.push(`${key}: ${data[key].join(', ')}`);
          });
          errDetail = errors.join(' | ');
        }
        setError(errDetail || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('Profile update error:', err);
      setError('A connection error occurred. Please verify your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        <h3>Update Profile</h3>
        <p className="modal-subtitle">Modify your personal details or update your password</p>

        <form onSubmit={handleSubmit}>
          {success && <div className="modal-alert success">{success}</div>}
          {error && <div className="modal-alert error">{error}</div>}

          <div className="modal-form-group">
            <label>Analysis types</label>
            <div className="profile-analysis-types">
              {analysisTypes.length === 0 ? (
                <span className="profile-analysis-empty">None assigned yet</span>
              ) : (
                analysisTypes.map((t) => (
                  <span key={t.id} className="profile-analysis-chip">{t.name}</span>
                ))
              )}
            </div>
          </div>

          <div className="modal-form-group">
            <label htmlFor="profile_username">Username</label>
            <input
              type="text"
              id="profile_username"
              className="modal-form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="Username"
              required
            />
          </div>

          <div className="modal-form-group">
            <label htmlFor="first_name">First Name</label>
            <input
              type="text"
              id="first_name"
              className="modal-form-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={loading}
              placeholder="First Name"
            />
          </div>

          <div className="modal-form-group">
            <label htmlFor="last_name">Last Name</label>
            <input
              type="text"
              id="last_name"
              className="modal-form-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={loading}
              placeholder="Last Name"
            />
          </div>

          <div className="modal-form-group">
            <label htmlFor="project">Project</label>
            <input
              type="text"
              id="project"
              className="modal-form-input"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              disabled={loading}
              placeholder="Project"
            />
          </div>

          <div className="modal-form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              className="modal-form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="email@example.com"
            />
          </div>

          <div className="modal-form-group">
            <label htmlFor="password">New Password (leave empty to keep current)</label>
            <input
              type="password"
              id="password"
              className="modal-form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="modal-btn secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="modal-btn primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;
