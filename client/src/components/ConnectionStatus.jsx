import { useEffect, useState } from 'react';
import { getHealthStatus } from '../services/api';

function ConnectionStatus() {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');

  const checkConnection = async () => {
    setStatus('checking');
    setMessage('');

    try {
      const data = await getHealthStatus();

      if (data.success) {
        setStatus('connected');
        setMessage(data.message);
      } else {
        setStatus('unavailable');
        setMessage('Unexpected backend response.');
      }
    } catch {
      setStatus('unavailable');
      setMessage(
        'Unable to connect to the StreamWeaver backend.',
      );
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <div className={`connection-card ${status}`}>
      <div className="connection-indicator" />

      <div className="connection-content">
        {status === 'checking' && (
          <>
            <h2>Checking connection</h2>
            <p>Connecting to the StreamWeaver backend...</p>
          </>
        )}

        {status === 'connected' && (
          <>
            <h2>Backend connected</h2>
            <p>{message}</p>
          </>
        )}

        {status === 'unavailable' && (
          <>
            <h2>Backend unavailable</h2>
            <p>{message}</p>

            <button
              type="button"
              onClick={checkConnection}
            >
              Retry connection
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ConnectionStatus;