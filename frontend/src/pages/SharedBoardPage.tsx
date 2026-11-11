import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CaptureUpdateAction, Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {
  Lock,
  Download,
  Loader2,
  ShieldAlert,
  LogIn,
  Palette,
  MoreHorizontal,
  Sun,
  Moon,
} from 'lucide-react';
import { resolveShareLink } from '../services/boardService';
import { useAuthStore } from '../store/authStore';
import { THEME_MAP, useThemeStore } from '../store/themeStore';
import {
  adaptElementsForCanvas,
  isSafeEmbeddableUrl,
  resolveBoardBackground,
} from '../utils/sceneTheme';
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
  fallbackCanvas: string,
  fallbackPen: string
): InitialDataState {
  if (!raw) {
    return { elements: [], appState: { viewBackgroundColor: fallbackCanvas } };
  }
  try {
    const parsed = JSON.parse(raw) as {
      elements?: unknown[];
      appState?: Record<string, unknown>;
    };
    const elements = Array.isArray(parsed.elements)
      ? (parsed.elements as Record<string, unknown>[])
      : [];
    const appState = { ...(parsed.appState || {}) };
    delete appState.collaborators;

    const savedBg =
      typeof appState.viewBackgroundColor === 'string'
        ? appState.viewBackgroundColor
        : undefined;
    const resolvedBg = resolveBoardBackground(savedBg, fallbackCanvas);
    const adaptedElements = adaptElementsForCanvas(
      elements,
      resolvedBg,
      fallbackPen
    );

    return {
      elements: adaptedElements,
      appState: {
        ...appState,
        viewBackgroundColor: resolvedBg,
      },
    } as unknown as InitialDataState;
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
  const customPen = useThemeStore((s) => s.customPen);
  const canvasStyle = useThemeStore((s) => s.canvasStyle);
  const toggleLightDark = useThemeStore((s) => s.toggleLightDark);
  const currentPreset = THEME_MAP[presetId];
  const activeCanvas = customCanvas || currentPreset.canvas;
  const activePen = customPen || currentPreset.pen;

  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    if (!showMobileMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMobileMenu(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showMobileMenu]);

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const prevThemeCanvasRef = useRef<string>(activeCanvas);

  useEffect(() => {
    const api = excalidrawAPIRef.current;
    if (!api || !board) return;
    if (prevThemeCanvasRef.current === activeCanvas) return;
    prevThemeCanvasRef.current = activeCanvas;

    const currentElements =
      api.getSceneElementsIncludingDeleted() as unknown as Record<string, unknown>[];
    const adapted = adaptElementsForCanvas(
      currentElements,
      activeCanvas,
      activePen
    );
    api.updateScene({
      elements: adapted as unknown as Parameters<
        ExcalidrawImperativeAPI['updateScene']
      >[0]['elements'],
      appState: {
        viewBackgroundColor: activeCanvas,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [activeCanvas, activePen, board]);

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
      <div className="dashboard-empty sf-fullscreen-state">
        <Loader2 size={16} strokeWidth={1.5} className="spin" />
        <p>Opening shared board...</p>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="dashboard-empty sf-fullscreen-state">
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

  const initialScene = parseSceneSafe(board.sceneJson, activeCanvas, activePen);

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
            aria-label="SketchFlow"
          >
            <BrandMark size={20} />
            <span className="sf-desktop-only">SketchFlow</span>
          </button>

          <div className="sf-divider sf-desktop-only" />

          <span className="sf-shared-title" title={board.title}>
            {board.title}
          </span>

          <div className="status-indicator sf-desktop-only">
            <Lock size={16} strokeWidth={1.5} />
            <span>Public read-only</span>
          </div>
        </div>

        <div className="sf-topbar-right">
          <div className="sf-desktop-only">
            <ThemeQuickControls showEditorOptions={false} />
          </div>

          <button
            type="button"
            className="sf-btn sf-desktop-only"
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

          <button
            type="button"
            className="icon-btn sf-mobile-only"
            onClick={() => setShowMobileMenu((v) => !v)}
            aria-label="More options"
            aria-expanded={showMobileMenu}
          >
            <MoreHorizontal size={20} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {showMobileMenu && (
        <>
          <div
            className="sf-popover-backdrop"
            onClick={() => setShowMobileMenu(false)}
          />
          <div className="sf-popover-menu" role="menu">
            <div className="sf-popover-header">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <BrandMark size={16} />
                <span>SketchFlow</span>
              </span>
            </div>
            <div className="sf-popover-status-row">
              <Lock size={16} strokeWidth={1.5} />
              <span>Public read-only</span>
            </div>
            <div className="sf-popover-divider" />
            <button
              type="button"
              className="sf-popover-item"
              role="menuitem"
              onClick={() => {
                toggleLightDark();
                setShowMobileMenu(false);
              }}
            >
              {currentPreset.mode === 'dark' ? (
                <Sun size={16} strokeWidth={1.5} />
              ) : (
                <Moon size={16} strokeWidth={1.5} />
              )}
              <span>
                {currentPreset.mode === 'dark'
                  ? 'Switch to light theme'
                  : 'Switch to dark theme'}
              </span>
            </button>
            <button
              type="button"
              className="sf-popover-item"
              role="menuitem"
              onClick={() => {
                setShowMobileMenu(false);
                setShowThemeModal(true);
              }}
            >
              <Palette size={16} strokeWidth={1.5} />
              <span>Appearance</span>
            </button>
            <button
              type="button"
              className="sf-popover-item"
              role="menuitem"
              onClick={() => {
                setShowMobileMenu(false);
                setShowExportModal(true);
              }}
            >
              <Download size={16} strokeWidth={1.5} />
              <span>Export &amp; Backup</span>
            </button>
          </div>
        </>
      )}

      <main className="sketchflow-canvas-wrapper">
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawAPIRef.current = api;
          }}
          name={board.title}
          theme={currentPreset.mode}
          initialData={initialScene}
          viewModeEnabled={true}
          validateEmbeddable={isSafeEmbeddableUrl}
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
