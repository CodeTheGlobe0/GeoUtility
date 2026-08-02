import React, { useEffect, useRef, useState, useCallback } from 'react';
import './HomeDashboard.css';
import { IconCheckCircle, IconMapPin, IconLayers } from './Icons';
import { API_ENDPOINTS } from '../config';

const EmptyState = ({ icon, title, subtitle }) => (
  <div className="hcd-empty-state">
    {icon}
    <span className="hcd-empty-title">{title}</span>
    {subtitle && <span className="hcd-empty-subtitle">{subtitle}</span>}
  </div>
);

const formatTime = (date) =>
  date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// Layout is persisted as a real .json file on disk (via the Vite dev-server
// plugin at vite-plugins/dashboardLayoutPlugin.js — see frontend/dashboard-layouts/),
// keyed by user id, so it's shared across any browser hitting this dev server.
// NOTE: this endpoint only exists while running the Vite dev server; it is not
// available in a production build (see the plugin file for details).
const LAYOUT_API = '/api/dashboard-layout';

const fetchLayout = async (userId) => {
  try {
    const res = await fetch(`${LAYOUT_API}?userId=${encodeURIComponent(userId ?? 'anonymous')}`);
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
};

const saveLayout = async (userId, layout) => {
  try {
    await fetch(`${LAYOUT_API}?userId=${encodeURIComponent(userId ?? 'anonymous')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout),
    });
  } catch {
    // Dev server unreachable — dragging still works this session, it just won't persist
  }
};

// Lets any card be picked up by its header and dragged anywhere on screen.
// Offsets are applied on top of the card's normal (responsive) flow position
// via a CSS transform, so the auto-adjusting layout keeps working underneath;
// on resize, saved positions are kept but nudged back on-screen if they'd
// otherwise end up stranded.
const useDraggableCards = (userId) => {
  const [offsets, setOffsets] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const dragState = useRef(null);
  const cardRefs = useRef({});

  // Load this user's saved layout from the on-disk JSON file on mount
  // (and again if the logged-in user changes).
  useEffect(() => {
    let cancelled = false;
    fetchLayout(userId).then((layout) => {
      if (!cancelled) setOffsets(layout);
    });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const handleMove = (e) => {
      const st = dragState.current;
      if (!st) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      setOffsets((prev) => ({ ...prev, [st.id]: { x: st.baseX + dx, y: st.baseY + dy } }));
    };
    const handleUp = () => {
      if (dragState.current) {
        dragState.current = null;
        setOffsets((current) => {
          saveLayout(userId, current);
          return current;
        });
      }
      setDraggingId(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [userId]);

  // Keep saved positions across resizes, but nudge any card back on-screen
  // if the new window size would otherwise leave it stranded off-view.
  useEffect(() => {
    const handleResize = () => {
      setOffsets((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          const el = cardRefs.current[id];
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const margin = 60; // keep at least this many px of the card visible
          let { x, y } = next[id];
          if (rect.right < margin) { x += margin - rect.right; changed = true; }
          if (rect.left > window.innerWidth - margin) { x -= rect.left - (window.innerWidth - margin); changed = true; }
          if (rect.bottom < margin) { y += margin - rect.bottom; changed = true; }
          if (rect.top > window.innerHeight - margin) { y -= rect.top - (window.innerHeight - margin); changed = true; }
          next[id] = { x, y };
        });
        if (changed) saveLayout(userId, next);
        return changed ? next : prev;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [userId]);

  const startDrag = useCallback((id) => (e) => {
    // Only left-click / primary touch
    if (e.button !== undefined && e.button !== 0) return;
    const current = offsets[id] || { x: 0, y: 0 };
    dragState.current = { id, startX: e.clientX, startY: e.clientY, baseX: current.x, baseY: current.y };
    setDraggingId(id);
  }, [offsets]);

  const registerCard = useCallback((id) => (el) => {
    cardRefs.current[id] = el;
  }, []);

  const getCardProps = useCallback((id) => {
    const o = offsets[id];
    return {
      style: o ? { transform: `translate(${o.x}px, ${o.y}px)`, zIndex: draggingId === id ? 950 : undefined } : undefined,
      isDragging: draggingId === id,
      ref: registerCard(id),
    };
  }, [offsets, draggingId, registerCard]);

  return { startDrag, getCardProps };
};

const HomeDashboard = ({ selectedFeature, validationHistory = [], userId, layerColors }) => {
  const legendEntries = Object.entries(layerColors || {});
  const hasHistory = validationHistory.length > 0;
  const successCount = validationHistory.filter((v) => v.success).length;
  const failCount = validationHistory.length - successCount;
  const scorePct = hasHistory ? Math.round((successCount / validationHistory.length) * 100) : null;

  const maxBar = Math.max(validationHistory.length, successCount, failCount, 1);

  // Total count of this user's uploads on record (persisted server-side),
  // not just this session's in-memory validationHistory.
  const [totalUploads, setTotalUploads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchTotalUploads = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        const res = await fetch(API_ENDPOINTS.UPLOADS, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (!cancelled && data.success) {
          setTotalUploads((data.data || []).length);
        }
      } catch {
        // Keep the last known count on failure
      }
    };
    fetchTotalUploads();
    return () => { cancelled = true; };
  }, [validationHistory]);

  const { startDrag, getCardProps } = useDraggableCards(userId);

  const cardStyle = (id, extra) => {
    const { style, isDragging, ref } = getCardProps(id);
    return { className: `hcd-card ${extra || ''} ${isDragging ? 'dragging' : ''}`, style, ref };
  };

  return (
    <div className="hcd-overlay">
      {/* Left column */}
      <div className="hcd-col hcd-col-left">
        <div {...cardStyle('total-validations', 'hcd-card-accent hcd-card-sm')}>
          <div className="hcd-card-header" onPointerDown={startDrag('total-validations')}>
            <span>Total</span>
            <IconCheckCircle size={16} />
          </div>
          <div className="hcd-big-number">{totalUploads.toLocaleString()}</div>
          {totalUploads > 0 ? (
            <div className="hcd-progress-track"><div className="hcd-progress-fill" style={{ width: `${scorePct ?? 100}%` }} /></div>
          ) : (
            <span className="hcd-hint">No validations run yet</span>
          )}
        </div>

        {/* Attribute & Feature Info Card */}
        <div {...cardStyle('attribute-inspector', 'hcd-card-lg')}>
          <div className="hcd-card-header" onPointerDown={startDrag('attribute-inspector')}>
            <span>Attribute Inspector <em>(WGS 84)</em></span>
          </div>
          {selectedFeature ? (
            <>
              <div className="hcd-feature-name">{selectedFeature.name}</div>
              {Object.keys(selectedFeature.attributes || {}).length > 0 ? (
                <table className="hcd-table">
                  <thead>
                    <tr><th>Attribute</th><th>Value</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedFeature.attributes).map(([key, value]) => (
                      <tr key={key}><td>{key}</td><td>{String(value)}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <span className="hcd-hint">No additional attributes in source data.</span>
              )}
            </>
          ) : (
            <EmptyState
              icon={<IconMapPin size={26} />}
              title="No Feature Selected"
              subtitle="Click a geometry feature on the map to view attributes."
            />
          )}
        </div>
      </div>

      {/* Right column */}
      <div className="hcd-col hcd-col-right">
        <div {...cardStyle('system-health', 'hcd-card-sm')}>
          <div className="hcd-card-header" onPointerDown={startDrag('system-health')}><span>System Health Monitor</span></div>
          <ul className="hcd-check-list">
            <li><IconCheckCircle size={13} /> Recognized GIS</li>
            <li><IconCheckCircle size={13} /> Processed</li>
          </ul>
        </div>

        {/* Schema Scorecard / Geometry Charts */}
        <div {...cardStyle('schema-compliance', 'hcd-card-accent hcd-card-lg')}>
          <div className="hcd-card-header" onPointerDown={startDrag('schema-compliance')}><span>Schema Compliance</span></div>
          {hasHistory ? (
            <>
              <div className="hcd-label">Score (Success Rate)</div>
              <div className="hcd-big-number">{scorePct}%</div>
              <div className="hcd-bars-row">
                <div className="hcd-bar-group">
                  <div className="hcd-bar-pair">
                    <span className="hcd-bar" style={{ height: `${(validationHistory.length / maxBar) * 100}%` }} />
                  </div>
                  <span className="hcd-bar-label">Validated</span>
                </div>
                <div className="hcd-bar-group">
                  <div className="hcd-bar-pair">
                    <span className="hcd-bar alt" style={{ height: `${(successCount / maxBar) * 100}%` }} />
                  </div>
                  <span className="hcd-bar-label">Passed</span>
                </div>
                <div className="hcd-bar-group">
                  <div className="hcd-bar-pair">
                    <span className="hcd-bar warn" style={{ height: `${(failCount / maxBar) * 100}%` }} />
                  </div>
                  <span className="hcd-bar-label">Failed</span>
                </div>
              </div>
            </>
          ) : (
            <div className="hcd-chart-empty">
              <div className="hcd-bars-row hcd-bars-grid">
                <div className="hcd-bar-group"><div className="hcd-bar-pair"><span className="hcd-bar ghost" /></div><span className="hcd-bar-label">Validated</span></div>
                <div className="hcd-bar-group"><div className="hcd-bar-pair"><span className="hcd-bar ghost" /></div><span className="hcd-bar-label">Passed</span></div>
                <div className="hcd-bar-group"><div className="hcd-bar-pair"><span className="hcd-bar ghost" /></div><span className="hcd-bar-label">Failed</span></div>
              </div>
              <EmptyState
                icon={<IconLayers size={22} />}
                title="No Geometry Errors Detected"
                subtitle="Awaiting File Upload."
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="hcd-bottom-row">
        {/* Processing Queue */}
        <div {...cardStyle('processing-queue', 'hcd-bottom-card')}>
          <div className="hcd-card-header" onPointerDown={startDrag('processing-queue')}><span>Processing Queue</span></div>
          <div className="hcd-table-wrap">
            <table className="hcd-table hcd-table-fixed">
              <thead className={!hasHistory ? 'hcd-thead-dim' : ''}>
                <tr><th>Time</th><th>File</th><th>Status</th></tr>
              </thead>
              <tbody>
                {hasHistory ? (
                  validationHistory.slice(0, 4).map((v, i) => (
                    <tr key={i}>
                      <td>{formatTime(v.timestamp)}</td>
                      <td>{v.fileName}</td>
                      <td><span className={`hcd-dot ${v.success ? 'ok' : 'warn'}`} />{v.success ? 'Passed' : 'Failed'}</td>
                    </tr>
                  ))
                ) : null}
              </tbody>
            </table>
            {!hasHistory && (
              <EmptyState title="Queue Empty" subtitle="Upload a .zip archive to begin processing." />
            )}
          </div>
        </div>

        {/* Admin System Logs */}
        <div {...cardStyle('admin-logs', 'hcd-bottom-card')}>
          <div className="hcd-card-header" onPointerDown={startDrag('admin-logs')}><span>Admin System Logs</span></div>
          <div className="hcd-table-wrap">
            {hasHistory ? (
              <ul className="hcd-log-list">
                {validationHistory.slice(0, 4).map((v, i) => (
                  <li key={i}>
                    {v.fileName} ({v.tempId})
                    <em className={v.success ? 'ok' : 'err'}>
                      {v.success ? v.message : `${v.errorCount} error(s): ${v.message}`}
                    </em>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No Activity" subtitle="Validation logs will appear here once you upload a file." />
            )}
          </div>
        </div>

        {/* Layer Legend */}
        <div {...cardStyle('layer-legend', 'hcd-bottom-card hcd-legend-card')}>
          <div className="hcd-card-header" onPointerDown={startDrag('layer-legend')}><span>Layer Legend</span></div>
          <div className="hcd-table-wrap">
            {legendEntries.length > 0 ? (
              <div className="hcd-legend-rows">
                {legendEntries.map(([name, color]) => (
                  <div className="hcd-legend-row" key={name}>
                    <span className="hcd-legend-swatch" style={{ background: color }} />
                    <span className="hcd-legend-label" title={name}>{name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<IconLayers size={20} />}
                title="No Layers Loaded"
                subtitle="Select an upload to see its layer colors."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeDashboard;
