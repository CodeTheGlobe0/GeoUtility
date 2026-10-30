import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import Graticule from "ol/layer/Graticule";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import Style from "ol/style/Style";
import CircleStyle from "ol/style/Circle";
import Text from "ol/style/Text";
import Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import { IconPlus, IconMinus, IconSearch, IconUpload, IconChevronUp, IconChevronDown } from "./Icons";
import Polygon from "ol/geom/Polygon";
import { defaults as defaultControls } from "ol/control";
import { defaults as defaultInteractions } from "ol/interaction";
import { fromLonLat, transformExtent } from "ol/proj";
import Point from "ol/geom/Point";
import MapLayerSwitcher from "./MapLayerSwitcher";
import LayerLegend from "./LayerLegend";
import LayerExplorerPanel from "./LayerExplorerPanel";
import FeatureAttributePopup from "./FeatureAttributePopup";
import ProjectionBadge from "./ProjectionBadge";
import LocationSearch from "./LocationSearch";
import { hexToRgba } from "../utils/layerColors";
import "./MapComponent.css";

const pickFeatureName = (feature) => {
  const props = feature.getProperties();
  return props.name || props.Name || props.NAME || feature.get("__layer") || "Feature";
};

// Style for one uploaded feature: differentiate by geometry type (GDB/SHP
// sources can carry points, lines, or polygons) and color by the feature's
// source layer/class, matching the legend and the Home globe. Wide stroke +
// brighter fill so a thin low-opacity overlay doesn't get lost against
// similarly-colored basemap imagery at continent/world-scale zoom.
const styleForUploadFeature = (geomType, color) => {
  if (geomType === "Point" || geomType === "MultiPoint") {
    return new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: "#ffffff", width: 1.5 }),
      }),
    });
  }
  if (geomType === "LineString" || geomType === "MultiLineString") {
    return new Style({
      stroke: new Stroke({ color, width: 4 }),
    });
  }
  return new Style({
    fill: new Fill({ color: hexToRgba(color, 0.45) }),
    stroke: new Stroke({ color, width: 3 }),
  });
};

// Highlight style applied to whichever feature is selected from the Layer
// Explorer panel, distinct from every layer's own color so it stands out
// regardless of which layer it belongs to.
const styleForSelectedFeature = (geomType) => {
  if (geomType === "Point" || geomType === "MultiPoint") {
    return new Style({
      image: new CircleStyle({
        radius: 9,
        fill: new Fill({ color: "#facc15" }),
        stroke: new Stroke({ color: "#000000", width: 2 }),
      }),
    });
  }
  if (geomType === "LineString" || geomType === "MultiLineString") {
    return new Style({ stroke: new Stroke({ color: "#facc15", width: 6 }) });
  }
  return new Style({
    fill: new Fill({ color: "rgba(250, 204, 21, 0.45)" }),
    stroke: new Stroke({ color: "#facc15", width: 5 }),
  });
};

