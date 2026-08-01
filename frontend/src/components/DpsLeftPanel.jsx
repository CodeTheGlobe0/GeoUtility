import React, { useState, useEffect, useRef } from 'react';
import './DpsLeftPanel.css';
import { IconFolder, IconSpreadsheet, IconDraft, IconZap, IconDownload } from './Icons';

const DpsLeftPanel = ({ onProcessComplete, onAreaChange }) => {
  const [area, setArea] = useState('haven');
  const [checkType, setCheckType] = useState('plot-geometry');
  const [excelFile, setExcelFile] = useState(null);
  const [cadFile, setCadFile] = useState(null);
  
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const consoleEndRef = useRef(null);

  useEffect(() => {
    // Zoom/position map according to region selection
    onAreaChange(area);
  }, [area]);

  // Scroll console automatically to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleUploadExcel = () => {
    if (excelFile) {
      setExcelFile(null);
    } else {
      setExcelFile(area === 'haven' ? 'haven_data_standard.xlsx' : '15356.xlsx');
    }
  };

  const handleUploadCad = () => {
    if (cadFile) {
      setCadFile(null);
    } else {
      setCadFile(area === 'haven' ? 'haven_boundary.dwg' : '15356.dwg');
    }
  };

  const handleStartProcess = () => {
    if (!excelFile || !cadFile) return;

    setIsRunning(true);
    setLogs([]);
    onProcessComplete(area, 'running');

    const executionSequence = [
      { text: 'Submitted.', type: 'info', delay: 0 },
      { text: 'Executing...', type: 'info', delay: 400 },
      { text: `Start Time: ${new Date().toLocaleString()}`, type: 'info', delay: 800 },
      { text: 'Validating input parameters...', type: 'info', delay: 1200 },
      { text: '  Creating temporary geodatabase...', type: 'info', delay: 1500 },
      { text: 'Initializing QC Tests...', type: 'info', delay: 1900 },
      { text: '  Validating Excel File...', type: 'info', delay: 2200 },
      { text: '  Validating CAD File...', type: 'info', delay: 2500 },
      { text: 'Extracting Data from Excel file...', type: 'info', delay: 2900 },
      { text: '  Reading Plot Info...', type: 'info', delay: 3200 },
      { text: '  Reading Land Uses...', type: 'info', delay: 3500 },
      { text: '  Reading Deleted Plots...', type: 'info', delay: 3800 },
      { text: 'Extracting Data from CAD file...', type: 'info', delay: 4200 },
      { text: '  Finding Selected Project limit...', type: 'info', delay: 4500 },
      { text: '  Loading CAD Annotations...', type: 'info', delay: 4800 },
      { text: '  Loading CAD Polylines...', type: 'info', delay: 5100 },
      { text: '  Loading CAD Polygons...', type: 'info', delay: 5400 },
      { text: 'Processing CAD data...', type: 'info', delay: 5800 },
      { text: '  Repairing Polygons Geometries...', type: 'info', delay: 6100 },
      { text: '  Converting CAD data to GIS...', type: 'info', delay: 6400 },
      { text: '  Generating PLOTS Polygons...', type: 'info', delay: 6700 },
      { text: 'Quality Checking CAD Data...', type: 'info', delay: 7100 },
      { text: '  Finding affected PLOTS from DDA database...', type: 'info', delay: 7400 },
      { text: '  Uploading Modification PLOTS to DDA database...', type: 'info', delay: 7700 },
      { text: '  Validating CAD PLOTS against DDA Project Limit...', type: 'info', delay: 8000 },
      { text: '  Validating CAD PLOTS against DDA PLOTS...', type: 'info', delay: 8300 },
      { text: '  Finding DDA matching PLOT numbers...', type: 'info', delay: 8600 },
      { text: '  Finding overlapping errors...', type: 'info', delay: 8900 }
    ];

    executionSequence.forEach((step) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, step]);
      }, step.delay);
    });

    // Final outcome step
    setTimeout(() => {
      if (area === 'haven') {
        const finalStep = { text: '[OK] QC Completed without Errors!', type: 'success' };
        setLogs((prev) => [...prev, finalStep]);
        setIsRunning(false);
        onProcessComplete('haven', 'success');
      } else {
        const finalStep = { text: '[ERROR] QC Finished with Errors! Please fix mentioned plots.', type: 'error' };
        setLogs((prev) => [...prev, finalStep]);
        setIsRunning(false);
        onProcessComplete('studio-city', 'errors');
      }
    }, 9300);
  };

  return (
    <div className="dps-left-panel">
      <h3 className="dps-section-title">Data Quality Check</h3>

      {/* Select Area */}
      <div className="modal-form-group">
        <label htmlFor="dps_area">Select Area</label>
        <select
          id="dps_area"
          className="modal-form-input"
          value={area}
          onChange={(e) => {
            if (!isRunning) {
              setArea(e.target.value);
              // Reset file uploads
              setExcelFile(null);
              setCadFile(null);
              setLogs([]);
            }
          }}
          disabled={isRunning}
          style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', width: '100%' }}
        >
          <option value="haven">HAVEN</option>
          <option value="studio-city">DUBAI STUDIO CITY</option>
        </select>
      </div>

      {/* Select Check Type */}
      <div className="modal-form-group" style={{ marginBottom: '18px' }}>
        <label htmlFor="dps_check_type">Check Type</label>
        <select
          id="dps_check_type"
          className="modal-form-input"
          value={checkType}
          onChange={(e) => setCheckType(e.target.value)}
          disabled={isRunning}
          style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', width: '100%' }}
        >
          <option value="plot-geometry">Plot Info & Geometry Changes</option>
        </select>
      </div>

      {/* Upload File Excel */}
      <div
        className={`dps-upload-card ${excelFile ? 'has-file' : ''}`}
        onClick={!isRunning ? handleUploadExcel : null}
      >
        <span className="upload-icon">{excelFile ? <IconSpreadsheet size={20} /> : <IconFolder size={20} />}</span>
        <div className="upload-meta">
          <span className="upload-title">Upload Excel file</span>
          <span className="upload-desc">
            {excelFile ? excelFile : 'Click to select standard plot Excel'}
          </span>
        </div>
      </div>

      {/* Upload File CAD */}
      <div
        className={`dps-upload-card ${cadFile ? 'has-file' : ''}`}
        onClick={!isRunning ? handleUploadCad : null}
      >
        <span className="upload-icon">{cadFile ? <IconDraft size={20} /> : <IconFolder size={20} />}</span>
        <div className="upload-meta">
          <span className="upload-title">Upload CAD file</span>
          <span className="upload-desc">
            {cadFile ? cadFile : 'Click to select DWG boundary drawing'}
          </span>
        </div>
      </div>

      {/* Trigger run button */}
      <button
        className="dps-run-btn"
        disabled={isRunning || !excelFile || !cadFile}
        onClick={handleStartProcess}
      >
        {isRunning ? 'Processing...' : <><IconZap size={14} /> Start Process</>}
      </button>

      {/* Terminal logs console screen */}
      <div className="dps-console-log">
        {logs.length === 0 ? (
          <span className="console-entry info">&gt; Awaiting standard files execution...</span>
        ) : (
          logs.map((log, index) => (
            <span key={index} className={`console-entry ${log.type}`}>
              {log.text}
            </span>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>

      {/* Download button template */}
      <button className="dps-download-btn" disabled={isRunning}>
        <IconDownload size={14} /> Download Standard CAD / Excel
      </button>
    </div>
  );
};

export default DpsLeftPanel;
