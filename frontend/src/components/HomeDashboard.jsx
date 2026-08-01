import React from 'react';
import './HomeDashboard.css';
import { IconCheckCircle, IconUpload, IconMapPin, IconLayers } from './Icons';

const EmptyState = ({ icon, title, subtitle }) => (
  <div className="hcd-empty-state">
    {icon}
    <span className="hcd-empty-title">{title}</span>
    {subtitle && <span className="hcd-empty-subtitle">{subtitle}</span>}
  </div>
);

const formatTime = (date) =>
  date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const HomeDashboard = ({ onUploadClick, selectedFeature, validationHistory = [] }) => {
  const hasHistory = validationHistory.length > 0;
  const successCount = validationHistory.filter((v) => v.success).length;
  const failCount = validationHistory.length - successCount;
  const scorePct = hasHistory ? Math.round((successCount / validationHistory.length) * 100) : null;

  const maxBar = Math.max(validationHistory.length, successCount, failCount, 1);

  return (
    <div className="hcd-overlay">
      {/* Left column */}
      <div className="hcd-col hcd-col-left">
        <div className="hcd-card hcd-card-accent hcd-card-sm">
          <div className="hcd-card-header">
            <span>Total Validations</span>
            <IconCheckCircle size={16} />
          </div>
          <div className="hcd-big-number">{validationHistory.length.toLocaleString()}</div>
          {hasHistory ? (
            <div className="hcd-progress-track"><div className="hcd-progress-fill" style={{ width: `${scorePct}%` }} /></div>
          ) : (
            <span className="hcd-hint">No validations run yet</span>
          )}
        </div>

        {/* Attribute & Feature Info Card */}
        <div className="hcd-card hcd-card-lg">
          <div className="hcd-card-header">
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
        <div className="hcd-card hcd-card-sm">
          <div className="hcd-card-header"><span>System Health Monitor</span></div>
          <ul className="hcd-check-list">
            <li><IconCheckCircle size={13} /> Recognized GIS</li>
            <li><IconCheckCircle size={13} /> Processed</li>
          </ul>
        </div>

        {/* Schema Scorecard / Geometry Charts */}
        <div className="hcd-card hcd-card-accent hcd-card-lg">
          <div className="hcd-card-header"><span>Schema Compliance</span></div>
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
        <div className="hcd-card hcd-bottom-card">
          <div className="hcd-card-header"><span>Processing Queue</span></div>
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
        <div className="hcd-card hcd-bottom-card">
          <div className="hcd-card-header"><span>Admin System Logs</span></div>
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

        {/* Active Map Registry */}
        <div className="hcd-card hcd-bottom-card">
          <div className="hcd-card-header"><span>Active Map Registry</span></div>
          <div className="hcd-table-wrap">
            <table className="hcd-table hcd-table-fixed">
              <thead className={!hasHistory ? 'hcd-thead-dim' : ''}>
                <tr><th>Name</th><th>Type</th></tr>
              </thead>
              <tbody>
                {hasHistory
                  ? validationHistory
                      .filter((v) => v.success)
                      .slice(0, 3)
                      .map((v, i) => (
                        <tr key={i}><td>{v.fileName}</td><td>{v.fileType.toUpperCase()}</td></tr>
                      ))
                  : null}
              </tbody>
            </table>
            {!hasHistory && (
              <EmptyState icon={<IconLayers size={20} />} title="No Maps Registered" subtitle="Validated uploads appear here." />
            )}
          </div>
          <button className="hcd-upload-btn" onClick={onUploadClick}>
            <IconUpload size={13} /> Upload GIS ZIP Archive
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomeDashboard;
