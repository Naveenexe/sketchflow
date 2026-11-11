import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { checkBackendHealth } from '../services/api';

export function CloudStatusBadge() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const checkHealth = async () => {
    setStatus('connecting');
    try {
      const res = await checkBackendHealth();
      if (res.status === 'UP' && res.database?.status === 'CONNECTED') {
        setStatus('connected');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <button
      type="button"
      className="status-indicator status-indicator-btn"
      onClick={checkHealth}
      title="Click to verify cloud API & database health"
    >
      <span
        className={`status-dot ${
          status === 'connected' ? 'live' : status === 'error' ? 'error' : ''
        }`}
      />
      <span>
        {status === 'connected' ? (
          'API online'
        ) : status === 'connecting' ? (
          <>
            <span className="sf-from-480">Waking server...</span>
            <span className="sf-below-480">Waking...</span>
          </>
        ) : (
          <>
            <span className="sf-from-480">API offline — retry</span>
            <span className="sf-below-480">Retry API</span>
          </>
        )}
      </span>
      {status === 'error' && <RefreshCw size={16} strokeWidth={1.5} />}
    </button>
  );
}
