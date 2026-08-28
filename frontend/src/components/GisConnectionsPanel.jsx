import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config';
import { IconDatabase, IconShield, IconTrash, IconMap, IconSpreadsheet } from './Icons';

const DB_TYPE_CHOICES = [
  { value: 'SQLSERVER', label: 'SQL Server' },
  { value: 'POSTGRES', label: 'PostgreSQL' },
  { value: 'ORACLE', label: 'Oracle' },
];

const dbTypeLabel = (value) => DB_TYPE_CHOICES.find((c) => c.value === value)?.label || value;

// CRUD panel for GISDatabaseConnection records (backend/admin_panel), styled
// to match the Users registry/inspector layout in AdminDashboard.jsx.
const GisConnectionsPanel = ({ onLayerLoaded, onAttributeLoaded }) => {
  const [connections, setConnections] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedConnection, setSelectedConnection] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [gisdbtype, setGisdbtype] = useState('SQLSERVER');
  const [gisapplication, setGisapplication] = useState('');
  const [instance, setInstance] = useState('');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [projection, setProjection] = useState('');
  const [isActive, setIsActive] = useState(false);

  // Live data browsing (reads directly from the active GISDatabaseConnection,
  // not from an uploaded file).
  const [tables, setTables] = useState([]);
  const [tablesFetched, setTablesFetched] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState('');
  const [databaseKind, setDatabaseKind] = useState(null);
  const [loadingTable, setLoadingTable] = useState(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    setLoading(true);
    setError('');
    const accessToken = localStorage.getItem('accessToken');

    try {
      const response = await fetch(API_ENDPOINTS.GIS_CONNECTIONS, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await response.json();

      if (response.ok) {
        setConnections(data);
      } else {
        setError(data.detail || 'Failed to retrieve GIS database connections.');
      }
    } catch (err) {
      console.error('Fetch GIS connections error:', err);
      setError('Connection failure. Unable to fetch GIS database registry.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    setTablesLoading(true);
    setTablesError('');
    const accessToken = localStorage.getItem('accessToken');

    try {
      const response = await fetch(API_ENDPOINTS.LOAD_DATA, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();

      if (data.success) {
        setTables(data.data.tables || []);
        setDatabaseKind(data.data.database_kind || null);
        setTablesFetched(true);
      } else {
        const msgs = data.errors ? Object.values(data.errors).flat() : [data.message];
        setTablesError(msgs.join(' '));
        setTables([]);
      }
    } catch (err) {
      console.error('Load tables error:', err);
      setTablesError('Connection failure. Unable to reach the server.');
    } finally {
      setTablesLoading(false);
    }
  };

  const handleLoadTable = async (t) => {
    setLoadingTable(t.table);
    setTablesError('');
    const accessToken = localStorage.getItem('accessToken');

    try {
      const response = await fetch(API_ENDPOINTS.LOAD_DATA_TABLE(t.table), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();

      if (data.success) {
        if (data.data.level === 'layer') {
          onLayerLoaded?.({ [t.table]: data.data.geojson });
        } else {
          onAttributeLoaded?.([{ table: t.table, records: data.data.records }]);
        }
      } else {
        const msgs = data.errors ? Object.values(data.errors).flat() : [data.message];
        setTablesError(msgs.join(' '));
      }
    } catch (err) {
      console.error('Load table data error:', err);
      setTablesError('Connection failure. Unable to fetch table data.');
    } finally {
      setLoadingTable(null);
    }
  };

  const totalCount = connections.length;
  const countByType = (type) => connections.filter((c) => c.gisdbtype === type).length;
  const activeConnection = connections.find((c) => c.is_active) || null;

  const filteredConnections = connections.filter((c) =>
    c.instance.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.database.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.gisapplication || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectConnection = (conn) => {
    setError('');
    setSuccess('');
    setShowAddForm(false);
    setSelectedConnection(conn);

    setGisdbtype(conn.gisdbtype || 'SQLSERVER');
    setGisapplication(conn.gisapplication || '');
    setInstance(conn.instance || '');
    setDatabase(conn.database || '');
    setUsername(conn.username || '');
    setProjection(conn.projection || '');
    setIsActive(conn.is_active || false);
    setPassword('');
  };

  const handleTriggerAdd = () => {
    setError('');
    setSuccess('');
    setSelectedConnection(null);
    setShowAddForm(true);

    setGisdbtype('SQLSERVER');
    setGisapplication('');
    setInstance('');
    setDatabase('');
    setUsername('');
    setProjection('');
    setIsActive(false);
    setPassword('');
  };

  const handleResetFormState = () => {
    setSelectedConnection(null);
    setShowAddForm(false);
    setGisdbtype('SQLSERVER');
    setGisapplication('');
    setInstance('');
    setDatabase('');
    setUsername('');
    setProjection('');
    setIsActive(false);
    setPassword('');
  };

  const handleDelete = async () => {
    if (!selectedConnection) return;

    if (!window.confirm(`Are you sure you want to delete the connection to "${selectedConnection.instance}/${selectedConnection.database}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');
    const accessToken = localStorage.getItem('accessToken');

    try {
      const response = await fetch(`${API_ENDPOINTS.GIS_CONNECTIONS}${selectedConnection.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        setSuccess('GIS database connection deleted successfully.');
        handleResetFormState();
        fetchConnections();
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.detail || 'Failed to delete GIS database connection.');
      }
    } catch (err) {
      console.error('Delete GIS connection error:', err);
      setError('Connection failure. Unable to process deletion.');
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

    const payload = {
      gisdbtype,
      gisapplication,
      instance,
      database,
      username,
      projection,
      is_active: isActive,
    };

    if (password.trim() !== '') {
      payload.password = password;
    } else if (showAddForm) {
      setError('Password is required for new connections.');
      setActionLoading(false);
      return;
    }

    const url = selectedConnection ? `${API_ENDPOINTS.GIS_CONNECTIONS}${selectedConnection.id}/` : API_ENDPOINTS.GIS_CONNECTIONS;
    const method = selectedConnection ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(selectedConnection ? 'Connection updated successfully.' : 'Connection created successfully.');
        handleResetFormState();
        fetchConnections();
      } else {
        let errMsg = data.detail || '';
        if (!errMsg) {
          const errors = [];
          Object.keys(data).forEach((key) => {
            errors.push(`${key}: ${Array.isArray(data[key]) ? data[key].join(', ') : data[key]}`);
          });
          errMsg = errors.join(' | ');
        }
        setError(errMsg || 'Failed to save GIS database connection.');
      }
    } catch (err) {
      console.error('Save GIS connection error:', err);
      setError('Connection failure. Unable to save changes.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <section className="stats-cards-row">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eef2ff', color: '#2563eb' }}><IconDatabase size={16} /></div>
          <div className="stat-info">
            <span className="stat-value">{totalCount}</span>
            <span className="stat-label">Total Connections</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#f472b6' }}><IconDatabase size={15} /></div>
          <div className="stat-info">
            <span className="stat-value">{countByType('SQLSERVER')}</span>
            <span className="stat-label">SQL Server</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}><IconDatabase size={15} /></div>
          <div className="stat-info">
            <span className="stat-value">{countByType('POSTGRES')}</span>
            <span className="stat-label">PostgreSQL</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#94a3b8' }}><IconDatabase size={15} /></div>
          <div className="stat-info">
            <span className="stat-value">{countByType('ORACLE')}</span>
            <span className="stat-label">Oracle</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}><IconDatabase size={15} /></div>
          <div className="stat-info">
            <span className="stat-value" style={{ fontSize: '1.1rem' }}>
              {activeConnection ? `${activeConnection.instance}/${activeConnection.database}` : 'None'}
            </span>
            <span className="stat-label">Active Database</span>
          </div>
        </div>
      </section>

      <section className="dashboard-content">
        {/* Left Registry Pane */}
        <div className="registry-pane">
          <div className="registry-header-actions">
            <input
              type="text"
              className="search-input-field"
              placeholder="Search by instance, database, or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="add-user-btn" onClick={handleTriggerAdd}>
              + Add Connection
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading GIS database connections...
            </div>
          ) : (
            <div className="user-scroll-list">
              {filteredConnections.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No connections found matching search criteria.
                </div>
              ) : (
                filteredConnections.map((c) => (
                  <div
                    key={c.id}
                    className={`user-list-item ${selectedConnection?.id === c.id ? 'selected' : ''}`}
                    onClick={() => handleSelectConnection(c)}
                  >
                    <div className="item-user-details">
                      <span className="item-username">
                        {c.instance} / {c.database}
                        {c.is_active && <span className="role-badge superuser" style={{ marginLeft: '6px' }}>Active</span>}
                      </span>
                      <span className="item-email">{c.username}{c.gisapplication ? ` · ${c.gisapplication}` : ''}</span>
                    </div>
                    <span className="role-badge staff">{dbTypeLabel(c.gisdbtype)}</span>
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

          {selectedConnection || showAddForm ? (
            <div>
              {selectedConnection && (
                <div className="profile-badge-summary">
                  <div className="inspector-avatar">
                    <IconDatabase size={26} />
                  </div>
                  <div className="inspector-meta">
                    <h4 className="inspector-name-title">{selectedConnection.instance}</h4>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Connection ID: #{selectedConnection.id}
                    </span>
                  </div>
                </div>
              )}

              <h4 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)' }}>
                {selectedConnection ? 'Edit Connection Details' : 'Register New GIS Database Connection'}
              </h4>

              <form onSubmit={handleSubmit}>
                <div className="modal-form-group">
                  <label htmlFor="gis_dbtype">Database Type</label>
                  <select
                    id="gis_dbtype"
                    className="modal-form-input"
                    value={gisdbtype}
                    onChange={(e) => setGisdbtype(e.target.value)}
                    disabled={actionLoading}
                  >
                    {DB_TYPE_CHOICES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="modal-form-group">
                  <label htmlFor="gis_application">GIS Application</label>
                  <input
                    type="text"
                    id="gis_application"
                    className="modal-form-input"
                    value={gisapplication}
                    onChange={(e) => setGisapplication(e.target.value)}
                    disabled={actionLoading}
                    placeholder="e.g. ArcGIS, QGIS"
                    required
                  />
                </div>

                <div className="modal-form-group">
                  <label htmlFor="gis_instance">Instance / Host</label>
                  <input
                    type="text"
                    id="gis_instance"
                    className="modal-form-input"
                    value={instance}
                    onChange={(e) => setInstance(e.target.value)}
                    disabled={actionLoading}
                    placeholder="e.g. 10.0.0.5:1433"
                    required
                  />
                </div>

                <div className="modal-form-group">
                  <label htmlFor="gis_database">Database Name</label>
                  <input
                    type="text"
                    id="gis_database"
                    className="modal-form-input"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    disabled={actionLoading}
                    placeholder="Database Name"
                    required
                  />
                </div>

                <div className="modal-form-group">
                  <label htmlFor="gis_username">Username</label>
                  <input
                    type="text"
                    id="gis_username"
                    className="modal-form-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={actionLoading}
                    placeholder="Connection Username"
                    required
                  />
                </div>

                <div className="modal-form-group">
                  <label htmlFor="gis_password">
                    {selectedConnection ? 'New Password (leave empty to keep current)' : 'Password'}
                  </label>
                  <input
                    type="password"
                    id="gis_password"
                    className="modal-form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={actionLoading}
                    placeholder="••••••••"
                    required={!selectedConnection}
                  />
                </div>

                <div className="modal-form-group">
                  <label htmlFor="gis_projection">Projection</label>
                  <input
                    type="text"
                    id="gis_projection"
                    className="modal-form-input"
                    value={projection}
                    onChange={(e) => setProjection(e.target.value)}
                    disabled={actionLoading}
                    placeholder="e.g. EPSG:4326"
                    required
                  />
                </div>

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      disabled={actionLoading}
                    />
                    <span>Set as Active Database (deactivates all other connections)</span>
                  </label>
                </div>

                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button type="button" className="modal-btn secondary" onClick={handleResetFormState} disabled={actionLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="modal-btn primary" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : selectedConnection ? 'Save Updates' : 'Create Connection'}
                  </button>
                </div>
              </form>

              {selectedConnection && (
                <button
                  type="button"
                  className="delete-user-danger-btn"
                  onClick={handleDelete}
                  disabled={actionLoading}
                >
                  <IconTrash size={15} /> Delete Connection
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
              <IconShield size={44} style={{ marginBottom: '20px', opacity: 0.6 }} />
              <h4 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 10px 0' }}>
                GIS Database Connections
              </h4>
              <p style={{ fontSize: '0.9rem', maxWidth: '300px', margin: 0 }}>
                Select a connection from the list on the left to view or edit its details.
                Click <strong>+ Add Connection</strong> to register a new GIS database.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="live-data-section">
        <div className="live-data-header">
          <h4>Load Live Data from Active Database</h4>
          <button
            type="button"
            className="modal-btn secondary"
            onClick={fetchTables}
            disabled={tablesLoading || !activeConnection}
          >
            {tablesLoading ? 'Loading...' : tablesFetched ? 'Refresh Tables' : 'Browse Tables'}
          </button>
        </div>

        {!activeConnection && (
          <p className="live-data-hint">Mark a connection as Active above to browse its live tables.</p>
        )}
        {tablesError && <div className="modal-alert error">{tablesError}</div>}
        {databaseKind && (
          <p className="live-data-hint">
            Detected as <strong>{databaseKind === 'ARCGIS' ? 'an Esri ArcGIS geodatabase' : 'a standard spatial database'}</strong>.
          </p>
        )}

        {tablesFetched && (
          tables.length === 0 ? (
            <div className="live-data-empty">No tables found on this database.</div>
          ) : (
            <ul className="live-data-table-list">
              {tables.map((t) => (
                <li key={t.table} className="live-data-table-row">
                  <div className="live-data-table-info">
                    <span className="live-data-table-name">{t.table}</span>
                    <span className={`live-data-level-badge ${t.level}`}>
                      {t.level === 'layer' ? `Layer${t.geometry_type ? ` · ${t.geometry_type}` : ''}` : 'Attribute Table'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="live-data-load-btn"
                    onClick={() => handleLoadTable(t)}
                    disabled={loadingTable === t.table}
                  >
                    {t.level === 'layer' ? <IconMap size={14} /> : <IconSpreadsheet size={14} />}
                    {loadingTable === t.table ? 'Loading...' : t.level === 'layer' ? 'Load on Map' : 'Load Table'}
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </>
  );
};

export default GisConnectionsPanel;
