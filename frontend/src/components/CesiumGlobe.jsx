import React, { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./CesiumGlobe.css";
import { IconGlobe, IconMap } from "./Icons";
import ProjectionBadge from "./ProjectionBadge";

const KMZ_URL = "/AGI_HQ.kmz";
// Same Dubai, UAE coordinates used as the default view in MapComponent.jsx (Data QC tab)
const TARGET_DESTINATION = Cesium.Cartesian3.fromDegrees(
  88.360051,
  22.58867,
  15000,
);

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

const CesiumGlobe = ({ onFeatureSelect, geojsonData, layerColors }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const uploadDataSourcesRef = useRef([]);
  // Kept in a ref so the (mount-once) viewer effect can call the latest
  // callback without needing to re-run and rebuild the whole Cesium viewer.
  const onFeatureSelectRef = useRef(onFeatureSelect);
  // Tracks whether an upload's GeoJSON is already selected when this component
  // (re)mounts — e.g. navigating Home -> Data QC -> Home. The intro flyTo
  // below must not fight the geojsonData effect's flyTo for the camera.
  const geojsonDataRef = useRef(geojsonData);
  const uploadExtentRef = useRef(null);
  const [is2D, setIs2D] = useState(false);

  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect;
  }, [onFeatureSelect]);

  useEffect(() => {
    geojsonDataRef.current = geojsonData;
  }, [geojsonData]);

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
    });

    viewerRef.current = viewer;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.cesiumWidget.creditContainer.style.display = "none";

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

    // Shortly after mount, fly down from space into the target location.
    // The KML overlay is still loaded (so any renderable placemarks show up
    // on the globe), but the camera always ends up at the Dubai coordinates
    // shared with the Data QC map, regardless of what the KMZ contains.
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
      if (cancelled) return;
      // Skip the default Dubai fly-in when an upload's GeoJSON is already
      // selected — the geojsonData effect below owns the camera in that case,
      // otherwise this would fly back over it a moment later.
      if (!geojsonDataRef.current) {
        viewer.camera.flyTo({
          destination: TARGET_DESTINATION,
          duration: 3.5,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        });
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
      viewer.destroy();
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

        // Once the uploaded data is in view, flatten from the 3D globe into
        // a 2D map — the same cinematic morph used for the space-to-Esri
        // intro, just landing flat instead of a tilted 3D perspective.
        if (scene.mode !== Cesium.SceneMode.SCENE2D) {
          const removeListener = scene.morphComplete.addEventListener(() => {
            removeListener();
            if (!cancelled) flyToUploadedBounds(viewer);
          });
          scene.morphTo2D(2.0);
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
      <ProjectionBadge visible={!!geojsonData} className="cesium-projection-badge" />
    </div>
  );
};

export default CesiumGlobe;
