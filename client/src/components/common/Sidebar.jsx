import {
  Activity,
  Database,
  History,
  Plus,
  Settings,
} from 'lucide-react';

import {
  NavLink,
} from 'react-router-dom';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="product-brand">
        <div className="product-mark">
          <Database size={20} />
        </div>

        <div>
          <strong>
            StreamWeaver
          </strong>

          <span>
            Data pipelines
          </span>
        </div>
      </div>

      <nav
        className="sidebar-navigation"
        aria-label="Primary navigation"
      >
        <p className="nav-label">
          WORKSPACE
        </p>

        <NavLink
          to="/imports/new"
          className={({ isActive }) =>
            `nav-item ${
              isActive
                ? 'active'
                : ''
            }`
          }
        >
          <Plus size={18} />

          <span>
            New Import
          </span>
        </NavLink>

        <div
          className="nav-item disabled"
          aria-disabled="true"
        >
          <Activity size={18} />

          <span>Jobs</span>

          <small>Soon</small>
        </div>

        <div
          className="nav-item disabled"
          aria-disabled="true"
        >
          <History size={18} />

          <span>History</span>

          <small>Soon</small>
        </div>

        <p className="nav-label system-label">
          SYSTEM
        </p>

        <div
          className="nav-item disabled"
          aria-disabled="true"
        >
          <Settings size={18} />

          <span>Settings</span>

          <small>Soon</small>
        </div>
      </nav>

      <div className="sidebar-footer">
        <span>
          Memory-safe ETL
        </span>

        <small>
          Stream processing architecture
        </small>
      </div>
    </aside>
  );
}