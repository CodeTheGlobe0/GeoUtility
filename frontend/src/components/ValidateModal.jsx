import React, { useState } from 'react';
import { API_ENDPOINTS } from '../config';
import './ValidateModal.css';
import { IconFolder, IconPackage, IconUpload } from './Icons';

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
};

const ValidateModal = ({ onClose, user, onResult }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [userId, setUserId] = useState(String(user?.id ?? ''));
  const [tempId, setTempId] = useState(`sess_${Date.now()}`);
  const [fileType, setFileType] = useState('gdb');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setResult(null);
  };

  const handleValidate = async () => {
    if (!selectedFile) {
      setResult({ success: false, message: 'Please choose a .zip file to validate.', errors: null });
      return;
    }
    if (!userId.trim() || !tempId.trim()) {
      setResult({ success: false, message: 'User ID and Temp ID are required.', errors: null });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const fileData = await fileToBase64(selectedFile);
      const accessToken = localStorage.getItem('accessToken');

      const response = await fetch(API_ENDPOINTS.VALIDATE_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_id: userId.trim(),
          temp_id: tempId.trim(),
          file_type: fileType,
          file_data: fileData,
        }),
      });

      const data = await response.json();
      setResult(data);
      onResult?.({
        timestamp: new Date(),
        fileName: selectedFile.name,
        tempId: tempId.trim(),
        fileType,
        success: data.success,
        message: data.message,
        errorCount: data.errors ? Object.values(data.errors).flat().length : 0,
        extractedPath: data.data?.extracted_path || null,
      });
    } catch (err) {
      console.error('Validate request failed:', err);
      setResult({ success: false, message: 'Connection failure. Unable to reach the validation service.', errors: null });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUserId(String(user?.id ?? ''));
    setTempId(`sess_${Date.now()}`);
    setFileType('gdb');
    setResult(null);
  };

  const errorMessages = result?.errors
    ? Object.values(result.errors).flat()
    : [];

  return (
    <div className="vmodal-overlay" onClick={onClose}>
      <div className="vmodal-card" onClick={(e) => e.stopPropagation()}>
        <button className="vmodal-close" onClick={onClose}>&times;</button>

        <div className="vmodal-header">
          <span>Validate GIS Data</span>
          <IconUpload size={16} />
        </div>
        <p className="vmodal-subtitle">Upload a .zip archive containing a source/ folder with one .gdb dataset</p>

        {result && (
          <div className={`vmodal-alert ${result.success ? 'success' : 'error'}`}>
            <div>{result.message}</div>
            {errorMessages.length > 1 && (
              <ul>
                {errorMessages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            )}
            {result.success && result.data?.extracted_path && (
              <div className="vmodal-extracted-path">
                Saved to: <code>{result.data.extracted_path}</code>
              </div>
            )}
          </div>
        )}

        <div className="vmodal-form-group">
          <label htmlFor="validate-user-id">User ID</label>
          <input
            id="validate-user-id"
            type="text"
            className="vmodal-input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={loading}
            placeholder="e.g. 101"
          />
        </div>

        <div className="vmodal-form-group">
          <label htmlFor="validate-temp-id">Temp ID</label>
          <input
            id="validate-temp-id"
            type="text"
            className="vmodal-input"
            value={tempId}
            onChange={(e) => setTempId(e.target.value)}
            disabled={loading}
            placeholder="e.g. sess_8892"
          />
        </div>

        <div className="vmodal-form-group">
          <label htmlFor="validate-file-type">File Type</label>
          <select
            id="validate-file-type"
            className="vmodal-input"
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            disabled={loading}
          >
            <option value="gdb">GDB (Geodatabase)</option>
            <option value="shp">SHP (Shapefile)</option>
          </select>
        </div>

        <label className="vmodal-file-drop" htmlFor="validate-file-input">
          <input
            id="validate-file-input"
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            disabled={loading}
            hidden
          />
          {selectedFile ? (
            <div className="vmodal-file-picked">
              <span className="vmodal-file-name"><IconPackage size={16} /> {selectedFile.name}</span>
              <span className="vmodal-file-size">{formatBytes(selectedFile.size)}</span>
            </div>
          ) : (
            <div className="vmodal-file-placeholder">
              <IconFolder size={26} />
              <span>Click to choose a .zip file</span>
              <span className="vmodal-file-hint">Max size 20 MB</span>
            </div>
          )}
        </label>

        <div className="vmodal-actions">
          <button type="button" className="vmodal-btn secondary" onClick={handleReset} disabled={loading}>
            Reset
          </button>
          <button type="button" className="vmodal-btn primary" onClick={handleValidate} disabled={loading || !selectedFile}>
            {loading ? 'Validating...' : 'Run Validation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ValidateModal;
