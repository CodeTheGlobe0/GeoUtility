import React, { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./CesiumGlobe.css";
import { IconGlobe, IconMap, IconUpload, IconSearch } from "./Icons";
import LocationSearch from "./LocationSearch";
import ProjectionBadge from "./ProjectionBadge";

const KMZ_URL = "/AGI_HQ.kmz";

// No Cesium ion account needed: Esri/ArcGIS World Imagery is a free, no-API-key
// satellite service — the same one already used for the Data QC map's
// "Satellite" basemap in MapComponent.jsx.
const buildImageryProvider = () =>
  new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit: "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    maximumLevel: 19,
  });

// Computes a simple lon/lat bounding rectangle straight from raw GeoJSON
// coordinates. Used instead of Cesium's entity-based flyTo(), whose 3D
// bounding-sphere framing degenerates for features spread across more than
// a hemisphere (e.g. country polygons on different continents) — the
// resulting "center" can land somewhere with no data in it at all.
const computeLonLatExtent = (geojsonData) => {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const visitCoords = (coords) => {
    if (typeof coords[0] === "number") {
      const [lon, lat] = coords;
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      return;
    }
    coords.forEach(visitCoords);
  };

  Object.values(geojsonData || {}).forEach((featureCollection) => {
    (featureCollection?.features || []).forEach((feature) => {
      if (feature?.geometry?.coordinates) {
        visitCoords(feature.geometry.coordinates);
      }
    });
  });

  return Number.isFinite(west) ? { west, south, east, north } : null;
};

// Convert a Cesium Entity's KML properties/description into a plain object
// suitable for rendering in the React Attribute Inspector card.
const extractFeatureAttributes = (entity) => {
  const attrs = {};

  if (entity.properties) {
    const names = entity.properties.propertyNames || [];
    names.forEach((name) => {
      try {
        const value = entity.properties[name]?.getValue
          ? entity.properties[name].getValue()
          : entity.properties[name];
        if (
          value !== undefined &&
          value !== null &&
          typeof value !== "object"
        ) {
          attrs[name] = value;
        }
      } catch {
        // Skip properties that fail to resolve
      }
    });
  }

  return attrs;
};

