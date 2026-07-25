import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import Graticule from 'ol/layer/Graticule';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import Style from 'ol/style/Style';
import Text from 'ol/style/Text';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import { defaults as defaultControls } from 'ol/control';
import { fromLonLat } from 'ol/proj';
import MapLayerSwitcher from './MapLayerSwitcher';
import './MapComponent.css';

const MapComponent = ({
  activeBaseLayer,
  onBaseLayerChange,
  showGraticule,
  activeTab,
  dpsArea,
  dpsStatus,
  zoomToPlot,
}) => {
  const mapRef = useRef();
  
  // Refs to retain map and layer instances across updates
  const mapInstance = useRef(null);
  const baseLayerRef = useRef(null);
  const graticuleRef = useRef(null);
  const dpsLayerRef = useRef(null);
  const dpsSourceRef = useRef(null);

  // Initialize Map on mount
  useEffect(() => {
    const baseTile = new TileLayer({
      source: new OSM(),
    });
    baseLayerRef.current = baseTile;

    const dpsSource = new VectorSource();
    dpsSourceRef.current = dpsSource;

    const dpsLayer = new VectorLayer({
      source: dpsSource,
    });
    dpsLayerRef.current = dpsLayer;

    const map = new Map({
      target: mapRef.current,
      layers: [baseTile, dpsLayer],
      controls: defaultControls({ zoom: false, rotate: false }),
      view: new View({
        center: fromLonLat([88.3639, 22.5726]), // Default center (Kolkata)
        zoom: 12,
      }),
    });
    mapInstance.current = map;

    // Clean up map instance on unmount
    return () => {
      map.setTarget(null);
    };
  }, []);

  // Update Base Layer Source when activeBaseLayer prop changes
  useEffect(() => {
    if (!baseLayerRef.current) return;

    let newSource;
    if (activeBaseLayer === 'osm') {
      newSource = new OSM();
    } else if (activeBaseLayer === 'light') {
      newSource = new XYZ({
        url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attributions: '© OpenStreetMap contributors © CARTO',
      });
    } else if (activeBaseLayer === 'dark') {
      newSource = new XYZ({
        url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attributions: '© OpenStreetMap contributors © CARTO',
      });
    } else if (activeBaseLayer === 'satellite') {
      newSource = new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      });
    }

    baseLayerRef.current.setSource(newSource);
  }, [activeBaseLayer]);

  // Toggle Grid lines (Graticule) overlay
  useEffect(() => {
    if (!mapInstance.current) return;

    if (showGraticule) {
      if (!graticuleRef.current) {
        graticuleRef.current = new Graticule({
          strokeStyle: new Stroke({
            color: 'rgba(100, 116, 139, 0.25)',
            width: 1,
            lineDash: [2, 4],
          }),
          showLabels: true,
          wrapX: true,
        });
      }
      mapInstance.current.addLayer(graticuleRef.current);
    } else {
      if (graticuleRef.current) {
        mapInstance.current.removeLayer(graticuleRef.current);
      }
    }
  }, [showGraticule]);

  // Handle activeTab changes (Home Map vs Dubai QC Map viewports transition)
  useEffect(() => {
    if (!mapInstance.current) return;

    if (activeTab === 'data-qc') {
      // Zoom map directly to Dubai, UAE region
      mapInstance.current.getView().animate({
        center: fromLonLat([55.28, 25.04]),
        zoom: 12,
        duration: 1000,
      });
    } else {
      // Back to default home viewport (Kolkata)
      mapInstance.current.getView().animate({
        center: fromLonLat([88.3639, 22.5726]),
        zoom: 12,
        duration: 1000,
      });
      // Clear any plot overlays
      if (dpsSourceRef.current) {
        dpsSourceRef.current.clear();
      }
    }
  }, [activeTab]);

  // Render Dubai Plot geometries based on selected area and QC completion
  useEffect(() => {
    if (activeTab !== 'data-qc' || !dpsSourceRef.current || !mapInstance.current) return;

    dpsSourceRef.current.clear();

    // Only draw polygons after process completion (success or error outcome)
    if (dpsStatus === 'running' || dpsStatus === null) return;

    const featuresList = [];

    if (dpsArea === 'haven') {
      // Draw Haven plots (colored green to represent success!)
      const havenCoordinates = [
        { num: '64810860.1', coords: [[55.328, 25.048], [55.331, 25.048], [55.331, 25.046], [55.328, 25.046]] },
        { num: '6485648.1', coords: [[55.331, 25.048], [55.334, 25.048], [55.334, 25.045], [55.331, 25.045]] },
        { num: '6485648.2', coords: [[55.334, 25.048], [55.338, 25.048], [55.338, 25.043], [55.334, 25.043]] },
        { num: '6485648.3', coords: [[55.338, 25.048], [55.341, 25.048], [55.341, 25.046], [55.338, 25.046]] },
        { num: '6485648.4', coords: [[55.341, 25.048], [55.344, 25.048], [55.344, 25.046], [55.341, 25.046]] },
      ];

      havenCoordinates.forEach((p) => {
        const polyCoords = p.coords.map((coord) => fromLonLat(coord));
        // close the loop
        polyCoords.push(polyCoords[0]);

        const feature = new Feature({
          geometry: new Polygon([polyCoords]),
          number: p.num,
        });

        feature.setStyle(
          new Style({
            fill: new Fill({
              color: 'rgba(52, 211, 153, 0.45)', // Translucent Green
            }),
            stroke: new Stroke({
              color: '#10b981',
              width: 2,
            }),
            text: new Text({
              text: p.num,
              font: 'bold 9px Inter, sans-serif',
              fill: new Fill({ color: '#f8fafc' }),
              stroke: new Stroke({ color: '#000000', width: 2 }),
            }),
          })
        );

        featuresList.push(feature);
      });

      dpsSourceRef.current.addFeatures(featuresList);

      // Fit map view to Haven features
      const extent = dpsSourceRef.current.getExtent();
      mapInstance.current.getView().fit(extent, { duration: 800, padding: [100, 100, 100, 100] });

    } else if (dpsArea === 'studio-city') {
      // Draw Studio City plot with overlap error geometry (colored yellow & red!)
      const studioCityCoords = [[55.241, 25.044], [55.247, 25.044], [55.247, 25.039], [55.241, 25.039]];
      const mainPolyCoords = studioCityCoords.map((coord) => fromLonLat(coord));
      mainPolyCoords.push(mainPolyCoords[0]);

      const mainFeature = new Feature({
        geometry: new Polygon([mainPolyCoords]),
        number: '6757695.01',
      });

      mainFeature.setStyle(
        new Style({
          fill: new Fill({
            color: 'rgba(245, 158, 11, 0.5)', // Translucent Yellow/Gold
          }),
          stroke: new Stroke({
            color: '#f59e0b',
            width: 2,
          }),
          text: new Text({
            text: '6757695.01',
            font: 'bold 9px Inter, sans-serif',
            fill: new Fill({ color: '#f8fafc' }),
            stroke: new Stroke({ color: '#000000', width: 2 }),
          }),
        })
      );

      featuresList.push(mainFeature);

      // Draw overlapping error polygon (shaded red stripes!)
      const errorCoords = [[55.245, 25.041], [55.248, 25.041], [55.248, 25.038], [55.245, 25.038]];
      const errorPolyCoords = errorCoords.map((coord) => fromLonLat(coord));
      errorPolyCoords.push(errorPolyCoords[0]);

      const errorFeature = new Feature({
        geometry: new Polygon([errorPolyCoords]),
        number: 'overlap-error',
      });

      errorFeature.setStyle(
        new Style({
          fill: new Fill({
            color: 'rgba(239, 68, 68, 0.4)', // Translucent Red
          }),
          stroke: new Stroke({
            color: '#ef4444',
            width: 2,
            lineDash: [2, 4],
          }),
          text: new Text({
            text: 'Overlap Conflict',
            font: 'bold 9px Inter, sans-serif',
            fill: new Fill({ color: '#f87171' }),
            stroke: new Stroke({ color: '#000000', width: 2 }),
          }),
        })
      );

      featuresList.push(errorFeature);

      dpsSourceRef.current.addFeatures(featuresList);

      // Fit map view to Studio City features
      const extent = dpsSourceRef.current.getExtent();
      mapInstance.current.getView().fit(extent, { duration: 800, padding: [100, 100, 100, 100] });
    }
  }, [activeTab, dpsArea, dpsStatus]);

  // Zoom-to-Plot listener when clicked in the Bottom table list
  useEffect(() => {
    if (!zoomToPlot || !mapInstance.current || !dpsSourceRef.current) return;

    const features = dpsSourceRef.current.getFeatures();
    const targetFeature = features.find((f) => f.get('number') === zoomToPlot);

    if (targetFeature) {
      const geom = targetFeature.getGeometry();
      mapInstance.current.getView().fit(geom, {
        duration: 800,
        maxZoom: 16,
        padding: [100, 100, 100, 100],
      });
    }
  }, [zoomToPlot]);

  // Custom Zoom Handlers
  const handleZoomIn = () => {
    if (!mapInstance.current) return;
    const view = mapInstance.current.getView();
    const currentZoom = view.getZoom();
    if (currentZoom !== undefined) {
      view.animate({ zoom: currentZoom + 1, duration: 200 });
    }
  };

  const handleZoomOut = () => {
    if (!mapInstance.current) return;
    const view = mapInstance.current.getView();
    const currentZoom = view.getZoom();
    if (currentZoom !== undefined) {
      view.animate({ zoom: currentZoom - 1, duration: 200 });
    }
  };

  return (
    <div className="map-container">
      <div ref={mapRef} className="ol-map" />

      {/* Unified GIS Action Toolbar Card */}
      <div className="map-control-toolbar-card">
        {/* Zoom In Button */}
        <button className="toolbar-action-btn" onClick={handleZoomIn} title="Zoom In">
          ➕
        </button>
        <div className="toolbar-divider" />

        {/* Zoom Out Button */}
        <button className="toolbar-action-btn" onClick={handleZoomOut} title="Zoom Out">
          ➖
        </button>
        <div className="toolbar-divider" />

        {/* Map Layer Switcher */}
        <MapLayerSwitcher
          activeBaseLayer={activeBaseLayer}
          onBaseLayerChange={onBaseLayerChange}
        />
        <div className="toolbar-divider" />

        {/* Future Expandable Slot Placeholders */}
        <button className="toolbar-action-btn placeholder" title="Search Location (Coming Soon)" disabled>
          🔍
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-action-btn placeholder" title="Measure Distance (Coming Soon)" disabled>
          📏
        </button>
      </div>
    </div>
  );
};

export default MapComponent;
