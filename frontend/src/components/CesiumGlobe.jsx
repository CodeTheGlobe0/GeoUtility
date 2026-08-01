import React, { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./CesiumGlobe.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const KMZ_URL = "/AGI_HQ.kmz";
// Same Dubai, UAE coordinates used as the default view in MapComponent.jsx (Data QC tab)
const TARGET_DESTINATION = Cesium.Cartesian3.fromDegrees(
  88.360051,
  22.58867,
  15000,
);

// No Cesium ion account needed: use Mapbox satellite raster tiles for the
// photorealistic globe look, falling back to free OSM tiles if no token is set.
const buildImageryProvider = () => {
  if (MAPBOX_TOKEN) {
    return new Cesium.UrlTemplateImageryProvider({
      url: `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.png?access_token=${MAPBOX_TOKEN}`,
      credit: "© Mapbox © OpenStreetMap",
      maximumLevel: 19,
    });
  }
  return new Cesium.UrlTemplateImageryProvider({
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    credit: "© OpenStreetMap contributors",
    maximumLevel: 19,
  });
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

const CesiumGlobe = ({ onFeatureSelect }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  // Kept in a ref so the (mount-once) viewer effect can call the latest
  // callback without needing to re-run and rebuild the whole Cesium viewer.
  const onFeatureSelectRef = useRef(onFeatureSelect);

  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect;
  }, [onFeatureSelect]);

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
      viewer.camera.flyTo({
        destination: TARGET_DESTINATION,
        duration: 3.5,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
      });
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
      viewer.destroy();
    };
  }, []);

  return <div ref={containerRef} className="cesium-globe-container" />;
};

export default CesiumGlobe;