const CesiumGlobe = ({ onFeatureSelect, onUploadsClick, geojsonData, layerColors, paused = false }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const uploadDataSourcesRef = useRef([]);
  // Kept in a ref so the (mount-once) viewer effect can call the latest
  // callback without needing to re-run and rebuild the whole Cesium viewer.
  const onFeatureSelectRef = useRef(onFeatureSelect);
  const uploadExtentRef = useRef(null);
  // Lets full-screen overlays (Admin Dashboard, etc.) that sit on top of but
  // don't actually resize this container tell the globe to stop rendering —
  // otherwise Cesium keeps burning CPU/GPU on a completely hidden globe,
  // which is what was causing the whole app to feel laggy while those were open.
  const pausedRef = useRef(paused);
  const [is2D, setIs2D] = useState(false);

  // Place search (same box as the 2D map); the picked place gets a pin
  const [searchOpen, setSearchOpen] = useState(false);
  const searchPinRef = useRef(null);

  const removeSearchPin = () => {
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed() && searchPinRef.current) {
      viewer.entities.remove(searchPinRef.current);
    }
    searchPinRef.current = null;
  };

  const handlePlaceSelect = (place) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const lon = parseFloat(place.lon);
    const lat = parseFloat(place.lat);

    // Nominatim boundingbox = [south, north, west, east] as strings
    const bb = (place.boundingbox || []).map(parseFloat);
    const destination =
      bb.length === 4 && bb.every(Number.isFinite)
        ? Cesium.Rectangle.fromDegrees(bb[2], bb[0], bb[3], bb[1])
        : Cesium.Cartesian3.fromDegrees(lon, lat, 5000);
    viewer.camera.flyTo({ destination, duration: 2 });

    removeSearchPin();
    searchPinRef.current = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString("#2563eb"),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    viewer.scene.requestRender();
  };

  const closeSearch = () => {
    setSearchOpen(false);
    removeSearchPin();
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed()) viewer.scene.requestRender();
  };

  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect;
  }, [onFeatureSelect]);

  useEffect(() => {
    pausedRef.current = paused;
    const viewer = viewerRef.current;
    // viewerRef.current can briefly still point at an already-destroyed
    // Viewer during React StrictMode's mount->cleanup->remount cycle (the
    // mount effect below nulls it out on cleanup, but ordering between
    // separate effects means this one can run in that window) — guard with
    // isDestroyed() too, not just a null check.
    if (!viewer || viewer.isDestroyed()) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const hasSize = rect && rect.width > 0 && rect.height > 0;
    viewer.useDefaultRenderLoop = !paused && hasSize;
  }, [paused]);

  useEffect(() => {
    // Explicitly avoid any Cesium ion dependency (no token/account required)
    Cesium.Ion.defaultAccessToken = undefined;

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: new Cesium.ImageryLayer(buildImageryProvider()),
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayerPicker: false,
      timeline: false,
      animation: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      infoBox: false,
      shouldAnimate: true,
      // We handle render-loop failures ourselves (see renderError listener
      // below) instead of Cesium's own blocking "An error occurred while
      // rendering" dialog.
      showRenderLoopErrors: false,
    });

    viewerRef.current = viewer;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.cesiumWidget.creditContainer.style.display = "none";
    viewer.useDefaultRenderLoop = !pausedRef.current;

    // Guard against Cesium's render loop crashing with "Expected width to be
    // greater than 0, actual value was 0" — this container can momentarily
    // report 0x0 (e.g. a devtools toggle or a window resize mid-layout).
    // Pausing the render loop whenever the container has no area (or a
    // full-screen overlay has asked us to pause), and resuming once neither
    // is true, avoids feeding Cesium a zero-sized framebuffer entirely.
    const resizeObserver = new ResizeObserver((entries) => {
      if (viewer.isDestroyed()) return;
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      viewer.useDefaultRenderLoop = !pausedRef.current && width > 0 && height > 0;
    });
    resizeObserver.observe(containerRef.current);

    // Belt-and-suspenders: Cesium's own per-frame resize check runs
    // synchronously inside render(), so it can hit a momentary 0x0 container
    // before the ResizeObserver callback above ever fires. When that
    // happens, Cesium permanently halts its render loop (useDefaultRenderLoop
    // flips to false internally) — self-heal by resuming it as soon as the
    // container has real dimensions again (and nothing has asked us to stay
    // paused), instead of leaving the globe frozen/blank until a full reload.
    const removeRenderErrorListener = viewer.scene.renderError.addEventListener((scene, error) => {
      console.error("CesiumGlobe: render loop stopped by an internal error; attempting recovery.", error);
      requestAnimationFrame(() => {
        if (viewer.isDestroyed()) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!pausedRef.current && rect && rect.width > 0 && rect.height > 0) {
          viewer.useDefaultRenderLoop = true;
        }
      });
    });

    // Keep the 2D/3D toggle button label in sync with the scene's actual
    // mode, whether it changed via that button or the auto-morph-on-data-load.
    const removeMorphListener = viewer.scene.morphComplete.addEventListener(
      (transitioner, oldMode, newMode) => {
        setIs2D(newMode === Cesium.SceneMode.SCENE2D);
      },
    );

    // Start on a macro, whole-globe "space" view
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(20, 15, 20000000),
    });

    let cancelled = false;

    // Load the KML overlay in the background so any renderable placemarks
    // are available once panned to, but stay on the whole-globe space view
    // set above — no auto fly-in to any fixed coordinate on login/load. The
    // camera only moves once the user actually loads an upload (handled by
    // the geojsonData effect below).
    const introTimer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const dataSource = await Cesium.KmlDataSource.load(KMZ_URL, {
          camera: viewer.scene.camera,
          canvas: viewer.scene.canvas,
        });
        if (cancelled) return;
        await viewer.dataSources.add(dataSource);
      } catch (err) {
        console.error("CesiumGlobe: failed to load KMZ overlay.", err);
      }
    }, 600);

    // Feature picking: click a KML placemark to surface its attributes,
    // click empty space to clear the selection.
    const clickHandler = new Cesium.ScreenSpaceEventHandler(
      viewer.scene.canvas,
    );
    clickHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      const entity = picked?.id;

      if (entity && entity.name) {
        onFeatureSelectRef.current?.({
          name: entity.name,
          attributes: extractFeatureAttributes(entity),
        });
      } else {
        onFeatureSelectRef.current?.(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      cancelled = true;
      clearTimeout(introTimer);
      clickHandler.destroy();
      removeMorphListener();
      removeRenderErrorListener();
      resizeObserver.disconnect();
      viewer.destroy();
      // Clear the ref immediately so any effect/callback that reads
      // viewerRef.current during the window before a StrictMode remount
      // creates a new viewer sees "no viewer" instead of a destroyed one.
      if (viewerRef.current === viewer) {
        viewerRef.current = null;
      }
    };
  }, []);

  // Re-fit the camera to whatever upload data is currently loaded, if any.
  // Shared by the geojsonData effect and the 2D/3D toggle so switching scene
  // mode doesn't lose the zoomed-to-bounds framing. Flies to a plain lon/lat
  // rectangle (not viewer.flyTo(entities)) so it stays correct even when the
  // upload's features are spread across multiple continents.
  const flyToUploadedBounds = (viewer, duration = 1.5) => {
    const extent = uploadExtentRef.current;
    if (!extent) return;
    const destination = Cesium.Rectangle.fromDegrees(
      extent.west,
      extent.south,
      extent.east,
      extent.north,
    );
    viewer.camera.flyTo({ destination, duration });
  };

  const toggleSceneMode = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const scene = viewer.scene;
    const goingTo2D = scene.mode !== Cesium.SceneMode.SCENE2D;

    // Morphing between projections re-centers the camera on the whole
    // globe/map by default, losing any zoomed-to-upload framing — re-fit
    // to the uploaded data's bounds once the morph settles.
    const removeListener = scene.morphComplete.addEventListener(() => {
      removeListener();
      flyToUploadedBounds(viewer, 1);
    });

    if (goingTo2D) {
      scene.morphTo2D(1.5);
    } else {
      scene.morphTo3D(1.5);
    }
  };

  // Render the selected upload's GeoJSON (one FeatureCollection per layer/
  // feature-class in the response) and fly the camera to its bounds.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    uploadDataSourcesRef.current.forEach((ds) => viewer.dataSources.remove(ds, true));
    uploadDataSourcesRef.current = [];
    uploadExtentRef.current = null;

    if (!geojsonData) return;

    uploadExtentRef.current = computeLonLatExtent(geojsonData);

    let cancelled = false;

    (async () => {
      const loadedSources = [];
      for (const [layerName, featureCollection] of Object.entries(geojsonData)) {
        if (!featureCollection || !featureCollection.features) continue;
        try {
          // Wide stroke + brighter fill: at continent/world-scale zoom (data
          // spread across multiple countries), a thin low-opacity overlay is
          // nearly invisible against similarly-colored satellite imagery.
          // Each layer/feature-class gets its own auto-assigned color (see
          // buildLayerColorMap), matching the legend and the Data QC map.
          const color = layerColors?.[layerName] || "#2563eb";
          const dataSource = await Cesium.GeoJsonDataSource.load(featureCollection, {
            stroke: Cesium.Color.fromCssColorString(color),
            fill: Cesium.Color.fromCssColorString(color).withAlpha(0.45),
            strokeWidth: 5,
            clampToGround: true,
          });
          if (cancelled) return;
          await viewer.dataSources.add(dataSource);
          loadedSources.push(dataSource);
        } catch (err) {
          console.error("CesiumGlobe: failed to load uploaded GeoJSON layer.", err);
        }
      }

      if (cancelled) return;
      uploadDataSourcesRef.current = loadedSources;

      // viewer.flyTo only supports a single DataSource or an Entity[], not an
      // array of DataSources — passing the latter crashes Cesium's render
      // loop (DeveloperError: key is required to be a string or number).
      if (loadedSources.some((ds) => ds.entities.values.length)) {
        const scene = viewer.scene;

        // Google Earth-style: fly straight down into the data in 3D — no
        // flattening to 2D first. If the user had manually switched to 2D
        // beforehand, morph back to 3D first so the fly-in always lands as
        // a tilted 3D perspective, then fly to the data's bounds.
        if (scene.mode !== Cesium.SceneMode.SCENE3D) {
          const removeListener = scene.morphComplete.addEventListener(() => {
            removeListener();
            if (!cancelled) flyToUploadedBounds(viewer);
          });
          scene.morphTo3D(2.0);
        } else {
          flyToUploadedBounds(viewer);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [geojsonData]);

  return (
    <div className="cesium-globe-wrapper">
      <div ref={containerRef} className="cesium-globe-container" />
      <button
        type="button"
        className="cesium-mode-toggle-btn"
        onClick={toggleSceneMode}
        title={is2D ? "Switch to 3D Globe" : "Switch to 2D Map"}
      >
        {is2D ? <IconGlobe size={15} /> : <IconMap size={15} />}
        {is2D ? "3D Globe" : "2D Map"}
      </button>
      <button
        type="button"
        className="cesium-mode-toggle-btn cesium-upload-btn"
        onClick={onUploadsClick}
        title="GIS Data Uploads"
      >
        <IconUpload size={15} />
        Upload
      </button>
      <button
        type="button"
        className={`cesium-mode-toggle-btn cesium-search-btn ${searchOpen ? "active" : ""}`}
        onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
        title="Search Location"
        aria-expanded={searchOpen}
      >
        <IconSearch size={15} />
        Search
      </button>
      {searchOpen && (
        <LocationSearch className="cesium-location-search" onSelect={handlePlaceSelect} onClose={closeSearch} />
      )}
      <ProjectionBadge visible={!!geojsonData} className="cesium-projection-badge" />
    </div>
  );
};

export default CesiumGlobe;
