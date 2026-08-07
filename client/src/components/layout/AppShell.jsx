 import {
  Outlet,
} from 'react-router-dom';

import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell() {
  return (
    <div className="product-shell">
      <Sidebar />

      <div className="product-workspace">
        <Topbar />

        <main className="workspace-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}