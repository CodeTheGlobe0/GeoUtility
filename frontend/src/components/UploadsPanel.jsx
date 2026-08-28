import React, { useCallback, useEffect, useState } from 'react';
import { API_ENDPOINTS } from '../config';
import './ValidateModal.css';
import './UploadsPanel.css';
import { IconUpload, IconMapPin, IconPackage, IconDatabase } from './Icons';

const statusClass = (status) => {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED' || status === 'ERROR') return 'error';
  return 'pending';
};

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

const UploadsPanel = ({ onClose, onUploadClick, onGeojsonSelected, user }) => {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectingId, setSelectingId] = useState(null);
  const [pushingId, setPushingId] = useState(null);
  const [pushResults, setPushResults] = useState({}); // { [uploadId]: { success, message, results } }

  const canPushToDatabase = user?.is_staff || user?.is_superuser;

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accessToken = localStorage.getItem('accessToken');
      const res = await fetch(API_ENDPOINTS.UPLOADS, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setUploads(data.data || []);
      } else {
        setError(data.message || 'Failed to load uploads.');
      }
    } catch (err) {
      console.error('Uploads fetch failed:', err);
      setError('Connection failure. Unable to reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const handleSelect = async (upload) => {
    setSelectingId(upload.id);
    setError(null);
    try {
      const accessToken = localStorage.getItem('accessToken');
      const res = await fetch(API_ENDPOINTS.UPLOAD_GEOJSON(upload.id), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        onGeojsonSelected?.({ upload, layers: data.data });
        onClose();
      } else {
        const msgs = data.errors ? Object.values(data.errors).flat() : [data.message];
        setError(msgs.join(' '));
      }
    } catch (err) {
      console.error('Geojson fetch failed:', err);
      setError('Connection failure. Unable to fetch map data.');
    } finally {
      setSelectingId(null);
    }
  };

  const handlePushToDatabase = async (upload) => {
    setPushingId(upload.id);
    setPushResults((prev) => {
      const next = { ...prev };
      delete next[upload.id];
      return next;
    });
    try {
      const accessToken = localStorage.getItem('accessToken');
      const res = await fetch(API_ENDPOINTS.UPLOAD_PUSH_TO_DATABASE(upload.id), {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setPushResults((prev) => ({ ...prev, [upload.id]: { success: true, message: data.message, results: data.data?.results || [] } }));
      } else {
        const msgs = data.errors ? Object.values(data.errors).flat() : [data.message];
        setPushResults((prev) => ({ ...prev, [upload.id]: { success: false, message: msgs.join(' ') } }));
      }
    } catch (err) {
      console.error('Push to database failed:', err);
      setPushResults((prev) => ({ ...prev, [upload.id]: { success: false, message: 'Connection failure. Unable to reach the server.' } }));
    } finally {
      setPushingId(null);
    }
  };

  return (
    <div className="vmodal-overlay" onClick={onClose}>
      <div className="vmodal-card uplist-card" onClick={(e) => e.stopPropagation()}>
        <button className="vmodal-close" onClick={onClose}>&times;</button>

        <div className="vmodal-header">
          <span>GIS Data Uploads</span>
          <IconUpload size={16} />
        </div>
        <p className="vmodal-subtitle">Upload new GIS data, or select an existing upload to view it on the map</p>

        <button type="button" className="vmodal-btn primary uplist-upload-btn" onClick={onUploadClick}>
          <IconUpload size={15} /> Upload New File
        </button>

        {error && <div className="vmodal-alert error">{error}</div>}

        <div className="uplist-body">
          {loading ? (
            <div className="uplist-empty">Loading uploads...</div>
          ) : uploads.length === 0 ? (
            <div className="uplist-empty">
              <IconPackage size={22} />
              <span>No uploads yet. Use "Upload New File" to validate your first GIS dataset.</span>
            </div>
          ) : (
            <ul className="uplist-rows">
              {uploads.map((u) => (
                <li key={u.id} className="uplist-row-wrap">
                  <div className="uplist-row">
                    <div className="uplist-row-main">
                      <span className="uplist-row-title">{u.temp_id}</span>
                      <span className="uplist-row-meta">
                        <span className={`uplist-badge ${statusClass(u.status)}`}>{u.status}</span>
                        <span className="uplist-row-type">{u.file_type?.toUpperCase()}</span>
                        <span className="uplist-row-date">{formatDate(u.created_at)}</span>
                      </span>
                    </div>
                    <div className="uplist-row-actions">
                      <button
                        type="button"
                        className="uplist-row-btn"
                        disabled={u.status !== 'SUCCESS' || selectingId === u.id}
                        onClick={() => handleSelect(u)}
                        title={u.status === 'SUCCESS' ? 'View on Map' : `Status: ${u.status}`}
                      >
                        <IconMapPin size={14} />
                        {selectingId === u.id ? 'Loading...' : 'View on Map'}
                      </button>
                      {canPushToDatabase && (
                        <button
                          type="button"
                          className="uplist-row-btn secondary"
                          disabled={u.status !== 'SUCCESS' || pushingId === u.id}
                          onClick={() => handlePushToDatabase(u)}
                          title={u.status === 'SUCCESS' ? 'Push feature classes to the active GIS database' : `Status: ${u.status}`}
                        >
                          <IconDatabase size={14} />
                          {pushingId === u.id ? 'Pushing...' : 'Push to Database'}
                        </button>
                      )}
                    </div>
                  </div>

                  {pushResults[u.id] && (
                    <div className={`uplist-push-result ${pushResults[u.id].success ? 'success' : 'error'}`}>
                      <span>{pushResults[u.id].message}</span>
                      {pushResults[u.id].results?.length > 0 && (
                        <ul className="uplist-push-details">
                          {pushResults[u.id].results.map((r) => (
                            <li key={r.table}>
                              <strong>{r.layer}</strong> → <code>{r.table}</code> — {r.action} ({r.row_count} row{r.row_count === 1 ? '' : 's'})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadsPanel;
