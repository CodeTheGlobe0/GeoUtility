import React, { useState, useEffect, useCallback } from 'react';
import MapComponent from './components/MapComponent';
import CesiumGlobe from './components/CesiumGlobe';
import LoginComponent from './components/LoginComponent';
import Navbar from './components/Navbar';
import DpsLeftPanel from './components/DpsLeftPanel';
import DpsBottomPanel from './components/DpsBottomPanel';
import ProfileModal from './components/ProfileModal';
import AdminDashboard from './components/AdminDashboard';
import ValidateModal from './components/ValidateModal';
import HomeDashboard from './components/HomeDashboard';
import { API_ENDPOINTS } from './config';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'data-qc'
  
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [validateModalOpen, setValidateModalOpen] = useState(false);
  const [dashboardVisible, setDashboardVisible] = useState(true);

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

  // Data QC map layer state (basemap switching now only applies to that tab)
  const [activeBaseLayer, setActiveBaseLayer] = useState('osm');
  const [showGraticule, setShowGraticule] = useState(false);

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

  const handleDpsProcessComplete = (selectedArea, status) => {
    setDpsStatusMode(status);
    if (status === 'success' || status === 'errors') {
      setDpsResultsVisible(true);
    } else {
      setDpsResultsVisible(false);
    }
  };

  const handleDpsAreaChange = (selectedArea) => {
    setDpsArea(selectedArea);
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
        <div className="app-main-layout">
          {/* Top navigation header */}
          <Navbar
            user={user}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onLogoutClick={handleLogout}
            onProfileClick={() => setProfileModalOpen(true)}
            onAdminClick={() => setAdminModalOpen(true)}
            onValidateClick={() => setValidateModalOpen(true)}
            dashboardVisible={dashboardVisible}
            onDashboardToggle={() => setDashboardVisible((v) => !v)}
            dark={activeTab === 'home'}
          />

          {/* Command-center style dashboard overlay, Home tab only */}
          {activeTab === 'home' && dashboardVisible && (
            <HomeDashboard
              onUploadClick={() => setValidateModalOpen(true)}
              selectedFeature={selectedFeature}
              validationHistory={validationHistory}
            />
          )}

          {activeTab !== 'home' && (
            <>
              {/* Left Quality Check Panel */}
              <DpsLeftPanel
                onProcessComplete={handleDpsProcessComplete}
                onAreaChange={handleDpsAreaChange}
              />

              {/* Bottom Collapsible Results Data Grid */}
              <DpsBottomPanel
                showResults={dpsResultsVisible}
                statusMode={dpsStatusMode}
                area={dpsArea}
                onZoomToPlot={handleZoomToPlot}
              />
            </>
          )}

          {/* Map layout beneath the navbar: 3D Cesium globe on Home, 2D plot map on Data QC */}
          <div className="app-map-wrapper">
            {activeTab === 'home' ? (
              <CesiumGlobe onFeatureSelect={handleFeatureSelect} />
            ) : (
              <MapComponent
                activeBaseLayer={activeBaseLayer}
                onBaseLayerChange={setActiveBaseLayer}
                showGraticule={showGraticule}
                dpsArea={dpsArea}
                dpsStatus={dpsStatusMode}
                zoomToPlot={zoomToPlotNumber}
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
            />
          )}

          {validateModalOpen && (
            <ValidateModal
              onClose={() => setValidateModalOpen(false)}
              user={user}
              onResult={handleValidationResult}
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
