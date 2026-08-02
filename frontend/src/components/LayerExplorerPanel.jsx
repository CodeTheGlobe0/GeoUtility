import React, { useState } from 'react';
import './LayerExplorerPanel.css';
import { IconChevronDown, IconChevronUp, IconChevronLeft, IconChevronRight, IconLayers } from './Icons';

const pickProp = (props, keys, fallback) => {
  for (const key of keys) {
    if (props[key] !== undefined && props[key] !== null && props[key] !== '') {
      return props[key];
    }
  }
  return fallback;
};

// Left-side floating panel for the Data QC map: lists every loaded upload
// layer (feature class) and each of its rows (feature name + id). Clicking
// a row's id zooms the map to that exact feature and highlights it.
const LayerExplorerPanel = ({ geojsonData, layerColors, onSelectFeature, selectedFeatureKey }) => {
  const [collapsedLayers, setCollapsedLayers] = useState({});
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const layerEntries = Object.entries(geojsonData || {});
  if (!layerEntries.length) return null;

  const toggleLayer = (name) => {
    setCollapsedLayers((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className={`fe-panel ${panelCollapsed ? 'collapsed' : ''}`}>
      <button
        type="button"
        className="fe-toggle-tab"
        onClick={() => setPanelCollapsed((v) => !v)}
        title={panelCollapsed ? 'Show Layer Explorer' : 'Hide Layer Explorer'}
      >
        {panelCollapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
      </button>

      {!panelCollapsed && (
        <div className="fe-panel-inner">
          <div className="fe-panel-header">
            <IconLayers size={16} />
            <span>Layer Explorer</span>
          </div>
          <div className="fe-panel-body">
            {layerEntries.map(([layerName, featureCollection]) => {
              const features = featureCollection?.features || [];
              const collapsed = !!collapsedLayers[layerName];
              return (
                <div className="fe-layer-group" key={layerName}>
                  <button type="button" className="fe-layer-header" onClick={() => toggleLayer(layerName)}>
                    <span className="fe-layer-swatch" style={{ background: layerColors?.[layerName] || '#2563eb' }} />
                    <span className="fe-layer-name" title={layerName}>{layerName}</span>
                    <span className="fe-layer-count">{features.length}</span>
                    {collapsed ? <IconChevronDown size={13} /> : <IconChevronUp size={13} />}
                  </button>

                  {!collapsed && (
                    <div className="fe-feature-list">
                      {features.map((feature, idx) => {
                        const props = feature.properties || {};
                        const name = pickProp(props, ['name', 'Name', 'NAME'], `Feature ${idx + 1}`);
                        const id = pickProp(props, ['id', 'Id', 'ID'], idx);
                        const key = `${layerName}::${idx}`;
                        const isSelected = selectedFeatureKey === key;
                        return (
                          <div className={`fe-feature-row ${isSelected ? 'selected' : ''}`} key={key}>
                            <span className="fe-feature-name" title={name}>{name}</span>
                            <button
                              type="button"
                              className="fe-feature-id-btn"
                              onClick={() => onSelectFeature?.({ layerName, index: idx, key })}
                              title={`Zoom to ${name}`}
                            >
                              {String(id)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LayerExplorerPanel;
