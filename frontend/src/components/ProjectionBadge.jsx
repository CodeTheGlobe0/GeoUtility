import React from 'react';
import './ProjectionBadge.css';
import { IconGlobe } from './Icons';

// Small badge shown once an upload's GeoJSON is loaded. The backend always
// reprojects layer data to WGS 84 (EPSG:4326) before sending it to the
// frontend (see GeoReader._feature_collection in geo_reader.py), so that's
// always the projection actually being rendered here.
const ProjectionBadge = ({ visible, className = '' }) => {
  if (!visible) return null;

  return (
    <div className={`projection-badge ${className}`} title="Coordinate Reference System">
      <IconGlobe size={13} />
      <span>WGS 84 (EPSG:4326)</span>
    </div>
  );
};

export default ProjectionBadge;
