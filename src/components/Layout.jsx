import { Outlet, NavLink } from 'react-router-dom';
import { Home as HomeIcon, MapPin, Ticket, Search, QrCode, Hash } from 'lucide-react';
import DebugPanel from './DebugPanel';

const Layout = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)' }}>
      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* Balanced Bottom Nav */}
      <nav className="floating-nav" style={{ justifyContent: 'space-between', padding: '0 20px' }}>
        <NavItem to="/" icon={<HomeIcon size={24} />} label="홈" />
        <NavItem to="/manual-numbers" icon={<Hash size={24} />} label="수동저장" />
        <NavItem to="/scanner" icon={<QrCode size={24} />} label="QR스캔" />
        <NavItem to="/stores" icon={<MapPin size={24} />} label="판매점" />
        <NavItem to="/my-tickets" icon={<Ticket size={24} />} label="확인목록" />
      </nav>

      <DebugPanel />
    </div>
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
      color: isActive ? 'var(--primary-blue)' : 'var(--text-muted)',
      gap: '4px',
      transition: 'all 0.2s ease',
      width: '60px'
    })}
  >
    <div style={{ position: 'relative' }}>
      {icon}
    </div>
    <span style={{ fontSize: '0.7rem', fontWeight: '700' }}>{label}</span>
  </NavLink>
);

export default Layout;
