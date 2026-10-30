import React from 'react';
import './AnalysisPlaceholder.css';
import { IconLayers } from './Icons';

// Shown on an analysis-type tab (e.g. Survey, Production) that has no
// dedicated workspace yet. Data QC has its own panel (DpsBottomPanel).
const AnalysisPlaceholder = ({ label }) => (
  <div className="analysis-placeholder">
    <span className="analysis-placeholder-icon">
      <IconLayers size={18} />
    </span>
    <div>
      <strong>{label} workspace</strong>
      <small>Tools for {label} analysis are coming soon. The map is available meanwhile.</small>
    </div>
  </div>
);

export default AnalysisPlaceholder;
