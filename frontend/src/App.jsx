import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MapComponent from './components/MapComponent';
import CesiumGlobe from './components/CesiumGlobe';
import LoginComponent from './components/LoginComponent';
import Navbar from './components/Navbar';
import DpsBottomPanel from './components/DpsBottomPanel';
import ProfileModal from './components/ProfileModal';
import AdminDashboard from './components/AdminDashboard';
import ValidateModal from './components/ValidateModal';
import UploadsPanel from './components/UploadsPanel';
import SimpleDataTable from './components/SimpleDataTable';
import LoadDataPanel from './components/LoadDataPanel';
import AnalysisPlaceholder from './components/AnalysisPlaceholder';
import { API_ENDPOINTS } from './config';
import { buildLayerColorMap } from './utils/layerColors';
import './App.css';
import './mapGlass.css'; // after App.css: glass map cards override component backgrounds

function App() {
  const [user, setUser] = useState(null);

  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState('home'); // 'home' | one of analysisTabs' keys
  const [allAnalysisTypes, setAllAnalysisTypes] = useState([]); // superusers get a tab for every type

  // Dark / light theme, same as FinanceApp: remembered in localStorage and
  // stamped on <html data-theme> so every screen can read it.
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [validateModalOpen, setValidateModalOpen] = useState(false);
  const [uploadsPanelOpen, setUploadsPanelOpen] = useState(false);
  const [loadDataPanelOpen, setLoadDataPanelOpen] = useState(false);
  const [selectedUploadGeojson, setSelectedUploadGeojson] = useState(null);
  const [liveAttributeTables, setLiveAttributeTables] = useState(null); // [{ table, records }] from a live "attribute" table load

  // Attribute-filter conditions per live-database table, kept here (rather
  // than inside LoadDataPanel) so they survive the panel closing — it's
  // conditionally mounted, so its own state would otherwise reset every time
  // it reopens. { [tableName]: [{ field, op, value }, ...] }
  const [liveFiltersByTable, setLiveFiltersByTable] = useState({});

  // Auto-assigned color per feature layer/class, shared by the Home globe,
  // the Data QC map, and their legends.
  const layerColors = useMemo(
    () => buildLayerColorMap(selectedUploadGeojson?.layers),
    [selectedUploadGeojson],
  );

  // Table names currently loaded from the live database (as map layers
  // and/or as floating attribute tables) — so reopening the Load Live Data
  // panel can pre-check whatever is already showing, instead of starting
  // from a blank slate every time.
  const loadedLiveTableNames = useMemo(() => {
    const names = new Set();
    if (selectedUploadGeojson?.upload?.temp_id === 'Live Database') {
      Object.keys(selectedUploadGeojson.layers || {}).forEach((name) => names.add(name));
    }
    (liveAttributeTables || []).forEach((t) => names.add(t.table));
    return names;
  }, [selectedUploadGeojson, liveAttributeTables]);

  // Home command-center dashboard data: real feature picks from the globe,
  // and a running history of real validation calls (both start empty).
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [validationHistory, setValidationHistory] = useState([]);

  const handleFeatureSelect = useCallback((feature) => {
    setSelectedFeature(feature);
  }, []);

  const handleValidationResult = useCallback((entry) => {
    setValidationHistory((prev) => [entry, ...prev].slice(0, 20));
  }, []);

  // Selecting an upload from the Uploads panel: show its GeoJSON on the
  // Home globe first. The same data also renders on the Data QC map, so the
  // user can switch tabs afterwards to inspect it there if they want to.
  const handleGeojsonSelected = useCallback(({ upload, layers }) => {
    setSelectedUploadGeojson({ upload, layers });
    setActiveTab('home');
  }, []);

  // Selecting one or more live "layer" tables (from GIS Database
  // Connections' inline browser, or a batch selection in the navbar's Load
  // Live Data panel): route them through the same rendering pipeline as an
  // uploaded file, so they get the same per-layer coloring/legend/explorer
  // support. `layers` is a { [tableName]: geojson } map — always reflects
  // the caller's full current selection, so an empty map (every layer
  // unchecked) clears the map instead of leaving stale data behind.
  const handleLiveLayersLoaded = useCallback((layers) => {
    const hasLayers = Object.keys(layers).length > 0;
    setSelectedUploadGeojson(hasLayers ? { upload: { temp_id: 'Live Database' }, layers } : null);
    setAdminModalOpen(false);
    setLoadDataPanelOpen(false);
    if (hasLayers) setActiveTab('home');
  }, []);

  // Selecting one or more live "attribute" tables (no geometry column):
  // show them in the simple floating table instead of on the map. `tables`
  // is an array of { table, records } reflecting the full current
  // selection — an empty array (every table unchecked) closes the floating
  // table instead of leaving stale data behind.
  const handleLiveAttributeTablesLoaded = useCallback((tables) => {
    setLiveAttributeTables(tables.length > 0 ? tables : null);
    setAdminModalOpen(false);
    setLoadDataPanelOpen(false);
  }, []);

  // Data QC map layer state (basemap switching now only applies to that tab)
  const [activeBaseLayer, setActiveBaseLayer] = useState('osm');
  const [showGraticule, setShowGraticule] = useState(false);

  const isDarkTheme = theme === 'dark';

  // Any of these fully cover the screen without actually resizing the map
  // wrapper underneath, so the Cesium globe would otherwise keep rendering
  // (and burning CPU/GPU) while completely hidden, making the whole app feel
  // laggy — pause it whenever one of these is open.
  const isOverlayOpen = profileModalOpen || adminModalOpen || validateModalOpen || uploadsPanelOpen || loadDataPanelOpen;

  // DDA-style DPS Planning Portal States
  const [dpsResultsVisible, setDpsResultsVisible] = useState(false);
  const [dpsStatusMode, setDpsStatusMode] = useState(null); // 'running' | 'success' | 'errors' | null
  const [dpsArea, setDpsArea] = useState('haven'); // 'haven' | 'studio-city'
  const [zoomToPlotNumber, setZoomToPlotNumber] = useState(null);

  useEffect(() => {
    // Check if user is already logged in (persistence check)
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('accessToken');
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Failed to parse stored user:', err);
      }
    }
  }, []);

  // Re-read the signed-in user so a stored session picks up analysis types
  // assigned (or removed) since login; superusers also load every type.
  const userId = user?.id;
  const isSuperuser = !!user?.is_superuser;
  useEffect(() => {
    if (!userId) return;
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` };
    fetch(`${API_ENDPOINTS.USERS}me/`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (!me) return;
        setUser((prev) => {
          const next = { ...prev, ...me };
          localStorage.setItem('user', JSON.stringify(next));
          return next;
        });
      })
      .catch((err) => console.error('Failed to refresh user:', err));
    if (isSuperuser) {
      fetch(API_ENDPOINTS.ANALYSIS_TYPES, { headers })
        .then((r) => (r.ok ? r.json() : []))
        .then(setAllAnalysisTypes)
        .catch((err) => console.error('Failed to load analysis types:', err));
    }
  }, [userId, isSuperuser]);

  // One navbar tab per analysis type the user is assigned (all of them for
  // superusers). DataQC keeps its existing 'data-qc' workspace.
  const analysisTabs = useMemo(() => {
    const types = isSuperuser ? allAnalysisTypes : user?.analysis_types || [];
    return types.map((t) =>
      t.name === 'DataQC'
        ? { key: 'data-qc', label: 'Data QC' }
        : { key: t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: t.name }
    );
  }, [isSuperuser, allAnalysisTypes, user?.analysis_types]);
  const activeAnalysisTab = analysisTabs.find((t) => t.key === activeTab);

  // Losing a type (or logging in as someone without it) sends the user Home
  useEffect(() => {
    if (activeTab !== 'home' && !activeAnalysisTab && (!isSuperuser || allAnalysisTypes.length)) {
      setActiveTab('home');
    }
  }, [activeTab, activeAnalysisTab, isSuperuser, allAnalysisTypes.length]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleProfileUpdateSuccess = (updatedUserData) => {
    setUser(updatedUserData);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Reset DPS portal states on tab toggle
    setDpsResultsVisible(false);
    setDpsStatusMode(null);
    setZoomToPlotNumber(null);
  };

  const handleZoomToPlot = (plotNum) => {
    setZoomToPlotNumber(plotNum);
    // Trigger reset after execution to allow click re-triggers on the same row
    setTimeout(() => {
      setZoomToPlotNumber(null);
    }, 900);
  };

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    const accessToken = localStorage.getItem('accessToken');

    if (refreshToken && accessToken) {
      try {
        // Attempt to blacklist refresh token on backend for security
        await fetch(API_ENDPOINTS.LOGOUT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ refresh: refreshToken }),
        });
      } catch (err) {
        console.error('Logout request failed:', err);
      }
    }

    // Clear local authentication details
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setProfileModalOpen(false);
    setAdminModalOpen(false);
    setValidateModalOpen(false);
    setActiveTab('home');
    setDpsResultsVisible(false);
    setDpsStatusMode(null);
  };

  return (
    <div className="App">
      {user ? (
        <div className={`app-main-layout ${isDarkTheme ? 'map-dark-theme' : ''}`}>
          {/* Top navigation header */}
          <Navbar
            user={user}
            activeTab={activeTab}
            analysisTabs={analysisTabs}
            onTabChange={handleTabChange}
            onLogoutClick={handleLogout}
            onProfileClick={() => setProfileModalOpen(true)}
            onAdminClick={() => setAdminModalOpen(true)}
            onLoadDataClick={() => setLoadDataPanelOpen(true)}
            dark={isDarkTheme}
            onToggleTheme={() => setTheme(isDarkTheme ? 'light' : 'dark')}
          />

          {activeTab !== 'home' && activeTab !== 'data-qc' && activeAnalysisTab && !liveAttributeTables && (
            <AnalysisPlaceholder label={activeAnalysisTab.label} />
          )}

          {activeTab === 'data-qc' && !liveAttributeTables && (
            <DpsBottomPanel
              showResults={dpsResultsVisible}
              statusMode={dpsStatusMode}
              area={dpsArea}
              onZoomToPlot={handleZoomToPlot}
            />
          )}

          {/* Simple floating table for a live "attribute" table loaded from
              GIS Database Connections, docked to the bottom of whichever map
              is currently shown. */}
          {liveAttributeTables && (
            <SimpleDataTable
              tables={liveAttributeTables}
              onClose={() => setLiveAttributeTables(null)}
            />
          )}

          {/* Map layout beneath the navbar: 3D Cesium globe on Home, 2D plot map on Data QC */}
          <div className="app-map-wrapper">
            {activeTab === 'home' ? (
              <CesiumGlobe
                onFeatureSelect={handleFeatureSelect}
                onUploadsClick={() => setUploadsPanelOpen(true)}
                geojsonData={selectedUploadGeojson?.layers}
                layerColors={layerColors}
                paused={isOverlayOpen}
              />
            ) : (
              <MapComponent
                onUploadsClick={() => setUploadsPanelOpen(true)}
                activeBaseLayer={activeBaseLayer}
                onBaseLayerChange={setActiveBaseLayer}
                showGraticule={showGraticule}
                dpsArea={dpsArea}
                dpsStatus={dpsStatusMode}
                zoomToPlot={zoomToPlotNumber}
                geojsonData={selectedUploadGeojson?.layers}
                layerColors={layerColors}
              />
            )}
          </div>

          {/* Modal overlays */}
          {profileModalOpen && (
            <ProfileModal
              onClose={() => setProfileModalOpen(false)}
              onUpdateSuccess={handleProfileUpdateSuccess}
            />
          )}

          {adminModalOpen && user.is_superuser && (
            <AdminDashboard
              onClose={() => setAdminModalOpen(false)}
              onLayerLoaded={handleLiveLayersLoaded}
              onAttributeLoaded={handleLiveAttributeTablesLoaded}
            />
          )}

          {validateModalOpen && (
            <ValidateModal
              onClose={() => setValidateModalOpen(false)}
              user={user}
              onResult={handleValidationResult}
            />
          )}

          {uploadsPanelOpen && (
            <UploadsPanel
              onClose={() => setUploadsPanelOpen(false)}
              onUploadClick={() => {
                setUploadsPanelOpen(false);
                setValidateModalOpen(true);
              }}
              onGeojsonSelected={handleGeojsonSelected}
              user={user}
            />
          )}

          {loadDataPanelOpen && (
            <LoadDataPanel
              onClose={() => setLoadDataPanelOpen(false)}
              onLayerLoaded={handleLiveLayersLoaded}
              onAttributeLoaded={handleLiveAttributeTablesLoaded}
              alreadyLoaded={loadedLiveTableNames}
              filtersByTable={liveFiltersByTable}
              onFiltersByTableChange={setLiveFiltersByTable}
            />
          )}
        </div>
      ) : (
        <LoginComponent onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
