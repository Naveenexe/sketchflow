import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Sparkles, Lock, Download, Loader2, ShieldAlert, LogIn } from 'lucide-react';
import { resolveShareLink } from '../services/boardService';
import { useAuthStore } from '../store/authStore';
import type { Board } from '../types';
import { ExportModal } from '../components/ExportModal';

type ExcalidrawProps = Parameters<typeof Excalidraw>[0];
type InitialDataState = Exclude<
  ExcalidrawProps['initialData'],
  ((...args: never[]) => unknown) | Promise<unknown> | null | undefined
>;
type ExcalidrawImperativeAPI = Parameters<
  NonNullable<ExcalidrawProps['excalidrawAPI']>
>[0];

function parseSceneSafe(raw: string | null | undefined): InitialDataState {
  if (!raw) return { elements: [], appState: { viewBackgroundColor: '#ffffff' } };
  try {
    const parsed = JSON.parse(raw) as {
      elements?: unknown[];
      appState?: Record<string, unknown>;
    };
    const appState = { ...(parsed.appState || {}) };
    delete appState.collaborators;
    return {
      elements: Array.isArray(parsed.elements) ? parsed.elements : [],
      appState,
    } as InitialDataState;
  } catch {
    return { elements: [], appState: { viewBackgroundColor: '#ffffff' } };
  }
}

export default function SharedBoardPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const resolved = await resolveShareLink(token!);
        if (cancelled) return;
        if (resolved.userRole === 'EDITOR' && isAuthenticated) {
          navigate(`/board/${resolved.id}`, { replace: true });
          return;
        }
        setBoard(resolved);
      } catch (err: unknown) {
        if (cancelled) return;
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(
          axiosErr?.response?.data?.error ||
            'This share link is invalid, expired, or has been revoked.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="dashboard-empty" style={{ height: '100vh' }}>
        <Loader2 size={32} className="spin" />
        <p>Opening shared board...</p>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="dashboard-empty" style={{ height: '100vh' }}>
        <ShieldAlert size={44} color="#ef4444" />
        <h3>Share link unavailable</h3>
        <p>{error}</p>
        <button
          type="button"
          className="sketchflow-btn sketchflow-btn-primary"
          onClick={() => navigate('/login')}
        >
          <LogIn size={15} />
          <span>Sign in to SketchFlow</span>
        </button>
      </div>
    );
  }

  const initialScene = parseSceneSafe(board.sceneJson);

  return (
    <div className="sketchflow-container">
      <header className="sketchflow-header">
        <div className="sketchflow-left-section">
          <div
            className="sketchflow-brand"
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
          >
            <div className="sketchflow-logo-icon">
              <Sparkles size={18} />
            </div>
            <span>SketchFlow</span>
          </div>

          <div className="sketchflow-divider" />

          <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
            {board.title}
          </span>

          <div className="sketchflow-save-indicator">
            <Lock size={12} />
            <span>Public Read-Only Link</span>
          </div>
        </div>

        <div className="sketchflow-right-section">
          <button
            type="button"
            className="sketchflow-btn"
            onClick={() => setShowExportModal(true)}
          >
            <Download size={15} />
            <span>Export</span>
          </button>

          {!isAuthenticated && (
            <button
              type="button"
              className="sketchflow-btn sketchflow-btn-primary"
              onClick={() => navigate('/login')}
            >
              <LogIn size={15} />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </header>

      <main className="sketchflow-canvas-wrapper">
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawAPIRef.current = api;
          }}
          name={board.title}
          initialData={initialScene}
          viewModeEnabled={true}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              toggleTheme: true,
            },
          }}
        />
      </main>

      {showExportModal && (
        <ExportModal
          boardTitle={board.title}
          canImport={false}
          getSceneData={() => {
            const api = excalidrawAPIRef.current;
            if (!api) return null;
            return {
              elements: api.getSceneElements(),
              appState: api.getAppState() as unknown as Record<string, unknown>,
              files: api.getFiles() as unknown as Record<string, unknown>,
            };
          }}
          onImportScene={() => {}}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
