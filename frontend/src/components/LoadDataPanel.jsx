import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_ENDPOINTS } from '../config';
import './ValidateModal.css';
import './UploadsPanel.css';
import './LoadDataPanel.css';
import { IconLayers, IconMap, IconSpreadsheet, IconSearch, IconPlus, IconClose } from './Icons';
import ComboBox from './ComboBox';

const FILTER_OPS = [
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '≥' },
  { value: '<=', label: '≤' },
  { value: 'like', label: 'contains' },
];

// Navbar-triggered panel for browsing the active GISDatabaseConnection's
// tables. Each table has its own checkbox, so any mix of layers and plain
// attribute tables can be selected and loaded together in one go: selected
// layers are merged onto the map, selected attribute tables all open in the
// simple floating table. The Layers/Tables checkboxes above the list filter
// which rows are shown (not what gets loaded).
//
// `alreadyLoaded` (a Set of table names) pre-checks whatever is currently
// showing on the map/floating table, so reopening this panel after a load
// reflects the current selection instead of starting blank.
//
// `filtersByTable`/`onFiltersByTableChange` are lifted to App.jsx rather
// than held here: this panel is conditionally mounted (unmounted on close),
// so any condition typed here would otherwise be lost the moment the panel
// closes — reopening it would show the previous selection but a blank
// filter builder. Keeping the conditions in the parent makes them survive
// close/reopen just like the checkbox selection already does.
const LoadDataPanel = ({ onClose, onLayerLoaded, onAttributeLoaded, alreadyLoaded, filtersByTable, onFiltersByTableChange }) => {
  const [tables, setTables] = useState([]);
  const [databaseKind, setDatabaseKind] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingSelected, setLoadingSelected] = useState(false);

  const [showLayers, setShowLayers] = useState(true);
  const [showTables, setShowTables] = useState(true);
  const [selected, setSelected] = useState(() => new Set(alreadyLoaded || []));

  // Only one table's filter builder is expanded at a time, to keep an
  // already dense list manageable — this part is fine to reset on reopen.
  const [expandedFilterTable, setExpandedFilterTable] = useState(null);

  // Field-dropdown options per table, and value-dropdown options per
  // "table::field" — both fetched lazily (on first need) and cached for the
  // life of this panel.
  const [columnsByTable, setColumnsByTable] = useState({});
  const [columnsLoadingTable, setColumnsLoadingTable] = useState(null);
  const [valuesByKey, setValuesByKey] = useState({});
  const [valuesLoadingKey, setValuesLoadingKey] = useState(null);

  const fetchColumns = useCallback(async (tableName) => {
    const accessToken = localStorage.getItem('accessToken');
    setColumnsLoadingTable(tableName);
    try {
      const res = await fetch(API_ENDPOINTS.LOAD_DATA_COLUMNS(tableName), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setColumnsByTable((prev) => ({ ...prev, [tableName]: data.data.columns || [] }));
      }
    } catch (err) {
      console.error(`Load columns failed for ${tableName}:`, err);
    } finally {
      setColumnsLoadingTable(null);
    }
  }, []);

  const fetchValues = useCallback((tableName, field) => {
    if (!field || !field.trim()) return;
    const key = `${tableName}::${field}`;
    setValuesByKey((prev) => {
      if (prev[key]) return prev; // already cached
      (async () => {
        const accessToken = localStorage.getItem('accessToken');
        setValuesLoadingKey(key);
        try {
          const res = await fetch(API_ENDPOINTS.LOAD_DATA_VALUES(tableName, field), {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const data = await res.json();
          if (data.success) {
            setValuesByKey((p) => ({ ...p, [key]: data.data.values || [] }));
          }
        } catch (err) {
          console.error(`Load values failed for ${key}:`, err);
        } finally {
          setValuesLoadingKey(null);
        }
      })();
      return prev;
    });
  }, []);

  const toggleFilterBuilder = (tableName) => {
    setExpandedFilterTable((prev) => (prev === tableName ? null : tableName));
    if (!columnsByTable[tableName]) fetchColumns(tableName);
  };

  const addCondition = (tableName) => {
    onFiltersByTableChange({
      ...filtersByTable,
      [tableName]: [...(filtersByTable[tableName] || []), { field: '', op: '=', value: '' }],
    });
  };

  const updateCondition = (tableName, index, patch) => {
    onFiltersByTableChange({
      ...filtersByTable,
      [tableName]: (filtersByTable[tableName] || []).map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });
  };

  const removeCondition = (tableName, index) => {
    onFiltersByTableChange({
      ...filtersByTable,
      [tableName]: (filtersByTable[tableName] || []).filter((_, i) => i !== index),
    });
  };

  const fetchTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accessToken = localStorage.getItem('accessToken');
      const res = await fetch(API_ENDPOINTS.LOAD_DATA, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setTables(data.data.tables || []);
        setDatabaseKind(data.data.database_kind || null);
      } else {
        const msgs = data.errors ? Object.values(data.errors).flat() : [data.message];
        setError(msgs.join(' '));
      }
    } catch (err) {
      console.error('Load tables error:', err);
      setError('Connection failure. Unable to reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const filteredTables = tables.filter((t) =>
    (t.level === 'layer' && showLayers) || (t.level === 'attribute' && showTables)
  );

  const toggleSelected = (tableName) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return next;
    });
  };

  const allFilteredSelected = filteredTables.length > 0 && filteredTables.every((t) => selected.has(t.table));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredTables.forEach((t) => next.delete(t.table));
      } else {
        filteredTables.forEach((t) => next.add(t.table));
      }
      return next;
    });
  };

  const selectedCount = useMemo(
    () => tables.filter((t) => selected.has(t.table)).length,
    [tables, selected]
  );

  const handleLoadSelected = async () => {
    // No early-return on an empty selection: unchecking everything and
    // hitting this button is how the map/floating table get cleared —
    // an empty result still gets sent to the "loaded" callbacks below.
    const items = tables.filter((t) => selected.has(t.table));

    setLoadingSelected(true);
    setError(null);
    const accessToken = localStorage.getItem('accessToken');
    const layers = {};
    const attributeTables = [];
    const failures = [];

    await Promise.all(items.map(async (t) => {
      try {
        // Blank field/value rows are dropped rather than sent — a
        // half-filled condition shouldn't silently filter the whole table.
        const conditions = (filtersByTable[t.table] || []).filter((c) => c.field.trim() && c.value.trim());
        const res = await fetch(API_ENDPOINTS.LOAD_DATA_TABLE(t.table, conditions), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (data.success) {
          if (data.data.level === 'layer') {
            layers[t.table] = data.data.geojson;
          } else {
            attributeTables.push({ table: t.table, records: data.data.records });
          }
        } else {
          const msgs = data.errors ? Object.values(data.errors).flat() : [data.message];
          failures.push(`${t.table}: ${msgs.join(' ')}`);
        }
      } catch (err) {
        console.error(`Load table data failed for ${t.table}:`, err);
        failures.push(`${t.table}: connection failure.`);
      }
    }));

    setLoadingSelected(false);

    // Always call both, even with an empty result: that's what tells App.jsx
    // to clear the map/floating table when nothing of that kind is checked.
    onLayerLoaded?.(layers);
    onAttributeLoaded?.(attributeTables);

    if (failures.length > 0) {
      setError(failures.join(' | '));
    } else {
      onClose();
    }
  };

  return (
    <div className="vmodal-overlay" onClick={onClose}>
      <div className="vmodal-card uplist-card" onClick={(e) => e.stopPropagation()}>
        <button className="vmodal-close" onClick={onClose}>&times;</button>

        <div className="vmodal-header">
          <span>Load Live Data</span>
          <IconLayers size={16} />
        </div>
        <p className="vmodal-subtitle">
          Check any mix of layers and tables below, then load them all at once
          {databaseKind && <> · detected as <strong>{databaseKind === 'ARCGIS' ? 'ArcGIS geodatabase' : 'standard spatial database'}</strong></>}
        </p>

        <div className="ldp-filter-row">
          <label className="ldp-filter-checkbox">
            <input type="checkbox" checked={showLayers} onChange={(e) => setShowLayers(e.target.checked)} />
            <IconMap size={13} /> Layers
          </label>
          <label className="ldp-filter-checkbox">
            <input type="checkbox" checked={showTables} onChange={(e) => setShowTables(e.target.checked)} />
            <IconSpreadsheet size={13} /> Tables
          </label>
          <button type="button" className="ldp-refresh-btn" onClick={fetchTables} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && <div className="vmodal-alert error">{error}</div>}

        <div className="uplist-body">
          {loading ? (
            <div className="uplist-empty">Loading tables from the active database...</div>
          ) : filteredTables.length === 0 ? (
            <div className="uplist-empty">
              {tables.length === 0 ? 'No tables found on the active database.' : 'No tables match the selected filters.'}
            </div>
          ) : (
            <>
              <label className="ldp-select-all">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} />
                Select all shown ({filteredTables.length})
              </label>
              <ul className="ldp-table-list">
                {filteredTables.map((t) => {
                  const conditions = filtersByTable[t.table] || [];
                  const isExpanded = expandedFilterTable === t.table;
                  return (
                    <li key={t.table} className="ldp-table-row-wrap">
                      <div className="ldp-table-row">
                        <label className="ldp-row-checkbox">
                          <input
                            type="checkbox"
                            checked={selected.has(t.table)}
                            onChange={() => toggleSelected(t.table)}
                          />
                        </label>
                        <div className="ldp-table-info">
                          <span className="ldp-table-name">{t.table}</span>
                          <span className={`ldp-level-badge ${t.level}`}>
                            {t.level === 'layer'
                              ? <><IconMap size={11} /> Layer{t.geometry_type ? ` · ${t.geometry_type}` : ''}</>
                              : <><IconSpreadsheet size={11} /> Attribute Table</>}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={`ldp-filter-toggle ${conditions.length > 0 ? 'active' : ''}`}
                          onClick={() => toggleFilterBuilder(t.table)}
                          title="Filter rows by attribute value"
                        >
                          <IconSearch size={13} />
                          {conditions.length > 0 && <span className="ldp-filter-count">{conditions.length}</span>}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="ldp-filter-builder">
                          {conditions.length === 0 ? (
                            <p className="ldp-filter-hint">No conditions yet — only checked rows matching all conditions below will load.</p>
                          ) : (
                            <>
                              {conditions.map((c, idx) => {
                                const valuesKey = `${t.table}::${c.field}`;
                                return (
                                  <div key={idx} className="ldp-condition-row">
                                    <ComboBox
                                      className="ldp-condition-field"
                                      placeholder="field, e.g. name"
                                      value={c.field}
                                      options={columnsByTable[t.table] || []}
                                      loading={columnsLoadingTable === t.table}
                                      onFocus={() => { if (!columnsByTable[t.table]) fetchColumns(t.table); }}
                                      onChange={(v) => updateCondition(t.table, idx, { field: v })}
                                    />
                                    <select
                                      className="ldp-condition-op"
                                      value={c.op}
                                      onChange={(e) => updateCondition(t.table, idx, { op: e.target.value })}
                                    >
                                      {FILTER_OPS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                      ))}
                                    </select>
                                    <ComboBox
                                      className="ldp-condition-value"
                                      placeholder="value, e.g. Telangana"
                                      value={c.value}
                                      options={valuesByKey[valuesKey] || []}
                                      loading={valuesLoadingKey === valuesKey}
                                      onFocus={() => fetchValues(t.table, c.field)}
                                      onChange={(v) => updateCondition(t.table, idx, { value: v })}
                                    />
                                    <button
                                      type="button"
                                      className="ldp-condition-remove"
                                      onClick={() => removeCondition(t.table, idx)}
                                      title="Remove condition"
                                    >
                                      <IconClose size={12} />
                                    </button>
                                  </div>
                                );
                              })}
                              <p className="ldp-filter-hint">All conditions combined with AND.</p>
                            </>
                          )}
                          <button
                            type="button"
                            className="ldp-add-condition-btn"
                            onClick={() => addCondition(t.table)}
                          >
                            <IconPlus size={12} /> Add condition
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {tables.length > 0 && (
          <div className="ldp-load-selected-bar">
            <span>{selectedCount} selected</span>
            <button
              type="button"
              className="ldp-load-selected-btn"
              onClick={handleLoadSelected}
              disabled={loadingSelected}
              title={selectedCount === 0 ? 'Unchecking everything and clicking this removes it from the map/table' : undefined}
            >
              {loadingSelected
                ? `${selectedCount === 0 ? 'Unloading' : `Loading ${selectedCount} item(s)`}...`
                : selectedCount === 0 ? 'Unload All' : `Load Selected (${selectedCount})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadDataPanel;
