import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config';
import './ProfileModal.css'; // sharing basic modal alerts
import './AdminDashboard.css';
import { IconUsers, IconStar, IconBriefcase, IconUser, IconTrash, IconDatabase, IconPlus, IconSearch, IconEdit, IconFolder } from './Icons';
import GisConnectionsPanel from './GisConnectionsPanel';
import loginBg from '../assets/login_bg.jpg';
import Avatar from './Avatar';
import { BarChart, Donut, Sparkline } from './AdminCharts';

// One colour per role, reused by badges, tabs, charts and the stat cards.
const ROLES = {
  superuser: { label: 'Superuser', color: '#8e33ff' },
  staff: { label: 'Staff', color: '#00a76f' },
  user: { label: 'User', color: '#3b82f6' },
};
const roleOf = (u) => (u.is_superuser ? 'superuser' : u.is_staff ? 'staff' : 'user');

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'superuser', label: 'Superusers' },
  { key: 'staff', label: 'Staff' },
  { key: 'user', label: 'Users' },
];

const ANALYSIS_COLORS = ['#00b8d9', '#ffab00', '#00a76f', '#8e33ff', '#ff5630'];

const MONTHS_SHOWN = 6;
const PROJECT_COLORS = ['#00a76f', '#3b82f6', '#ffab00', '#8e33ff', '#ff5630', '#00b8d9'];

const displayName = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username;
const joinedDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// The last MONTHS_SHOWN calendar months, oldest first: [{ key: '2026-9', label: 'Oct' }, ...]
function recentMonths() {
  const now = new Date();
  return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
    };
  });
}

// How many of `list` joined in each of `months`
function joinsPerMonth(list, months) {
  return months.map(({ key }) =>
    list.filter((u) => {
      if (!u.date_joined) return false;
      const d = new Date(u.date_joined);
      return `${d.getFullYear()}-${d.getMonth()}` === key;
    }).length
  );
}

