import {
  useEffect,
  useState,
} from 'react';

import {
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  getHealthStatus,
} from '../../services/api';

export default function ApiStatus() {
  const [status, setStatus] =
    useState('checking');

  useEffect(() => {
    let active = true;

    async function checkApi() {
      try {
        const result =
          await getHealthStatus();

        if (!active) {
          return;
        }

        setStatus(
          result.success
            ? 'online'
            : 'offline',
        );
      } catch {
        if (active) {
          setStatus('offline');
        }
      }
    }

    void checkApi();

    const timer = setInterval(
      checkApi,
      30000,
    );

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="api-status checking">
        <span className="status-dot" />
        Checking API
      </div>
    );
  }

  if (status === 'online') {
    return (
      <div className="api-status online">
        <Wifi size={15} />
        API Online
      </div>
    );
  }

  return (
    <div className="api-status offline">
      <WifiOff size={15} />
      API Offline
    </div>
  );
}
