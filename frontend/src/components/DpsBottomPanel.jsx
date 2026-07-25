import React, { useState, useEffect } from 'react';
import './DpsBottomPanel.css';

const DpsBottomPanel = ({ showResults, statusMode, area, onZoomToPlot }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('info-changes');
  const [searchPlotQuery, setSearchPlotQuery] = useState('');
  
  // Grid Data lists
  const [plotsData, setPlotsData] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Haven default mock dataset
  const havenPlots = [
    { id: 1, number: '64810860.1', area: 101.58, gfa_curr: '', gfa_prop: '', height_curr: '', height_prop: '', lu_curr: '', lu_prop: 'OPEN SPACE: LANDSCAPE' },
    { id: 2, number: '6485648.1', area: 12221.36, gfa_curr: '', gfa_prop: '600.00', height_curr: '', height_prop: 'G', lu_curr: '', lu_prop: 'OPEN SPACE: COMMUNITY PARK' },
    { id: 3, number: '6485648.2', area: 50077.06, gfa_curr: '', gfa_prop: '1,400.00', height_curr: '', height_prop: 'G', lu_curr: '', lu_prop: 'OPEN SPACE: NEIGHBORHOOD PARK' },
    { id: 4, number: '6485648.3', area: 2994.90, gfa_curr: '', gfa_prop: '', height_curr: '', height_prop: '', lu_curr: '', lu_prop: 'OPEN SPACE: NEIGHBORHOOD PARK' },
    { id: 5, number: '6485648.4', area: 1172.37, gfa_curr: '', gfa_prop: '', height_curr: '', height_prop: '', lu_curr: '', lu_prop: 'OPEN SPACE: NEIGHBORHOOD PARK' }
  ];

  // Dubai Studio City default mock dataset
  const studioCityPlots = [
    { id: 1, number: '6757695.01', area: 15010.29, gfa_curr: '28,000.00', gfa_prop: '32,498.11', height_curr: 'G+4', height_prop: 'G+6', lu_curr: 'COMMERCIAL', lu_prop: 'COMMERCIAL - RETAILS' }
  ];

  // Dubai Studio City QC errors
  const studioCityErrors = [
    { id: 1, source: 'Excel - Deleted Plots', row: '2', plot: '6757695', val: '6757695', desc: 'Incorrect Plot Number (not found in DDA system)' },
    { id: 2, source: 'Excel - Plot Info', row: '2', plot: '6757695.01', val: 'Excel Area [12,896.37] Geometry Area [15,010.29]', desc: 'Invalid plot area (not matching with geometry area)' },
    { id: 3, source: 'Excel - Land Use', row: '2', plot: '6757695.01', val: 'Plot MaxGFA [32,498.11] Total Split GFA [38,339.11]', desc: 'Total Split GFA exceeded Maximum Plot GFA' },
    { id: 4, source: 'Excel - Land Use', row: '3', plot: '6757695.01', val: 'Commercial-Retails', desc: 'Invalid LandUse (not matching with DDA standard)' },
    { id: 5, source: 'Geometry', row: '384275', plot: '', val: '', desc: 'Invalid Plot Polygon (Self-Intersect)' },
    { id: 6, source: 'Geometry', row: '738539', plot: '', val: '', desc: 'Invalid Plot Polygon (not completely inside Project Limit)' },
    { id: 7, source: 'Geometry', row: '738540', plot: '', val: 'Overlap with existing plot: 6757694', desc: 'Invalid Plot Polygon (Overlap with existing Plots)' },
    { id: 8, source: 'Geometry', row: '738541', plot: '', val: 'Overlap with existing plot: 6757702', desc: 'Invalid Plot Polygon (Overlap with existing Plots)' },
    { id: 9, source: 'Geometry', row: '738542', plot: '', val: 'Overlap with existing plot: 6757697', desc: 'Invalid Plot Polygon (Overlap with existing Plots)' },
    { id: 10, source: 'Geometry', row: '738543', plot: '', val: 'Overlap with existing plot: 6757701', desc: 'Invalid Plot Polygon (Overlap with existing Plots)' }
  ];

  // Refresh lists when selection changes
  useEffect(() => {
    if (showResults) {
      if (area === 'haven') {
        setPlotsData(havenPlots);
        setActiveTab('info-changes');
      } else {
        setPlotsData(studioCityPlots);
        setActiveTab('errors'); // default to errors if they exist!
      }
    } else {
      setPlotsData([]);
    }
  }, [showResults, area, statusMode]);

  if (!showResults || statusMode === 'running') return null;

  // Filter plots by search query
  const filteredPlots = plotsData.filter((p) =>
    p.number.toLowerCase().includes(searchPlotQuery.toLowerCase())
  );

  // Sum total area
  const sumTotalArea = filteredPlots.reduce((sum, p) => sum + (p.area || 0), 0);
  const sumProposedGfa = filteredPlots.reduce((sum, p) => {
    const val = parseFloat(String(p.gfa_prop).replace(/,/g, '')) || 0;
    return sum + val;
  }, 0);

  // Edit action triggers
  const handleEditClick = (plot) => {
    setEditingId(plot.id);
    setEditForm({ ...plot });
  };

  const handleSaveClick = (id) => {
    setPlotsData((prev) =>
      prev.map((p) => (p.id === id ? { ...editForm } : p))
    );
    setEditingId(null);
  };

  const handleDeleteClick = (id) => {
    if (window.confirm('Delete this plot changes record?')) {
      setPlotsData((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleInputChange = (field, val) => {
    setEditForm((prev) => ({ ...prev, [field]: val }));
  };

  return (
    <div className={`dps-bottom-panel ${collapsed ? 'collapsed' : ''}`}>
      {/* Tabs Header bar */}
      <div className="dps-panel-tabs">
        <div className="tabs-group">
          <button
            className={`dps-tab-btn ${activeTab === 'info-changes' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('info-changes');
              setCollapsed(false);
            }}
          >
            Plot Info Changes
          </button>
          
          <button
            className={`dps-tab-btn ${activeTab === 'errors' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('errors');
              setCollapsed(false);
            }}
          >
            QC Errors
            {area === 'studio-city' && (
              <span className="badge-count">{studioCityErrors.length}</span>
            )}
          </button>
        </div>

        <div className="panel-tab-actions">
          <button className="export-flat-btn">Export to CSV</button>
          <button className="export-flat-btn" style={{ marginRight: '15px' }}>Export to CAD</button>
          
          {/* Collapse/Expand button */}
          <button
            className="panel-collapse-toggle"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand Bottom Panel' : 'Collapse Bottom Panel'}
          >
            {collapsed ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Grid Viewport */}
      {!collapsed && (
        <div className="dps-table-container">
          {activeTab === 'info-changes' ? (
            <div>
              {/* Filter */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Filter Plot:</span>
                <input
                  type="text"
                  className="table-cell-input"
                  style={{ width: '150px', padding: '4px' }}
                  placeholder="Plot Number..."
                  value={searchPlotQuery}
                  onChange={(e) => setSearchPlotQuery(e.target.value)}
                />
              </div>

              {/* Table */}
              <table className="dps-grid-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Actions</th>
                    <th>Plot Number</th>
                    <th>Plot Area m²</th>
                    <th style={{ width: '130px' }}>Max. GFA m² (Proposed)</th>
                    <th style={{ width: '100px' }}>Max. Height (Proposed)</th>
                    <th>Land Use (Proposed)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlots.map((plot) => (
                    <tr key={plot.id}>
                      <td>
                        {/* Zoom button */}
                        <button
                          className="dps-action-icon-btn"
                          title="Zoom to Plot geometry"
                          onClick={() => onZoomToPlot(plot.number)}
                        >
                          📍
                        </button>
                        
                        {/* Edit inline */}
                        {editingId === plot.id ? (
                          <button
                            className="dps-action-icon-btn"
                            title="Save Changes"
                            onClick={() => handleSaveClick(plot.id)}
                            style={{ color: '#34d399' }}
                          >
                            💾
                          </button>
                        ) : (
                          <button
                            className="dps-action-icon-btn"
                            title="Edit Plot Info"
                            onClick={() => handleEditClick(plot)}
                          >
                            ✏️
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          className="dps-action-icon-btn"
                          title="Delete plot"
                          onClick={() => handleDeleteClick(plot.id)}
                        >
                          ❌
                        </button>
                      </td>

                      <td>{plot.number}</td>
                      <td>{plot.area.toLocaleString()}</td>

                      <td>
                        {editingId === plot.id ? (
                          <input
                            type="text"
                            className="table-cell-input"
                            value={editForm.gfa_prop}
                            onChange={(e) => handleInputChange('gfa_prop', e.target.value)}
                          />
                        ) : (
                          plot.gfa_prop && <span className="val-proposed">{plot.gfa_prop}</span>
                        )}
                      </td>

                      <td>
                        {editingId === plot.id ? (
                          <input
                            type="text"
                            className="table-cell-input"
                            value={editForm.height_prop}
                            onChange={(e) => handleInputChange('height_prop', e.target.value)}
                          />
                        ) : (
                          plot.height_prop && <span className="val-proposed">{plot.height_prop}</span>
                        )}
                      </td>

                      <td>
                        {editingId === plot.id ? (
                          <input
                            type="text"
                            className="table-cell-input"
                            value={editForm.lu_prop}
                            onChange={(e) => handleInputChange('lu_prop', e.target.value)}
                          />
                        ) : (
                          plot.lu_prop && <span className="val-proposed">{plot.lu_prop}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Totals row */}
                  <tr className="totals-row">
                    <td>Totals</td>
                    <td>{filteredPlots.length} Plots</td>
                    <td>{sumTotalArea.toLocaleString()}</td>
                    <td>{sumProposedGfa > 0 ? `${sumProposedGfa.toLocaleString()}.00` : ''}</td>
                    <td></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              {/* Errors list table */}
              {area === 'haven' ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#34d399' }}>
                  ✔ No geodatabase validation errors found.
                </div>
              ) : (
                <table className="dps-grid-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th style={{ width: '130px' }}>Error Source</th>
                      <th style={{ width: '50px' }}>Row#</th>
                      <th style={{ width: '100px' }}>Plot Number</th>
                      <th>Input Value</th>
                      <th>Error Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studioCityErrors.map((err, i) => (
                      <tr key={err.id}>
                        <td>{i + 1}</td>
                        <td style={{ color: err.source.includes('Excel') ? '#38bdf8' : '#fb923c' }}>
                          {err.source}
                        </td>
                        <td>{err.row}</td>
                        <td style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => onZoomToPlot('6757695.01')}>
                          {err.plot} {err.plot && '📍'}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{err.val}</td>
                        <td style={{ color: '#f87171' }}>{err.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DpsBottomPanel;
