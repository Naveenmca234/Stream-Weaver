import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  Activity, 
  Database, 
  Network, 
  PlayCircle, 
  Settings, 
  LogOut, 
  Menu,
  X
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/api';
import { wsClient } from '../services/websocket';
import { cn } from '../utils';

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const { user, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    wsClient.connect();
    return () => wsClient.disconnect();
  }, []);

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (e) {
      console.error(e);
    } finally {
      logout();
      navigate('/login');
    }
  };

  const navItems = [
    { to: '/', icon: Activity, label: 'Overview' },
    { to: '/datasets', icon: Database, label: 'Datasets' },
    { to: '/pipelines', icon: Network, label: 'Pipelines' },
    { to: '/runs', icon: PlayCircle, label: 'Execution Runs' },
    { to: '/monitoring', icon: Activity, label: 'Monitoring' },
    { to: '/connections', icon: Settings, label: 'Connections' },
  ];

  return (
    <div className="flex h-screen bg-base-950 text-gray-100 overflow-hidden font-sans">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-base-900 border-r border-base-800 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-base-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-accent-500/20">
              <Network className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">StreamWeaver</span>
          </div>
          <button className="lg:hidden text-gray-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "text-accent-400 bg-accent-500/10 hover:bg-accent-500/15"
                    : "text-gray-400 hover:text-gray-100 hover:bg-base-800"
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-base-800">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-200">{user?.name}</span>
              <span className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-gray-500 hover:text-danger-400 transition-colors p-1"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 flex items-center justify-between px-6 border-b border-base-800 bg-base-900/50 backdrop-blur-sm lg:hidden">
          <button 
            className="text-gray-400 hover:text-white"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <span className="text-lg font-bold text-white">StreamWeaver</span>
          <div className="w-6" /> {/* Spacer */}
        </header>

        <main className="flex-1 overflow-auto bg-base-950 p-6 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
