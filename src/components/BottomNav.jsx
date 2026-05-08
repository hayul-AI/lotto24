import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, FileText, Settings, User } from 'lucide-react';

const BottomNav = () => {
  return (
    <nav style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 48px)',
      maxWidth: '400px',
      height: '64px',
      backgroundColor: 'var(--deep-indigo)', // Sophisticated Deep Indigo Nav
      borderRadius: '24px',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 2000,
      boxShadow: '0 12px 24px rgba(0,0,0,0.2)',
      padding: '0 12px'
    }}>
      <NavItem to="/" icon={<Home size={22} />} label="홈" />
      <NavItem to="/results" icon={<Search size={22} />} label="조회" />
      <NavItem to="/my-tickets" icon={<FileText size={22} />} label="내역" />
      <NavItem to="/stores" icon={<Settings size={22} />} label="설정" />
    </nav>
  );
};

const NavItem = ({ to, icon, label }) => (
  <NavLink 
    to={to} 
    style={({ isActive }) => ({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textDecoration: 'none',
      color: isActive ? '#FFFFFF' : '#666666',
      gap: '4px',
      transition: 'all 0.3s ease',
      opacity: isActive ? 1 : 0.6
    })}
  >
    {icon}
    <span style={{ fontSize: '0.65rem', fontWeight: '700' }}>{label}</span>
  </NavLink>
);

export default BottomNav;
