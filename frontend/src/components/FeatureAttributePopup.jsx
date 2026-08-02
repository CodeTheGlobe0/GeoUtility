import React from 'react';
import './FeatureAttributePopup.css';
import { IconClose } from './Icons';

// Small map-anchored popup shown on double-clicking an uploaded feature,
// listing every attribute from the source GDB/SHP data.
const FeatureAttributePopup = ({ x, y, placement = 'above', name, properties, onClose }) => {
  const entries = Object.entries(properties || {}).filter(
    ([key]) => key !== 'geometry' && key !== '__layer',
  );

  return (
    <div
      className={`fap-popup ${placement === 'below' ? 'fap-below' : 'fap-above'}`}
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="fap-header">
        <span title={name}>{name}</span>
        <button type="button" className="fap-close" onClick={onClose} title="Close">
          <IconClose size={13} />
        </button>
      </div>
      <div className="fap-body">
        {entries.length > 0 ? (
          <table className="fap-table">
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key}>
                  <td className="fap-key">{key}</td>
                  <td className="fap-value">{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="fap-empty">No attributes.</div>
        )}
      </div>
    </div>
  );
};

export default FeatureAttributePopup;
