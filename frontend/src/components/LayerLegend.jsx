import React, { useEffect, useRef, useState } from 'react';
import './LayerLegend.css';
import { IconPalette } from './Icons';

// Collapsed icon button that expands into a small drawer listing each
// uploaded feature layer/class alongside its auto-assigned color — shared
// between the Home globe and the Data QC map so both stay visually in sync.
const LayerLegend = ({ layerColors, className = '' }) => {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);

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

  const entries = Object.entries(layerColors || {});
  if (!entries.length) return null;

  return (
    <div className={`layer-legend-container ${className}`} ref={containerRef}>
      {expanded && (
        <div className="layer-legend-panel">
          <div className="layer-legend-title">Layers</div>
          <div className="layer-legend-rows">
            {entries.map(([name, color]) => (
              <div className="layer-legend-row" key={name}>
                <span className="layer-legend-swatch" style={{ background: color }} />
                <span className="layer-legend-label" title={name}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        className={`layer-legend-btn ${expanded ? 'active' : ''}`}
        onClick={() => setExpanded((v) => !v)}
        title="Layer Legend"
      >
        <IconPalette size={15} />
        <span>Legend</span>
      </button>
    </div>
  );
};

export default LayerLegend;
