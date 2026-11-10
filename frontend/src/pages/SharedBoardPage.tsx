import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Lock, Download, Loader2, ShieldAlert, LogIn, Palette } from 'lucide-react';
import { resolveShareLink } from '../services/boardService';
import { useAuthStore } from '../store/authStore';
import { THEME_MAP, useThemeStore } from '../store/themeStore';
import type { Board } from '../types';
import { ExportModal } from '../components/ExportModal';
import { BrandMark } from '../components/BrandMark';
import { ThemeQuickControls } from '../components/ThemeQuickControls';
import { ThemePickerModal } from '../components/ThemePickerModal';

type ExcalidrawProps = Parameters<typeof Excalidraw>[0];
type InitialDataState = Exclude<
  ExcalidrawProps['initialData'],
  ((...args: never[]) => unknown) | Promise<unknown> | null | undefined
>;
type ExcalidrawImperativeAPI = Parameters<
  NonNullable<ExcalidrawProps['excalidrawAPI']>
>[0];

function parseSceneSafe(
  raw: string | null | undefined,
  fallbackCanvas: string
): InitialDataState {
  if (!raw) {
    return { elements: [], appState: { viewBackgroundColor: fallbackCanvas } };
  }
  try {
    const parsed = JSON.parse(raw) as {
      elements?: unknown[];
      appState?: Record<string, unknown>;
    };
    const elements = Array.isArray(parsed.elements) ? parsed.elements : [];
    const appState = { ...(parsed.appState || {}) };
    delete appState.collaborators;

    const savedBg =
      typeof appState.viewBackgroundColor === 'string'
        ? appState.viewBackgroundColor
        : undefined;
    const isEmptyDefaultBg =
      elements.length === 0 && (!savedBg || savedBg.toLowerCase() === '#ffffff');

    return {
      elements,
      appState: {
        ...appState,
        viewBackgroundColor:
          isEmptyDefaultBg || !savedBg ? fallbackCanvas : savedBg,
      },
    } as InitialDataState;
  } catch {
    return { elements: [], appState: { viewBackgroundColor: fallbackCanvas } };
  }
}

export default function SharedBoardPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const presetId = useThemeStore((s) => s.presetId);
  const customCanvas = useThemeStore((s) => s.customCanvas);
  const canvasStyle = useThemeStore((s) => s.canvasStyle);
  const currentPreset = THEME_MAP[presetId];
  const activeCanvas = customCanvas || currentPreset.canvas;

  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

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
        <Loader2 size={16} strokeWidth={1.5} className="spin" />
        <p>Opening shared board...</p>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="dashboard-empty" style={{ height: '100vh' }}>
        <ShieldAlert size={20} strokeWidth={1.5} color="var(--danger)" />
        <h3>Share link unavailable</h3>
        <p>{error}</p>
        <button
          type="button"
          className="sf-btn sf-btn-primary"
          onClick={() => navigate('/login')}
        >
          <LogIn size={16} strokeWidth={1.5} />
          <span>Sign in to SketchFlow</span>
        </button>
      </div>
    );
  }

  const initialScene = parseSceneSafe(board.sceneJson, activeCanvas);

  return (
    <div
      className="sketchflow-container sketchflow-editor-shell"
      data-canvas-style={canvasStyle}
    >
      <header className="sf-topbar">
        <div className="sf-topbar-left">
          <button
            type="button"
            className="sf-brand"
            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
          >
            <BrandMark size={20} />
            <span>SketchFlow</span>
          </button>

          <div className="sf-divider" />

          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
            {board.title}
          </span>

          <div className="status-indicator">
            <Lock size={16} strokeWidth={1.5} />
            <span>Public read-only</span>
          </div>
        </div>

        <div className="sf-topbar-right">
          <ThemeQuickControls showEditorOptions={false} />

          <button
            type="button"
            className="sf-btn"
            onClick={() => setShowExportModal(true)}
          >
            <Download size={16} strokeWidth={1.5} />
            <span>Export</span>
          </button>

          {!isAuthenticated && (
            <button
              type="button"
              className="sf-btn sf-btn-primary"
              onClick={() => navigate('/login')}
            >
              <LogIn size={16} strokeWidth={1.5} />
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
          theme={currentPreset.mode}
          gridModeEnabled={canvasStyle === 'dots'}
          initialData={initialScene}
          viewModeEnabled={true}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              toggleTheme: false,
            },
            tools: {
              image: false,
            },
          }}
        >
          <MainMenu>
            <MainMenu.Item
              icon={<Download size={16} strokeWidth={1.5} />}
              onSelect={() => setShowExportModal(true)}
            >
              Export &amp; Backup
            </MainMenu.Item>
            <MainMenu.Item
              icon={<Palette size={16} strokeWidth={1.5} />}
              onSelect={() => setShowThemeModal(true)}
            >
              Appearance
            </MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.ItemCustom>
              <div className="excalidraw-credit" style={{ padding: '4px 12px' }}>
                Built with Excalidraw
              </div>
            </MainMenu.ItemCustom>
          </MainMenu>
        </Excalidraw>
      </main>

      {showThemeModal && (
        <ThemePickerModal
          onClose={() => setShowThemeModal(false)}
          showEditorOptions={false}
        />
      )}

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
