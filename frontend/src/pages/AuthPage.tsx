import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { loginUser, registerUser } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { BrandMark } from '../components/BrandMark';
import { ThemeQuickControls } from '../components/ThemeQuickControls';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slowNotice, setSlowNotice] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const isSessionExpired = new URLSearchParams(location.search).get('expired') === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'register' && !displayName.trim()) {
      setError('Please enter your display name.');
      return;
    }

    setLoading(true);
    setSlowNotice(false);
    const slowTimer = setTimeout(() => setSlowNotice(true), 4000);

    try {
      const data =
        mode === 'login'
          ? await loginUser(email.trim(), password)
          : await registerUser(email.trim(), password, displayName.trim());

      setAuth(data);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      const msg =
        axiosErr?.response?.data?.error ||
        axiosErr?.message ||
        'Authentication failed. Please try again.';
      setError(msg);
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlowNotice(false);
    }
  };

  return (
    <div className="auth-layout">
      <header className="sf-topbar">
        <div className="sf-topbar-left">
          <div className="sf-brand" style={{ cursor: 'default' }}>
            <BrandMark size={20} />
            <span>SketchFlow</span>
          </div>
        </div>
        <div className="sf-topbar-right">
          <CloudStatusBadge />
          <ThemeQuickControls showEditorOptions={false} />
        </div>
      </header>

      <main className="auth-card-wrapper">
        <div className="auth-card">
          <div className="auth-card-brand">
            <BrandMark size={20} />
            <span>SketchFlow</span>
          </div>

          <div className="auth-card-header">
            <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
            <p>
              {mode === 'login'
                ? 'Open your workspace and continue sketching.'
                : 'Start creating and sharing visual boards.'}
            </p>
          </div>

          {isSessionExpired && !error && (
            <div
              className="auth-error"
              style={{
                background: 'var(--accent-subtle)',
                borderColor: 'var(--accent)',
                color: 'var(--ink)',
              }}
            >
              Your session has expired. Please sign in again.
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="displayName">Display Name</label>
                <input
                  id="displayName"
                  className="sf-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivera"
                  disabled={loading}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                className="sf-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="sf-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              className="sf-btn sf-btn-primary auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} strokeWidth={1.5} className="spin" />
                  <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight size={16} strokeWidth={1.5} />
                </>
              )}
            </button>

            {slowNotice && (
              <p className="auth-slow-notice">
                Waking up the free-tier backend server — this can take ~30 seconds on first visit.
              </p>
            )}
          </form>

          <div className="auth-footer">
            {mode === 'login' ? (
              <span>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  className="text-action-btn"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                >
                  Sign up
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  className="text-action-btn"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </div>
      </main>

      <footer className="sf-footer">Built with Excalidraw</footer>
    </div>
  );
}
