import React, { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import LoginComponent from './components/LoginComponent';
import { API_ENDPOINTS } from './config';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

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
  };

  return (
    <div className="App">
      {user ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* Floating Top-Right Overlay Controls */}
          <div className="map-overlay-controls">
            <span className="user-badge">
              Hello, {user.username} {user.is_staff || user.is_superuser ? '(Admin)' : ''}
            </span>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
          <MapComponent />
        </div>
      ) : (
        <LoginComponent onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
