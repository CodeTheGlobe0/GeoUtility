# Frontend Setup from Scratch Guide

This step-by-step guide explains how to set up the React Vite frontend project from scratch, install OpenLayers, clean up default assets, and configure a basic map view.

---

## Step 1: Initialize the React Vite Project

1. Create a `frontend` directory (if not already present), change directory, and initialize a React project using Vite:
   ```bash
   mkdir frontend
   cd frontend
   npx -y create-vite ./ --template react --no-interactive
   ```
   This generates the following initial structure:
   - `package.json`
   - `vite.config.js`
   - `index.html`
   - `src/` (containing `main.jsx`, `App.jsx`, styles, and assets)

2. Install the initial boilerplate node modules:
   ```bash
   npm install
   ```

---

## Step 2: Install OpenLayers

Install the `ol` library which contains the core OpenLayers components needed to render interactive maps:
```bash
npm install ol
```

---

## Step 3: Boilerplate Cleanup

To start with a clean design, remove default assets and empty styles:
1. Delete default SVG assets:
   - Remove `src/assets/react.svg`
   - Remove `public/vite.svg`

2. Clear boilerplate styles:
   - Empty the contents of `src/App.css`
   - Empty the contents of `src/index.css` (we will use it later to set up base styling)

---

## Step 4: Create the OpenLayers Map Component

Create a dedicated map component that renders an OpenStreetMap layer:

1. Create a styles file `src/components/MapComponent.css`:
   ```css
   /* Map Container styling */
   .map-container {
     width: 100vw;
     height: 100vh;
     margin: 0;
     padding: 0;
     overflow: hidden;
     position: relative;
   }

   /* Ensure OpenLayers map occupies full space */
   .ol-map {
     width: 100%;
     height: 100%;
   }
   ```

2. Create a React component `src/components/MapComponent.jsx`:
   ```jsx
   import React, { useEffect, useRef } from 'react';
   import 'ol/ol.css'; // Import default OpenLayers styling
   import Map from 'ol/Map';
   import View from 'ol/View';
   import TileLayer from 'ol/layer/Tile';
   import OSM from 'ol/source/OSM';
   import { fromLonLat } from 'ol/proj';
   import './MapComponent.css';

   const MapComponent = () => {
     const mapRef = useRef();

     useEffect(() => {
       // Initialize map instance
       const map = new Map({
         target: mapRef.current,
         layers: [
           new TileLayer({
             source: new OSM(),
           }),
         ],
         view: new View({
           center: fromLonLat([88.3639, 22.5726]), // Center coordinates (e.g. Kolkata) [Lon, Lat]
           zoom: 12,
         }),
       });

       // Clean up on component unmount
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
   ```

---

## Step 5: Render Map in Main Application

Update `src/App.jsx` to render the `MapComponent`:
```jsx
import React from 'react';
import MapComponent from './components/MapComponent';
import './App.css';

function App() {
  return (
    <div className="App">
      <MapComponent />
    </div>
  );
}

export default App;
```

---

## Step 6: Configure Core Design System & Styling

To make the app occupy the full screen with no scrollbars, update `src/index.css`:
```css
/* Base styles */
body, html, #root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
}
```

---

## Step 7: Running Locally & Verification

To verify that the project runs and compiles successfully:
1. Start the local Vite development server:
   ```bash
   npm run dev
   ```
2. Verify production build pipeline compiles cleanly:
   ```bash
   npm run build
   ```
