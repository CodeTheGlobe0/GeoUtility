import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config';
import './ProfileModal.css'; // sharing basic modal alerts
import './AdminDashboard.css';
import { IconUsers, IconStar, IconBriefcase, IconUser, IconShield, IconTrash, IconDatabase } from './Icons';
import GisConnectionsPanel from './GisConnectionsPanel';

const AdminDashboard = ({ onClose, onLayerLoaded, onAttributeLoaded }) => {
  const [activeSection, setActiveSection] = useState('users'); // 'users' | 'gis'
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected state
  const [selectedUser, setSelectedUser] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);

  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    // Get current logged-in user ID
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setCurrentUserId(u.id);
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }

    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    const accessToken = localStorage.getItem('accessToken');

    try {
      const response = await fetch(API_ENDPOINTS.USERS, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(data);
      } else {
        setError(data.detail || 'Failed to retrieve users list.');
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      setError('Connection failure. Unable to fetch user registry.');
    } finally {
      setLoading(false);
    }
  };

  // Stats Calculations
  const totalCount = users.length;
  const superAdminsCount = users.filter((u) => u.is_superuser).length;
  const staffOperatorsCount = users.filter((u) => u.is_staff && !u.is_superuser).length;
  const regularUsersCount = users.filter((u) => !u.is_staff && !u.is_superuser).length;

  // Filtered Users List
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectUser = (user) => {
    setError('');
    setSuccess('');
    setShowAddForm(false);
    setSelectedUser(user);

    // Populate edit fields
    setUsername(user.username || '');
    setEmail(user.email || '');
    setFirstName(user.first_name || '');
    setLastName(user.last_name || '');
    setIsStaff(user.is_staff || false);
    setIsSuperuser(user.is_superuser || false);
    setPassword(''); // Reset password field (optional for edit)
  };

  const handleTriggerAddUser = () => {
    setError('');
    setSuccess('');
    setSelectedUser(null);
    setShowAddForm(true);

    // Reset fields for new user
    setUsername('');
    setEmail('');
    setFirstName('');
    setLastName('');
    setIsStaff(false);
    setIsSuperuser(false);
    setPassword('');
  };

  const handleResetFormState = () => {
    setSelectedUser(null);
    setShowAddForm(false);
    setUsername('');
    setEmail('');
    setFirstName('');
    setLastName('');
    setIsStaff(false);
    setIsSuperuser(false);
    setPassword('');
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (selectedUser.id === currentUserId) {
      setError('Safety block: You cannot delete your own user account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${selectedUser.username}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');
    const accessToken = localStorage.getItem('accessToken');

    try {
      const response = await fetch(`${API_ENDPOINTS.USERS}${selectedUser.id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        setSuccess('User deleted successfully.');
        handleResetFormState();
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to delete user.');
      }
    } catch (err) {
      console.error('Delete user error:', err);
      setError('Connection failure. Unable to process user deletion.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading(true);

    const accessToken = localStorage.getItem('accessToken');
    
    // Construct payload
    const payload = {
      username,
      email,
      first_name: firstName,
      last_name: lastName,
      is_staff: isStaff,
      is_superuser: isSuperuser,
    };

    if (password.trim() !== '') {
      payload.password = password;
    } else if (showAddForm) {
      setError('Password is required for new users.');
      setActionLoading(false);
      return;
    }

    const url = selectedUser ? `${API_ENDPOINTS.USERS}${selectedUser.id}/` : API_ENDPOINTS.USERS;
    const method = selectedUser ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(selectedUser ? 'User updated successfully.' : 'User created successfully.');
        handleResetFormState();
        fetchUsers();
      } else {
        // Parse validation errors
        let errMsg = data.detail || '';
        if (!errMsg) {
          const errors = [];
          Object.keys(data).forEach((key) => {
            errors.push(`${key}: ${data[key].join(', ')}`);
          });
          errMsg = errors.join(' | ');
        }
        setError(errMsg || 'Failed to save user.');
      }
    } catch (err) {
      console.error('Save user error:', err);
      setError('Connection failure. Unable to save changes.');
    } finally {
      setActionLoading(false);
    }
  };

  // Initials for avatar
  const getInitials = (u) => {
    if (!u) return '';
    if (u.first_name && u.last_name) {
      return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
    }
    return u.username.slice(0, 2).toUpperCase();
  };

  return (
    <div className="admin-dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-title-group">
          <h3>GeoUtility Admin Dashboard</h3>
          <p>Superuser Registry & Security Control Panel</p>
        </div>
        <button className="back-map-btn" onClick={onClose}>
          ← Back to Map
        </button>
      </header>

      {/* Section Tabs */}
      <nav className="admin-section-tabs">
        <button
          className={`admin-tab-btn ${activeSection === 'users' ? 'active' : ''}`}
          onClick={() => setActiveSection('users')}
        >
          <IconUsers size={15} /> Users
        </button>
        <button
          className={`admin-tab-btn ${activeSection === 'gis' ? 'active' : ''}`}
          onClick={() => setActiveSection('gis')}
        >
          <IconDatabase size={15} /> GIS Database Connections
        </button>
      </nav>

      {activeSection === 'gis' ? (
        <GisConnectionsPanel onLayerLoaded={onLayerLoaded} onAttributeLoaded={onAttributeLoaded} />
      ) : (
      <>
      {/* Metrics Row */}
      <section className="stats-cards-row">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eef2ff', color: '#2563eb' }}><IconUsers size={16} /></div>
          <div className="stat-info">
            <span className="stat-value">{totalCount}</span>
            <span className="stat-label">Total Users</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#f472b6' }}><IconStar size={15} /></div>
          <div className="stat-info">
            <span className="stat-value">{superAdminsCount}</span>
            <span className="stat-label">Super Admins</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}><IconBriefcase size={16} /></div>
          <div className="stat-info">
            <span className="stat-value">{staffOperatorsCount}</span>
            <span className="stat-label">Staff Operators</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#94a3b8' }}><IconUser size={16} /></div>
          <div className="stat-info">
            <span className="stat-value">{regularUsersCount}</span>
            <span className="stat-label">Regular Users</span>
          </div>
        </div>
      </section>

      {/* Workspace Area */}
      <section className="dashboard-content">
        {/* Left Registry Pane */}
        <div className="registry-pane">
          <div className="registry-header-actions">
            <input
              type="text"
              className="search-input-field"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="add-user-btn" onClick={handleTriggerAddUser}>
              + Add User
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading user accounts directory...
            </div>
          ) : (
            <div className="user-scroll-list">
              {filteredUsers.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No users found matching search criteria.
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className={`user-list-item ${selectedUser?.id === u.id ? 'selected' : ''}`}
                    onClick={() => handleSelectUser(u)}
                  >
                    <div className="item-user-details">
                      <span className="item-username">
                        {u.username}
                        {u.id === currentUserId && <span style={{ opacity: 0.5, fontSize: '0.75rem', fontWeight: 'normal' }}>(You)</span>}
                      </span>
                      <span className="item-email">{u.email || 'no email registered'}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '5px' }}>
                      {u.is_superuser ? (
                        <span className="role-badge superuser">Superuser</span>
                      ) : u.is_staff ? (
                        <span className="role-badge staff">Staff</span>
                      ) : (
                        <span className="role-badge user">User</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Inspector & Form Pane */}
        <div className="inspector-pane">
          {error && <div className="modal-alert error">{error}</div>}
          {success && <div className="modal-alert success">{success}</div>}

          {selectedUser || showAddForm ? (
            <div>
              {/* Profile Card Summary (only for existing users) */}
              {selectedUser && (
                <div className="profile-badge-summary">
                  <div className="inspector-avatar">
                    {getInitials(selectedUser)}
                  </div>
                  <div className="inspector-meta">
                    <h4 className="inspector-name-title">
                      {selectedUser.first_name || selectedUser.last_name
                        ? `${selectedUser.first_name} ${selectedUser.last_name}`
                        : selectedUser.username}
                    </h4>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Account ID: #{selectedUser.id}
                    </span>
                  </div>
                </div>
              )}

              {/* Form */}
              <h4 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>
                {selectedUser ? 'Edit Operator Details' : 'Register New User'}
              </h4>

              <form onSubmit={handleSubmit}>
                <div className="modal-form-group">
                  <label htmlFor="dash_username">Username</label>
                  <input
                    type="text"
                    id="dash_username"
                    className="modal-form-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={actionLoading}
                    placeholder="Username"
                    required
                  />
                </div>

                <div className="modal-form-group">
                  <label htmlFor="dash_first_name">First Name</label>
                  <input
                    type="text"
                    id="dash_first_name"
                    className="modal-form-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={actionLoading}
                    placeholder="First Name"
                  />
                </div>

                <div className="modal-form-group">
                  <label htmlFor="dash_last_name">Last Name</label>
                  <input
                    type="text"
                    id="dash_last_name"
                    className="modal-form-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={actionLoading}
                    placeholder="Last Name"
                  />
                </div>

                <div className="modal-form-group">
                  <label htmlFor="dash_email">Email</label>
                  <input
                    type="email"
                    id="dash_email"
                    className="modal-form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={actionLoading}
                    placeholder="email@example.com"
                  />
                </div>

                <div className="modal-form-group">
                  <label htmlFor="dash_password">
                    {selectedUser ? 'New Password (leave empty to keep current)' : 'Password'}
                  </label>
                  <input
                    type="password"
                    id="dash_password"
                    className="modal-form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={actionLoading}
                    placeholder="••••••••"
                    required={!selectedUser}
                  />
                </div>

                {/* Roles checkboxes */}
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isStaff}
                      onChange={(e) => setIsStaff(e.target.checked)}
                      disabled={actionLoading}
                    />
                    <span>Assign Staff Role</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isSuperuser}
                      onChange={(e) => setIsSuperuser(e.target.checked)}
                      disabled={actionLoading}
                    />
                    <span>Assign Superuser Role</span>
                  </label>
                </div>

                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button type="button" className="modal-btn secondary" onClick={handleResetFormState} disabled={actionLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="modal-btn primary" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : selectedUser ? 'Save Updates' : 'Create Account'}
                  </button>
                </div>
              </form>

              {/* Danger Action */}
              {selectedUser && (
                <button
                  type="button"
                  className="delete-user-danger-btn"
                  onClick={handleDeleteUser}
                  disabled={actionLoading || selectedUser.id === currentUserId}
                >
                  <IconTrash size={15} /> Delete User Account
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
              <IconShield size={44} style={{ marginBottom: '20px', opacity: 0.6 }} />
              <h4 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 10px 0' }}>
                Account Management Inspector
              </h4>
              <p style={{ fontSize: '0.9rem', maxWidth: '300px', margin: 0 }}>
                Select an operator from the directory list on the left to view details, promote roles, or delete their access.
                Click <strong>+ Add User</strong> to register a new operator account.
              </p>
            </div>
          )}
        </div>
      </section>
      </>
      )}
    </div>
  );
};

export default AdminDashboard;
