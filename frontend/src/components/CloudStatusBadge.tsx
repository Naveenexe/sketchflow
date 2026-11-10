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
      className="sketchflow-save-indicator"
      style={{ border: '1px solid #e2e8f0', cursor: 'pointer' }}
      onClick={checkHealth}
      title="Click to verify cloud API & database health"
    >
      <span
        className={`sketchflow-save-dot ${
          status === 'connecting'
            ? 'saving'
            : status === 'error'
            ? 'offline'
            : ''
        }`}
      />
      <span>
        {status === 'connected'
          ? 'Cloud API: Online'
          : status === 'connecting'
          ? 'Cloud API: Waking...'
          : 'Cloud API: Retry'}
      </span>
      {status === 'error' && <RefreshCw size={12} />}
    </button>
  );
}