const MapComponent = ({
  onUploadsClick,
  activeBaseLayer,
  onBaseLayerChange,
  showGraticule,
  dpsArea,
  dpsStatus,
  zoomToPlot,
  geojsonData,
  layerColors,
}) => {
  const mapRef = useRef();

  // Refs to retain map and layer instances across updates
  const mapInstance = useRef(null);
  const baseLayerRef = useRef(null);
  const graticuleRef = useRef(null);
  const dpsLayerRef = useRef(null);
  const dpsSourceRef = useRef(null);
  const uploadLayerRef = useRef(null);
  const uploadSourceRef = useRef(null);
  // { [layerName]: OlFeature[] } — same instances added to uploadSourceRef,
  // in the same order as their source FeatureCollection, so the Layer
  // Explorer panel's (layerName, index) selection can look up the exact
  // feature to highlight/zoom to.
  const layerFeaturesRef = useRef({});
  const selectedFeatureRef = useRef(null);
  const [selectedExplorerKey, setSelectedExplorerKey] = useState(null);
  const [featurePopup, setFeaturePopup] = useState(null);

  // Map controls toolbar can be collapsed to just its toggle; remembered per browser
  const [controlsOpen, setControlsOpen] = useState(() => {
    try {
      return localStorage.getItem("mapControlsOpen") !== "false";
    } catch {
      return true;
    }
  });
  // Location search (toolbar Search button); the picked place gets a pin
  const [searchOpen, setSearchOpen] = useState(false);
  const searchPinLayerRef = useRef(null);

  const handlePlaceSelect = (place) => {
    const map = mapInstance.current;
    if (!map) return;
    const lon = parseFloat(place.lon);
    const lat = parseFloat(place.lat);
    const view = map.getView();

    // Nominatim boundingbox = [south, north, west, east] as strings
    const bb = (place.boundingbox || []).map(parseFloat);
    if (bb.length === 4 && bb.every(Number.isFinite)) {
      const extent = transformExtent([bb[2], bb[0], bb[3], bb[1]], "EPSG:4326", view.getProjection());
      view.fit(extent, { duration: 900, padding: [80, 80, 80, 80], maxZoom: 17 });
    } else {
      view.animate({ center: fromLonLat([lon, lat]), zoom: 15, duration: 900 });
    }

    if (!searchPinLayerRef.current) {
      searchPinLayerRef.current = new VectorLayer({
        source: new VectorSource(),
        zIndex: 999,
        style: new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: "#2563eb" }),
            stroke: new Stroke({ color: "#ffffff", width: 3 }),
          }),
        }),
      });
      map.addLayer(searchPinLayerRef.current);
    }
    const source = searchPinLayerRef.current.getSource();
    source.clear();
    source.addFeature(new Feature({ geometry: new Point(fromLonLat([lon, lat])) }));
  };

  const closeSearch = () => {
    setSearchOpen(false);
    searchPinLayerRef.current?.getSource().clear();
  };

  const toggleControls = () =>
    setControlsOpen((open) => {
      try {
        localStorage.setItem("mapControlsOpen", String(!open));
      } catch {
        // storage unavailable: still toggles for this session
      }
      return !open;
    });
  // Kept in sync via effect so the map's click handlers (registered once on
  // mount) always read the current layer colors, not a stale closure.
  const layerColorsRef = useRef(layerColors);

  useEffect(() => {
    layerColorsRef.current = layerColors;
  }, [layerColors]);

  // Topmost uploaded (non-DPS) feature under a given pixel, or null.
  const findUploadFeatureAt = (map, pixel) => {
    let found = null;
    map.forEachFeatureAtPixel(
      pixel,
      (feature, layer) => {
        if (layer === uploadLayerRef.current) {
          found = feature;
          return true;
        }
        return false;
      },
      { hitTolerance: 3 },
    );
    return found;
  };

  // Restores the previously-selected feature's normal layer color and
  // highlights the given one. Shared by direct map clicks and the Layer
  // Explorer panel so both stay in sync.
  const selectFeature = (feature) => {
    if (!feature) return;
    if (selectedFeatureRef.current && selectedFeatureRef.current !== feature) {
      const prev = selectedFeatureRef.current;
      const prevColor = layerColorsRef.current?.[prev.get("__layer")] || "#2563eb";
      prev.setStyle(styleForUploadFeature(prev.getGeometry()?.getType(), prevColor));
    }

    feature.setStyle(styleForSelectedFeature(feature.getGeometry()?.getType()));
    selectedFeatureRef.current = feature;

    const layerName = feature.get("__layer");
    const index = layerFeaturesRef.current[layerName]?.indexOf(feature);
    if (layerName && index !== undefined && index >= 0) {
      setSelectedExplorerKey(`${layerName}::${index}`);
    }
  };

  // Initialize Map on mount (this component only mounts for the Data QC tab)
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

    const uploadSource = new VectorSource();
    uploadSourceRef.current = uploadSource;

    const uploadLayer = new VectorLayer({
      source: uploadSource,
    });
    uploadLayerRef.current = uploadLayer;

    const map = new Map({
      target: mapRef.current,
      layers: [baseTile, dpsLayer, uploadLayer],
      controls: defaultControls({ zoom: false, rotate: false }),
      // Double-click is repurposed to show a feature's attribute popup
      // instead of the default zoom-in.
      interactions: defaultInteractions({ doubleClickZoom: false }),
      // Neutral whole-world view — no auto-zoom to any fixed coordinate on
      // load. The view only moves once an upload is actually selected (see
      // the geojsonData effect below).
      view: new View({
        center: fromLonLat([0, 20]),
        zoom: 2,
      }),
    });
    mapInstance.current = map;

    // Single-click an uploaded feature to select/highlight it (mirrors
    // clicking its row in the Layer Explorer panel, minus the zoom); a
    // second click within the double-click window instead opens its
    // attribute popup (see interactions above and the dblclick handler below).
    map.on("singleclick", (evt) => {
      const feature = findUploadFeatureAt(map, evt.pixel);
      if (feature) {
        selectFeature(feature);
      }
    });

    map.on("dblclick", (evt) => {
      const feature = findUploadFeatureAt(map, evt.pixel);
      if (feature) {
        selectFeature(feature);
        // Flip below the click point when too close to the top for the
        // popup (which opens upward by default) to fit on screen.
        const placement = evt.pixel[1] < 220 ? "below" : "above";
        setFeaturePopup({
          x: evt.pixel[0],
          y: evt.pixel[1],
          placement,
          name: pickFeatureName(feature),
          properties: feature.getProperties(),
        });
      } else {
        setFeaturePopup(null);
      }
    });

    // Clean up map instance on unmount
    return () => {
      map.setTarget(null);
    };
  }, []);

  // Update Base Layer Source when activeBaseLayer prop changes
  useEffect(() => {
    if (!baseLayerRef.current) return;

    let newSource;
    if (activeBaseLayer === "osm") {
      newSource = new OSM();
    } else if (activeBaseLayer === "light") {
      newSource = new XYZ({
        url: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attributions: "© OpenStreetMap contributors © CARTO",
      });
    } else if (activeBaseLayer === "dark") {
      newSource = new XYZ({
        url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attributions: "© OpenStreetMap contributors © CARTO",
      });
    } else if (activeBaseLayer === "satellite") {
      newSource = new XYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attributions:
          "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
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
            color: "rgba(100, 116, 139, 0.25)",
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

  // Render Dubai Plot geometries based on selected area and QC completion
  useEffect(() => {
    if (!dpsSourceRef.current || !mapInstance.current) return;

    dpsSourceRef.current.clear();

    // Only draw polygons after process completion (success or error outcome)
    if (dpsStatus === "running" || dpsStatus === null) return;

    const featuresList = [];

    if (dpsArea === "haven") {
      // Draw Haven plots (colored green to represent success!)
      const havenCoordinates = [
        {
          num: "64810860.1",
          coords: [
            [55.328, 25.048],
            [55.331, 25.048],
            [55.331, 25.046],
            [55.328, 25.046],
          ],
        },
        {
          num: "6485648.1",
          coords: [
            [55.331, 25.048],
            [55.334, 25.048],
            [55.334, 25.045],
            [55.331, 25.045],
          ],
        },
        {
          num: "6485648.2",
          coords: [
            [55.334, 25.048],
            [55.338, 25.048],
            [55.338, 25.043],
            [55.334, 25.043],
          ],
        },
        {
          num: "6485648.3",
          coords: [
            [55.338, 25.048],
            [55.341, 25.048],
            [55.341, 25.046],
            [55.338, 25.046],
          ],
        },
        {
          num: "6485648.4",
          coords: [
            [55.341, 25.048],
            [55.344, 25.048],
            [55.344, 25.046],
            [55.341, 25.046],
          ],
        },
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
              color: "rgba(52, 211, 153, 0.45)", // Translucent Green
            }),
            stroke: new Stroke({
              color: "#10b981",
              width: 2,
            }),
            text: new Text({
              text: p.num,
              font: "bold 9px Inter, sans-serif",
              fill: new Fill({ color: "#f8fafc" }),
              stroke: new Stroke({ color: "#000000", width: 2 }),
            }),
          }),
        );

        featuresList.push(feature);
      });

      dpsSourceRef.current.addFeatures(featuresList);

      // Fit map view to Haven features
      const extent = dpsSourceRef.current.getExtent();
      mapInstance.current
        .getView()
        .fit(extent, { duration: 800, padding: [100, 100, 100, 100] });
    } else if (dpsArea === "studio-city") {
      // Draw Studio City plot with overlap error geometry (colored yellow & red!)
      const studioCityCoords = [
        [55.241, 25.044],
        [55.247, 25.044],
        [55.247, 25.039],
        [55.241, 25.039],
      ];
      const mainPolyCoords = studioCityCoords.map((coord) => fromLonLat(coord));
      mainPolyCoords.push(mainPolyCoords[0]);

      const mainFeature = new Feature({
        geometry: new Polygon([mainPolyCoords]),
        number: "6757695.01",
      });

      mainFeature.setStyle(
        new Style({
          fill: new Fill({
            color: "rgba(245, 158, 11, 0.5)", // Translucent Yellow/Gold
          }),
          stroke: new Stroke({
            color: "#f59e0b",
            width: 2,
          }),
          text: new Text({
            text: "6757695.01",
            font: "bold 9px Inter, sans-serif",
            fill: new Fill({ color: "#f8fafc" }),
            stroke: new Stroke({ color: "#000000", width: 2 }),
          }),
        }),
      );

      featuresList.push(mainFeature);

      // Draw overlapping error polygon (shaded red stripes!)
      const errorCoords = [
        [55.245, 25.041],
        [55.248, 25.041],
        [55.248, 25.038],
        [55.245, 25.038],
      ];
      const errorPolyCoords = errorCoords.map((coord) => fromLonLat(coord));
      errorPolyCoords.push(errorPolyCoords[0]);

      const errorFeature = new Feature({
        geometry: new Polygon([errorPolyCoords]),
        number: "overlap-error",
      });

      errorFeature.setStyle(
        new Style({
          fill: new Fill({
            color: "rgba(239, 68, 68, 0.4)", // Translucent Red
          }),
          stroke: new Stroke({
            color: "#ef4444",
            width: 2,
            lineDash: [2, 4],
          }),
          text: new Text({
            text: "Overlap Conflict",
            font: "bold 9px Inter, sans-serif",
            fill: new Fill({ color: "#f87171" }),
            stroke: new Stroke({ color: "#000000", width: 2 }),
          }),
        }),
      );

      featuresList.push(errorFeature);

      dpsSourceRef.current.addFeatures(featuresList);

      // Fit map view to Studio City features
      const extent = dpsSourceRef.current.getExtent();
      mapInstance.current
        .getView()
        .fit(extent, { duration: 800, padding: [100, 100, 100, 100] });
    }
  }, [dpsArea, dpsStatus]);

  // Render the selected upload's GeoJSON (one FeatureCollection per layer/
  // feature-class in the response) and fit the view to its combined extent
  useEffect(() => {
    if (!uploadSourceRef.current || !mapInstance.current) return;

    uploadSourceRef.current.clear();
    layerFeaturesRef.current = {};
    selectedFeatureRef.current = null;
    setSelectedExplorerKey(null);
    setFeaturePopup(null);
    if (!geojsonData) return;

    const format = new GeoJSON();
    const allFeatures = [];

    Object.entries(geojsonData).forEach(([layerName, featureCollection]) => {
      if (!featureCollection || !featureCollection.features) return;
      const color = layerColors?.[layerName] || "#2563eb";
      const features = format.readFeatures(featureCollection, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      features.forEach((feature, idx) => {
        feature.setStyle(styleForUploadFeature(feature.getGeometry()?.getType(), color));
        feature.set("__layer", layerName);
        // Each layer is read from its own GeoDataFrame on the backend, so
        // GeoJSON ids (0, 1, 2...) restart per layer. Once merged into one
        // shared VectorSource, that collides across layers — e.g. every
        // single-feature country and India's first state all end up with id
        // 0 — and OL silently keeps only the first feature added per id,
        // dropping the rest. Force a globally-unique id before adding.
        feature.setId(`${layerName}::${idx}`);
      });
      layerFeaturesRef.current[layerName] = features;
      allFeatures.push(...features);
    });

    if (!allFeatures.length) return;

    uploadSourceRef.current.addFeatures(allFeatures);

    const extent = uploadSourceRef.current.getExtent();
    mapInstance.current.getView().fit(extent, {
      duration: 800,
      maxZoom: 18,
      padding: [100, 100, 100, 100],
    });
  }, [geojsonData]);

  // Zoom-to-Plot listener when clicked in the Bottom table list
  useEffect(() => {
    if (!zoomToPlot || !mapInstance.current || !dpsSourceRef.current) return;

    const features = dpsSourceRef.current.getFeatures();
    const targetFeature = features.find((f) => f.get("number") === zoomToPlot);

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

  // Layer Explorer row click: highlight the picked feature and zoom to it.
  const handleExplorerSelect = ({ layerName, index }) => {
    const feature = layerFeaturesRef.current[layerName]?.[index];
    if (!feature || !mapInstance.current) return;

    selectFeature(feature);

    const geometry = feature.getGeometry();
    if (geometry) {
      mapInstance.current.getView().fit(geometry.getExtent(), {
        duration: 600,
        maxZoom: 14,
        padding: [100, 100, 100, 100],
      });
    }
  };

  return (
    <div className="map-container">
      <div ref={mapRef} className="ol-map" />

      {/* Unified GIS Action Toolbar Card */}
      <div className={`map-control-toolbar-card ${controlsOpen ? "" : "collapsed"}`}>
        {/* Show / hide the rest of the map controls */}
        <button
          className="toolbar-action-btn toolbar-toggle-btn"
          onClick={toggleControls}
          title={controlsOpen ? "Hide map controls" : "Show map controls"}
          aria-expanded={controlsOpen}
        >
          {controlsOpen ? <IconChevronUp size={17} /> : <IconChevronDown size={17} />}
        </button>

        {controlsOpen && (
        <>
        <div className="toolbar-divider" />

        {/* GIS Data Uploads panel trigger */}
        <button
          className="toolbar-action-btn"
          onClick={onUploadsClick}
          title="GIS Data Uploads"
        >
          <IconUpload size={17} />
        </button>
        <div className="toolbar-divider" />

        {/* Zoom In Button */}
        <button
          className="toolbar-action-btn"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <IconPlus size={17} />
        </button>
        <div className="toolbar-divider" />

        {/* Zoom Out Button */}
        <button
          className="toolbar-action-btn"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <IconMinus size={17} />
        </button>
        <div className="toolbar-divider" />

        {/* Map Layer Switcher */}
        <MapLayerSwitcher
          activeBaseLayer={activeBaseLayer}
          onBaseLayerChange={onBaseLayerChange}
        />
        <div className="toolbar-divider" />

        {/* Search a place on the web and zoom to it */}
        <button
          className={`toolbar-action-btn ${searchOpen ? "active" : ""}`}
          title="Search Location"
          onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          aria-expanded={searchOpen}
        >
          <IconSearch size={17} />
        </button>
        </>
        )}
      </div>

      {searchOpen && controlsOpen && <LocationSearch onSelect={handlePlaceSelect} onClose={closeSearch} />}

      <LayerLegend layerColors={layerColors} className="map-layer-legend" />

      <ProjectionBadge visible={!!geojsonData} className="map-projection-badge" />

      <LayerExplorerPanel
        geojsonData={geojsonData}
        layerColors={layerColors}
        onSelectFeature={handleExplorerSelect}
        selectedFeatureKey={selectedExplorerKey}
      />

      {featurePopup && (
        <FeatureAttributePopup
          x={featurePopup.x}
          y={featurePopup.y}
          placement={featurePopup.placement}
          name={featurePopup.name}
          properties={featurePopup.properties}
          onClose={() => setFeaturePopup(null)}
        />
      )}
    </div>
  );
};

export default MapComponent;
