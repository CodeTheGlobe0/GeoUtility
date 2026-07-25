import React, { useState, useEffect, useRef } from 'react';
import './MapLayerSwitcher.css';

const MapLayerSwitcher = ({ activeBaseLayer, onBaseLayerChange }) => {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);

  // Auto-collapse when clicking outside the switcher widget
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const styles = [
    { id: 'osm', name: 'Standard', icon: '🗺️' },
    { id: 'light', name: 'Light Map', icon: '📄' },
    { id: 'dark', name: 'Dark Map', icon: '🌑' },
    { id: 'satellite', name: 'Satellite', icon: '🛰️' },
  ];

  const handleSelectStyle = (styleId) => {
    onBaseLayerChange(styleId);
    setExpanded(false); // Collapses panel upon selection
  };

  return (
    <div className="map-layer-switcher-container" ref={containerRef}>
      {/* Expanded Inline Panel */}
      {expanded && (
        <div className="layers-drawer-panel">
          {styles.map((style) => (
            <div
              key={style.id}
              className={`map-style-card ${activeBaseLayer === style.id ? 'selected' : ''}`}
              onClick={() => handleSelectStyle(style.id)}
              title={`${style.name} Map Layer`}
            >
              <span className="style-card-icon">{style.icon}</span>
              <span className="style-card-name">{style.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Layer Toggle Trigger Button */}
      <button
        className={`layer-trigger-btn ${expanded ? 'active' : ''}`}
        onClick={() => setExpanded(!expanded)}
        title="Toggle Map Layers"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" style={{ display: 'block' }}>
          {/* Left panel: Google Blue */}
          <path d="M3 5l6-2v16l-6 2V5z" fill="#4285f4" />
          {/* Middle panel: Google Green */}
          <path d="M9 3l6 2v16l-6-2V3z" fill="#34a853" />
          {/* Right panel: Google Yellow */}
          <path d="M15 5l6-2v16l-6 2V5z" fill="#fbbc05" />
        </svg>
      </button>
    </div>
  );
};

export default MapLayerSwitcher;
