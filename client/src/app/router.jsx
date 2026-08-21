import {
  Navigate,
  createBrowserRouter,
} from 'react-router-dom';

import AppShell from '../components/layout/AppShell';
import MappingPage from '../pages/MappingPage';
import PreviewPage from '../pages/PreviewPage';
import ProcessingPage from '../pages/ProcessingPage';
import UploadPage from '../pages/UploadPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <Navigate
            to="/imports/new"
            replace
          />
        ),
      },
      {
        path: 'imports/new',
        element: <UploadPage />,
      },
      {
        path: 'imports/:uploadId/preview',
        element: <PreviewPage />,
      },
      {
        path: 'imports/:uploadId/mapping',
        element: <MappingPage />,
      },
      {
        path: 'imports/:uploadId/processing/:jobId',
        element: <ProcessingPage />,
      },
    ],
  },
  {
    path: '*',
    element: (
      <Navigate
        to="/imports/new"
        replace
      />
    ),
  },
]);