const AdminDashboard = ({ onClose, onLayerLoaded, onAttributeLoaded }) => {
  const [activeSection, setActiveSection] = useState('users'); // 'users' | 'gis'
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [projectFilter, setProjectFilter] = useState('');
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
  const [project, setProject] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [analysisTypeIds, setAnalysisTypeIds] = useState([]);
  const [analysisTypes, setAnalysisTypes] = useState([]); // [{ id, name }] from the API

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
    fetchAnalysisTypes();
  }, []);

  const fetchAnalysisTypes = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.ANALYSIS_TYPES, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
      });
      if (response.ok) setAnalysisTypes(await response.json());
    } catch (err) {
      console.error('Fetch analysis types error:', err);
    }
  };

  const analysisColor = (id) => {
    const i = analysisTypes.findIndex((t) => t.id === id);
    return ANALYSIS_COLORS[(i < 0 ? 0 : i) % ANALYSIS_COLORS.length];
  };

  const toggleAnalysisType = (id) =>
    setAnalysisTypeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

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

  // ---- numbers for the stat cards, tabs and charts ----
  const byRole = {
    superuser: users.filter((u) => roleOf(u) === 'superuser'),
    staff: users.filter((u) => roleOf(u) === 'staff'),
    user: users.filter((u) => roleOf(u) === 'user'),
  };
  const counts = {
    all: users.length,
    superuser: byRole.superuser.length,
    staff: byRole.staff.length,
    user: byRole.user.length,
  };

  const months = recentMonths();
  const joinSeries = Object.entries(ROLES).map(([key, r]) => ({
    name: r.label,
    color: r.color,
    data: joinsPerMonth(byRole[key], months),
  }));
  const joinedRecently = joinSeries.reduce((a, se) => a + se.data.reduce((x, y) => x + y, 0), 0);

  const STATS = [
    { label: 'Total users', value: counts.all, icon: IconUsers, color: '#00b8d9', trend: joinsPerMonth(users, months) },
    { label: 'Super admins', value: counts.superuser, icon: IconStar, color: ROLES.superuser.color, trend: joinSeries[0].data },
    { label: 'Staff operators', value: counts.staff, icon: IconBriefcase, color: ROLES.staff.color, trend: joinSeries[1].data },
    { label: 'Regular users', value: counts.user, icon: IconUser, color: ROLES.user.color, trend: joinSeries[2].data },
  ];

  const roleSlices = Object.entries(ROLES).map(([key, r]) => ({ label: r.label, color: r.color, value: counts[key] }));

  // Users per project, biggest first; blank projects grouped as "No project"
  const projectCounts = Object.entries(
    users.reduce((acc, u) => {
      const name = u.project?.trim() || 'No project';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const projectNames = projectCounts.map(([name]) => name).filter((n) => n !== 'No project');
  const projectMax = Math.max(...projectCounts.map(([, n]) => n), 1);

  // ---- what the table shows after tab / search / project filter ----
  const text = searchQuery.trim().toLowerCase();
  const filteredUsers = users.filter(
    (u) =>
      (tab === 'all' || roleOf(u) === tab) &&
      (!projectFilter || (u.project || '').trim() === projectFilter) &&
      (!text ||
        [u.username, u.email, u.first_name, u.last_name, u.project].join(' ').toLowerCase().includes(text))
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
    setProject(user.project || '');
    setIsStaff(user.is_staff || false);
    setIsSuperuser(user.is_superuser || false);
    setAnalysisTypeIds((user.analysis_types || []).map((t) => t.id));
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
    setProject('');
    setIsStaff(false);
    setIsSuperuser(false);
    setAnalysisTypeIds([]);
    setPassword('');
  };

  const handleResetFormState = () => {
    setError('');
    setSelectedUser(null);
    setShowAddForm(false);
    setUsername('');
    setEmail('');
    setFirstName('');
    setLastName('');
    setProject('');
    setIsStaff(false);
    setIsSuperuser(false);
    setAnalysisTypeIds([]);
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
      project,
      is_staff: isStaff,
      is_superuser: isSuperuser,
      analysis_type_ids: analysisTypeIds,
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

  return (
    <div className="admin-dashboard-container" style={{ '--ad-bg-image': `url(${loginBg})` }}>
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
        {activeSection === 'users' && (
          <button className="ad-btn-primary ad-tabs-action" onClick={handleTriggerAddUser}>
            <IconPlus size={14} /> New user
          </button>
        )}
      </nav>

      {activeSection === 'gis' ? (
        <GisConnectionsPanel onLayerLoaded={onLayerLoaded} onAttributeLoaded={onAttributeLoaded} />
      ) : (
      <>
      <div className="ad-page">
        {success && <div className="ad-alert ok">{success}</div>}
        {error && !(selectedUser || showAddForm) && <div className="ad-alert err">{error}</div>}

        {/* Stat cards */}
        <section className="ad-grid ad-stat-grid">
          {STATS.map((st) => {
            const StatIcon = st.icon;
            return (
              <div className="ad-card ad-stat-card" key={st.label}>
                <div className="ad-stat-top">
                  <span className="ad-stat-icon" style={{ color: st.color, background: `${st.color}1f` }}>
                    <StatIcon size={16} />
                  </span>
                  <Sparkline data={st.trend} color={st.color} />
                </div>
                <small>{st.label}</small>
                <strong>{loading ? '…' : st.value}</strong>
              </div>
            );
          })}
        </section>

        {/* Charts */}
        <section className="ad-grid ad-chart-grid">
          <div className="ad-card">
            <div className="ad-card-head">
              <div>
                <h3>New users per month</h3>
                <small>
                  Last {MONTHS_SHOWN} months · {joinedRecently} joined
                </small>
              </div>
              <div className="ad-legend">
                {joinSeries.map((se) => (
                  <span key={se.name}>
                    <i style={{ background: se.color }} /> {se.name}
                  </span>
                ))}
              </div>
            </div>
            <BarChart labels={months.map((m) => m.label)} series={joinSeries} height={150} />
          </div>

          <div className="ad-card">
            <div className="ad-card-head">
              <h3>Role distribution</h3>
            </div>
            <div className="ad-donut-wrap">
              <Donut data={roleSlices} total={counts.all} size={112} />
            </div>
            <ul className="ad-donut-legend">
              {roleSlices.map((r) => (
                <li key={r.label}>
                  <i style={{ background: r.color }} />
                  <span>{r.label}</span>
                  <strong>{counts.all ? Math.round((r.value / counts.all) * 100) : 0}%</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Table + projects */}
        <section className="ad-grid ad-table-grid">
          <div className="ad-card ad-table-card">
            <div className="ad-tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`ad-tab ${tab === t.key ? 'active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                  <span
                    className="ad-tab-count"
                    style={
                      ROLES[t.key]
                        ? { color: ROLES[t.key].color, background: `${ROLES[t.key].color}1f` }
                        : undefined
                    }
                  >
                    {counts[t.key]}
                  </span>
                </button>
              ))}
            </div>

            <div className="ad-toolbar">
              <label className="ad-toolbar-search">
                <IconSearch size={14} />
                <input
                  placeholder="Search name, username, email or project…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </label>
              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                <option value="">All projects</option>
                {projectNames.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="ad-table-scroll">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Project</th>
                    <th>Analysis</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    [0, 1, 2].map((i) => (
                      <tr key={i}>
                        {[0, 1, 2, 3, 4, 5].map((j) => (
                          <td key={j}>
                            <span className="ad-skeleton" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  {!loading &&
                    filteredUsers.map((u) => {
                      const role = ROLES[roleOf(u)];
                      return (
                        <tr key={u.id} onClick={() => handleSelectUser(u)}>
                          <td>
                            <div className="ad-user-cell">
                              <Avatar name={displayName(u)} size={28} />
                              <div>
                                <strong>
                                  {displayName(u)}
                                  {u.id === currentUserId && <em className="ad-you">You</em>}
                                </strong>
                                <small>{u.email || `@${u.username}`}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="ad-with-icon">
                              <IconFolder size={14} />
                              {u.project || '—'}
                            </span>
                          </td>
                          <td>
                            {u.analysis_types?.length ? (
                              <span className="ad-chip-list">
                                {u.analysis_types.map((t) => {
                                  const c = analysisColor(t.id);
                                  return (
                                    <span key={t.id} className="ad-role-badge" style={{ color: c, background: `${c}1f` }}>
                                      {t.name}
                                    </span>
                                  );
                                })}
                              </span>
                            ) : (
                              <span className="ad-muted">—</span>
                            )}
                          </td>
                          <td>
                            <span className="ad-role-badge" style={{ color: role.color, background: `${role.color}1f` }}>
                              {role.label}
                            </span>
                          </td>
                          <td className="ad-muted">{joinedDate(u.date_joined)}</td>
                          <td className="ad-num">
                            <button
                              className="ad-icon-action"
                              title="Edit user"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectUser(u);
                              }}
                            >
                              <IconEdit size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {!loading && filteredUsers.length === 0 && (
                <div className="ad-empty-state">
                  <IconUsers size={30} />
                  <strong>{users.length === 0 ? 'No users yet' : 'No users match'}</strong>
                  <span>{users.length === 0 ? 'Create the first user to get started.' : 'Try another search or filter.'}</span>
                </div>
              )}
            </div>

            <div className="ad-table-footer">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </div>

          <div className="ad-card">
            <div className="ad-card-head">
              <div>
                <h3>Users by project</h3>
                <small>{projectNames.length} project{projectNames.length === 1 ? '' : 's'}</small>
              </div>
            </div>
            {projectCounts.length === 0 ? (
              <p className="ad-empty-note">No users yet.</p>
            ) : (
              <ul className="ad-projects">
                {projectCounts.map(([name, n], i) => {
                  const color = name === 'No project' ? '#919eab' : PROJECT_COLORS[i % PROJECT_COLORS.length];
                  return (
                    <li key={name}>
                      <div className="ad-project-row">
                        <span>{name}</span>
                        <strong>{n}</strong>
                      </div>
                      <div className="ad-progress">
                        <span style={{ width: `${(n / projectMax) * 100}%`, background: color }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Create / edit popup */}
      {(selectedUser || showAddForm) && (
        <div className="ad-modal-backdrop" onClick={handleResetFormState}>
          <form className="ad-card ad-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <div className="ad-modal-head">
              <Avatar name={[firstName, lastName].join(' ').trim() || username || 'New'} size={36} />
              <div>
                <h3>{selectedUser ? `Edit ${selectedUser.username}` : 'New user'}</h3>
                <small>
                  {selectedUser ? `Account ID #${selectedUser.id} · update details, project or role` : 'They can sign in right after you create them'}
                </small>
              </div>
            </div>

            {error && <div className="ad-alert err">{error}</div>}

            <div className="ad-form-row">
              <label>
                Username
                <input value={username} onChange={(e) => setUsername(e.target.value)} disabled={actionLoading} required />
              </label>
              <label>
                {selectedUser ? 'New password' : 'Password'}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={actionLoading}
                  placeholder={selectedUser ? 'Leave empty to keep current' : ''}
                  required={!selectedUser}
                />
              </label>
            </div>

            <div className="ad-form-row">
              <label>
                First name
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={actionLoading} />
              </label>
              <label>
                Last name
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={actionLoading} />
              </label>
            </div>

            <div className="ad-form-row">
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={actionLoading}
                  placeholder="email@example.com"
                />
              </label>
              <label>
                Project
                <input
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  disabled={actionLoading}
                  list="ad-project-names"
                  placeholder="e.g. Kolkata Metro GIS"
                />
                <datalist id="ad-project-names">
                  {projectNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </label>
            </div>

            <div className="ad-form-row">
              <label className="ad-check">
                <input type="checkbox" checked={isStaff} onChange={(e) => setIsStaff(e.target.checked)} disabled={actionLoading} />
                Staff role
              </label>
              <label className="ad-check">
                <input
                  type="checkbox"
                  checked={isSuperuser}
                  onChange={(e) => setIsSuperuser(e.target.checked)}
                  disabled={actionLoading}
                />
                Superuser role
              </label>
            </div>

            <div className="ad-field">
              <span className="ad-field-label">Analysis types</span>
              <div className="ad-chip-list">
                {analysisTypes.length === 0 && <span className="ad-muted">No analysis types available.</span>}
                {analysisTypes.map((t) => {
                  const on = analysisTypeIds.includes(t.id);
                  const c = analysisColor(t.id);
                  return (
                    <button
                      type="button"
                      key={t.id}
                      className={`ad-chip-toggle ${on ? 'on' : ''}`}
                      style={on ? { color: c, background: `${c}1f`, borderColor: c } : undefined}
                      onClick={() => toggleAnalysisType(t.id)}
                      disabled={actionLoading}
                      aria-pressed={on}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ad-modal-actions">
              {selectedUser && (
                <button
                  type="button"
                  className="ad-btn-danger"
                  onClick={handleDeleteUser}
                  disabled={actionLoading || selectedUser.id === currentUserId}
                  title={selectedUser.id === currentUserId ? 'You cannot delete your own account' : 'Delete user'}
                >
                  <IconTrash size={15} /> Delete
                </button>
              )}
              <button type="button" className="ad-btn-ghost" onClick={handleResetFormState} disabled={actionLoading}>
                Cancel
              </button>
              <button type="submit" className="ad-btn-primary" disabled={actionLoading}>
                {actionLoading ? 'Saving…' : selectedUser ? 'Save changes' : 'Create user'}
              </button>
            </div>
          </form>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default AdminDashboard;
