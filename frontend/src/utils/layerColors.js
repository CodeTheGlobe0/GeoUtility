// Distinct, readable colors auto-assigned to each feature layer/class name
// returned by the uploads geojson endpoint, shared across the Home globe,
// the Data QC map, and the layer legend so all three stay in sync.
const PALETTE = [
  '#2563eb', // blue
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#eab308', // yellow
];

export const buildLayerColorMap = (geojsonData) => {
  const map = {};
  if (!geojsonData) return map;
  Object.keys(geojsonData).forEach((layerName, index) => {
    map[layerName] = PALETTE[index % PALETTE.length];
  });
  return map;
};

export const hexToRgba = (hex, alpha) => {
  const bigint = parseInt(hex.replace('#', ''), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
