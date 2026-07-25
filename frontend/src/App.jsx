import React, { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import LoginComponent from './components/LoginComponent';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DpsLeftPanel from './components/DpsLeftPanel';
import DpsBottomPanel from './components/DpsBottomPanel';
import ProfileModal from './components/ProfileModal';
import AdminDashboard from './components/AdminDashboard';
import { API_ENDPOINTS } from './config';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('dark');
  
  // Navigation Tabs State
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'data-qc'
  
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  // Sidebar and Layer States
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

    // Initialize and apply theme
    const storedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(storedTheme);
    document.documentElement.setAttribute('data-theme', storedTheme);
  }, []);

  const handleThemeToggle = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

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
    setSidebarOpen(false);
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
            theme={theme}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onThemeToggle={handleThemeToggle}
            onLogoutClick={handleLogout}
            onProfileClick={() => setProfileModalOpen(true)}
            onAdminClick={() => setAdminModalOpen(true)}
          />

          {/* Render Home Map controls or DDA-style DPS Portal overlays */}
          {activeTab === 'home' ? (
            <Sidebar
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              activeBaseLayer={activeBaseLayer}
              onBaseLayerChange={setActiveBaseLayer}
              showGraticule={showGraticule}
              onGraticuleToggle={setShowGraticule}
            />
          ) : (
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

          {/* Map layout beneath the navbar */}
          <div className="app-map-wrapper">
            <MapComponent
              activeBaseLayer={activeBaseLayer}
              onBaseLayerChange={setActiveBaseLayer}
              showGraticule={showGraticule}
              activeTab={activeTab}
              dpsArea={dpsArea}
              dpsStatus={dpsStatusMode}
              zoomToPlot={zoomToPlotNumber}
            />
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
        </div>
      ) : (
        <LoginComponent onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
