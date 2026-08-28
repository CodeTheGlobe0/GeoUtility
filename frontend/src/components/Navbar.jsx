import React, { useState, useEffect, useRef } from 'react';
import './Navbar.css';
import ytIcon from '../assets/yticon.png';
import { IconShield, IconUser, IconLogOut, IconUpload, IconLayers } from './Icons';

const Navbar = ({ user, onLogoutClick, onProfileClick, onAdminClick, onUploadsClick, onLoadDataClick, activeTab, onTabChange, dark }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Compute user initials for the avatar badge
  const getInitials = () => {
    if (!user) return '??';
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.username.slice(0, 2).toUpperCase();
  };

  const handleProfileUpdate = () => {
    setDropdownOpen(false);
    if (onProfileClick) onProfileClick();
  };

  const handleAdminPanel = () => {
    setDropdownOpen(false);
    if (onAdminClick) onAdminClick();
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    if (onLogoutClick) onLogoutClick();
  };

  // Determine user role text
  const getRoleText = () => {
    if (!user) return '';
    if (user.is_superuser) return 'Super Admin';
    if (user.is_staff) return 'Staff Operator';
    return 'Authorized User';
  };

  const getRoleBadgeClass = () => {
    if (!user) return 'user';
    if (user.is_superuser) return 'superuser';
    if (user.is_staff) return 'staff';
    return 'user';
  };

  return (
    <nav className={`navbar ${dark ? 'navbar-dark' : ''}`}>
      {/* Left Section: Logo */}
      <div className="navbar-brand">
        <img src={ytIcon} alt="GeoUtility Logo" className="brand-logo-img" />
        <span className="brand-name">GeoUtility</span>
      </div>

      {/* Center Section: Navigation Tabs */}
      <div className="navbar-tabs">
        <button
          className={`nav-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => onTabChange('home')}
        >
          Home
        </button>
        <button
          className={`nav-tab-btn ${activeTab === 'data-qc' ? 'active' : ''}`}
          onClick={() => onTabChange('data-qc')}
        >
          Data QC
        </button>
      </div>

      {/* Right Section: User Controls */}
      {user && (
        <div className="navbar-controls" ref={dropdownRef}>
          {/* GIS Data Uploads panel trigger */}
          <button
            className="validate-control-btn"
            title="GIS Data Uploads"
            onClick={onUploadsClick}
          >
            <IconUpload size={15} />
          </button>

          {/* Load Data panel trigger (staff/superusers only — matches the
              backend's IsStaffOrSuperuser gate on the load-data endpoint) */}
          {(user.is_staff || user.is_superuser) && (
            <button
              className="validate-control-btn"
              title="Load Live Data"
              onClick={onLoadDataClick}
            >
              <IconLayers size={15} />
            </button>
          )}

          {/* Admin panel gear button (Visible to superusers only) */}
          {user.is_superuser && (
            <button
              className="admin-control-btn"
              title="Admin Panel Controls"
              onClick={handleAdminPanel}
            >
              <IconShield size={15} />
            </button>
          )}

          {/* User circular avatar badge */}
          <div
            className="avatar-badge"
            title="User Profile options"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {getInitials()}
          </div>

          {/* Frosted Dropdown Menu */}
          {dropdownOpen && (
            <div className="profile-dropdown">
              <div className="dropdown-profile-info">
                <span className="dropdown-username">{user.username}</span>
                <span className="dropdown-email">{user.email || 'no email registered'}</span>
                <span className={`role-badge ${getRoleBadgeClass()}`} style={{ display: 'inline-block', marginTop: '5px' }}>
                  {getRoleText()}
                </span>
              </div>

              <button className="dropdown-action-btn" onClick={handleProfileUpdate}>
                <IconUser size={16} /> Edit Profile
              </button>

              <button className="dropdown-action-btn logout-action" onClick={handleLogout}>
                <IconLogOut size={16} /> Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
