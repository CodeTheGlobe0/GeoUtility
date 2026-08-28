import React, { useState } from 'react';
import './SimpleDataTable.css';
import { IconSpreadsheet, IconChevronUp, IconChevronDown, IconClose } from './Icons';

// Floating bottom panel showing plain (non-spatial) database table(s) loaded
// via the "Load Live Data" flow — a lightweight table, not a map layer.
// Accepts multiple tables (e.g. a batch selection) and shows them as tabs.
const SimpleDataTable = ({ tables, onClose }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!tables || tables.length === 0) return null;

  const active = tables[Math.min(activeIndex, tables.length - 1)];
  const columns = active.records.length > 0 ? Object.keys(active.records[0]) : [];

  return (
    <div className={`sdt-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="sdt-header">
        <div className="sdt-header-tabs">
          {tables.length > 1 ? (
            tables.map((t, idx) => (
              <button
                key={t.table}
                type="button"
                className={`sdt-tab ${idx === activeIndex ? 'active' : ''}`}
                onClick={() => setActiveIndex(idx)}
              >
                <IconSpreadsheet size={13} /> {t.table}
              </button>
            ))
          ) : (
            <span className="sdt-header-title">
              <IconSpreadsheet size={15} /> {active.table}
            </span>
          )}
          <span className="sdt-row-count">{active.records.length} row{active.records.length === 1 ? '' : 's'}</span>
        </div>
        <div className="sdt-header-actions">
          <button type="button" className="sdt-icon-btn" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <IconChevronUp size={15} /> : <IconChevronDown size={15} />}
          </button>
          <button type="button" className="sdt-icon-btn" onClick={onClose} title="Close">
            <IconClose size={15} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="sdt-body">
          {columns.length === 0 ? (
            <div className="sdt-empty">This table has no rows.</div>
          ) : (
            <table className="sdt-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.records.map((row, idx) => (
                  <tr key={idx}>
                    {columns.map((col) => (
                      <td key={col}>{row[col] === null || row[col] === undefined ? '—' : String(row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default SimpleDataTable;
