import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Layout } from './layouts/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Datasets } from './pages/Datasets';
import { DatasetDetail } from './pages/DatasetDetail';

// Placeholder components for the rest
const Pipelines = () => <div>Pipelines</div>;
const PipelineBuilder = () => <div>Pipeline Builder</div>;
const Runs = () => <div>Runs</div>;
const RunMonitor = () => <div>Run Monitor</div>;
const Connections = () => <div>Connections</div>;
const Monitoring = () => <div>Monitoring</div>;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Overview />} />
              <Route path="/datasets" element={<Datasets />} />
              <Route path="/datasets/:id" element={<DatasetDetail />} />
              
              <Route path="/pipelines" element={<Pipelines />} />
              <Route path="/pipelines/new" element={<PipelineBuilder />} />
              <Route path="/pipelines/:id/edit" element={<PipelineBuilder />} />
              
              <Route path="/runs" element={<Runs />} />
              <Route path="/runs/:id" element={<RunMonitor />} />
              
              <Route path="/connections" element={<Connections />} />
              <Route path="/monitoring" element={<Monitoring />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
