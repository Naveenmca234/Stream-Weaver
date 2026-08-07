 import ConnectionStatus from './components/ConnectionStatus';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">S</div>

          <div>
            <h1>StreamWeaver</h1>
            <p>High-Throughput No-Code ETL Pipeline</p>
          </div>
        </div>

        <span className="week-badge">
          Week 1 · Foundation
        </span>
      </header>

      <main className="main-content">
        <section className="hero">
          <span className="eyebrow">
            INFOTACT SOLUTIONS INTERNSHIP
          </span>

          <h2>
            A reliable foundation for
            <span> massive-data processing.</span>
          </h2>

          <p>
            StreamWeaver will process large datasets using
            memory-safe streaming instead of loading complete
            files into browser or server memory.
          </p>
        </section>

        <section className="dashboard-grid">
          <ConnectionStatus />

          <div className="checkpoint-card">
            <span className="card-label">
              CURRENT CHECKPOINT
            </span>

            <h3>Project Foundation</h3>

            <ul>
              <li>
                <span>✓</span>
                React + Vite frontend
              </li>

              <li>
                <span>✓</span>
                Express backend
              </li>

              <li>
                <span>✓</span>
                Health API
              </li>

              <li>
                <span>✓</span>
                Environment configuration
              </li>

              <li>
                <span>•</span>
                Frontend-backend connection
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer>
        StreamWeaver · Advanced MERN Stack Engineering
      </footer>
    </div>
  );
}

export default App;