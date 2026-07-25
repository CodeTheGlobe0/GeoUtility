import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import './MapComponent.css';

const MapComponent = () => {
  const mapRef = useRef();

  useEffect(() => {
    // Initialize the map on mount
    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: fromLonLat([88.3639, 22.5726]), // Default center coordinates (e.g., Kolkata)
        zoom: 12,
      }),
    });

    // Clean up map instance on unmount
    return () => {
      map.setTarget(null);
    };
  }, []);

  return (
    <div className="map-container">
      <div ref={mapRef} className="ol-map" />
    </div>
  );
};

export default MapComponent;
