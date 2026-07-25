import React from 'react';
import './Sidebar.css';

const Sidebar = ({
  isOpen,
  onToggle,
  activeBaseLayer,
  onBaseLayerChange,
  showGraticule,
  onGraticuleToggle,
}) => {
  const baseLayers = [
    {
      id: 'osm',
      name: 'OpenStreetMap',
      desc: 'Standard topographic base tilemap',
    },
    {
      id: 'light',
      name: 'CartoDB Light',
      desc: 'Minimal light-themed Positron map',
    },
    {
      id: 'dark',
      name: 'CartoDB Dark',
      desc: 'Futuristic dark-themed basemap',
    },
    {
      id: 'satellite',
      name: 'Satellite Map',
      desc: 'Esri World Imagery satellite view',
    },
  ];

  return (
    <>
      {/* Sliding toggle button */}
      <button
        className={`sidebar-toggle-btn ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
        title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {/* Floating Sidebar card panel */}
      <div className={`floating-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h4>GIS Toolbox</h4>
          <p>Manage layers, viewports, and coordinates</p>
        </div>

        {/* Section 1: Base Tilemaps */}
        <div className="sidebar-section">
          <h5>Base Maps</h5>
          <div className="layer-options-list">
            {baseLayers.map((layer) => (
              <div
                key={layer.id}
                className={`layer-option-card ${activeBaseLayer === layer.id ? 'active' : ''}`}
                onClick={() => onBaseLayerChange(layer.id)}
              >
                <input
                  type="radio"
                  name="basemap"
                  checked={activeBaseLayer === layer.id}
                  onChange={() => onBaseLayerChange(layer.id)}
                />
                <div className="layer-option-meta">
                  <span className="layer-name">{layer.name}</span>
                  <span className="layer-desc">{layer.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Overlays & Grid Controls */}
        <div className="sidebar-section">
          <h5>Overlay Features</h5>
          <div className="checkbox-group" style={{ margin: 0 }}>
            <label className="checkbox-label" style={{ fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={showGraticule}
                onChange={(e) => onGraticuleToggle(e.target.checked)}
              />
              <span>Render Coordinate Grid</span>
            </label>
          </div>
        </div>

        {/* Section 3: Metadata Summary */}
        <div className="sidebar-section" style={{ marginTop: 'auto', marginBottom: 0 }}>
          <h5>Map Metadata</h5>
          <div className="info-box-summary">
            <div className="info-item">
              <span className="info-label">Active Layer:</span>
              <span className="info-val" style={{ textTransform: 'capitalize' }}>
                {activeBaseLayer}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">CRS Projection:</span>
              <span className="info-val">EPSG:3857</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
