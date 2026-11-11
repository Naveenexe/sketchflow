import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CaptureUpdateAction,
  Excalidraw,
  MainMenu,
  exportToBlob,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {
  ArrowLeft,
  Download,
  Share2,
  Loader2,
  Lock,
  AlertTriangle,
  Palette,
  Grid3X3,
  MoreHorizontal,
  Sun,
  Moon,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { THEME_MAP, useThemeStore } from '../store/themeStore';
import {
  adaptElementsForCanvas,
  isSafeEmbeddableUrl,
  resolveBoardBackground,
} from '../utils/sceneTheme';
import { getBoard, saveBoardScene, updateBoard } from '../services/boardService';
import type { Board } from '../types';
import { ShareModal } from '../components/ShareModal';
import { ExportModal } from '../components/ExportModal';
import { ThemePickerModal } from '../components/ThemePickerModal';
import { ThemeQuickControls } from '../components/ThemeQuickControls';
import { BrandMark } from '../components/BrandMark';
import {
  useCollaboration,
  type RemoteCollaborator,
} from '../hooks/useCollaboration';

type ExcalidrawProps = Parameters<typeof Excalidraw>[0];
type InitialDataState = Exclude<
  ExcalidrawProps['initialData'],
  ((...args: never[]) => unknown) | Promise<unknown> | null | undefined
>;
type ExcalidrawImperativeAPI = Parameters<
  NonNullable<ExcalidrawProps['excalidrawAPI']>
>[0];

interface ExcalidrawElementLike {
  id: string;
  version: number;
  versionNonce: number;
  [key: string]: unknown;
}

function parseSceneWithDefaults(
  raw: string | null | undefined,
  activeCanvas: string,
  activePen: string,
  sketchyStyle: boolean,
  gridModeEnabled: boolean
): InitialDataState {
  const defaultAppState = {
    viewBackgroundColor: activeCanvas,
    currentItemStrokeColor: activePen,
    currentItemRoughness: sketchyStyle ? 1 : 0,
    gridModeEnabled,
  };

  if (!raw) {
    return { elements: [], appState: defaultAppState } as InitialDataState;
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
    const resolvedBg = resolveBoardBackground(savedBg, activeCanvas);
    const adaptedElements = adaptElementsForCanvas(
      elements,
      resolvedBg,
      activePen
    );

    return {
      elements: adaptedElements,
      appState: {
        ...appState,
        viewBackgroundColor: resolvedBg,
        currentItemStrokeColor: activePen,
        currentItemRoughness: sketchyStyle ? 1 : 0,
        gridModeEnabled,
      },
    } as unknown as InitialDataState;
  } catch {
    return { elements: [], appState: defaultAppState } as InitialDataState;
  }
}

/**
 * Merge local and remote elements by element ID using Excalidraw's version
 * and versionNonce deterministic tie-breaking (FR-COLLAB-08).
 */
function mergeElements(
  localElements: readonly ExcalidrawElementLike[],
  remoteElements: readonly ExcalidrawElementLike[]
): ExcalidrawElementLike[] {
  const map = new Map<string, ExcalidrawElementLike>();

  for (const el of localElements) {
    map.set(el.id, el);
  }

  for (const remote of remoteElements) {
    const local = map.get(remote.id);
    if (!local) {
      map.set(remote.id, remote);
    } else if (
      remote.version > local.version ||
      (remote.version === local.version &&
        remote.versionNonce > local.versionNonce)
    ) {
      map.set(remote.id, remote);
    }
  }

  return Array.from(map.values());
}

export default function BoardEditorPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const presetId = useThemeStore((s) => s.presetId);
  const customCanvas = useThemeStore((s) => s.customCanvas);
  const customPen = useThemeStore((s) => s.customPen);
  const sketchyStyle = useThemeStore((s) => s.sketchyStyle);
  const canvasStyle = useThemeStore((s) => s.canvasStyle);
  const autoHideBar = useThemeStore((s) => s.autoHideBar);
  const setCanvasStyle = useThemeStore((s) => s.setCanvasStyle);
  const toggleLightDark = useThemeStore((s) => s.toggleLightDark);

  const currentPreset = THEME_MAP[presetId];
  const activeCanvas = customCanvas || currentPreset.canvas;
  const activePen = customPen || currentPreset.pen;

  const [board, setBoard] = useState<Board | null>(null);
  const [boardTitle, setBoardTitle] = useState('Untitled Board');
  const [initialScene, setInitialScene] = useState<InitialDataState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCollabPopover, setShowCollabPopover] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (!showMobileMenu && !showCollabPopover) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMobileMenu(false);
        setShowCollabPopover(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showMobileMenu, showCollabPopover]);

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const isApplyingRemoteRef = useRef(false);

  const lastSavedJsonRef = useRef<string>('');
  const pendingPayloadRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultsRef = useRef({
    activeCanvas,
    activePen,
    sketchyStyle,
    gridModeEnabled: canvasStyle === 'dots',
  });
  useEffect(() => {
    defaultsRef.current = {
      activeCanvas,
      activePen,
      sketchyStyle,
      gridModeEnabled: canvasStyle === 'dots',
    };
  }, [activeCanvas, activePen, sketchyStyle, canvasStyle]);

  const unsavedStorageKey = boardId ? `sketchflow_unsaved_${boardId}` : '';

  const cacheBoardThumbnail = useCallback(async (id: string) => {
    const api = excalidrawAPIRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    if (!elements || elements.length === 0) {
      try {
        localStorage.removeItem(`sketchflow_thumb_${id}`);
      } catch {
        // ignore
      }
      return;
    }
    try {
      const blob = await exportToBlob({
        elements,
        appState: {
          ...api.getAppState(),
          exportWithDarkMode: false,
        } as Parameters<typeof exportToBlob>[0]['appState'],
        files: api.getFiles(),
        maxWidthOrHeight: 400,
      });
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          try {
            localStorage.setItem(`sketchflow_thumb_${id}`, reader.result);
          } catch {
            // quota full — SVG fallback in BoardThumbnail handles it cleanly
          }
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      // ignore thumbnail failure
    }
  }, []);

  const persistScene = useCallback(
    async (payload: string) => {
      if (!boardId) return;
      setSaveStatus('saving');
      try {
        await saveBoardScene(boardId, payload);
        lastSavedJsonRef.current = payload;
        pendingPayloadRef.current = null;
        if (unsavedStorageKey) {
          localStorage.removeItem(unsavedStorageKey);
        }
        setSaveStatus('saved');
        cacheBoardThumbnail(boardId);
      } catch {
        setSaveStatus('offline');
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          if (pendingPayloadRef.current) {
            persistScene(pendingPayloadRef.current);
          }
        }, 5000);
      }
    },
    [boardId, unsavedStorageKey, cacheBoardThumbnail]
  );

  const prevThemeCanvasRef = useRef<string>(activeCanvas);
  const prevGridModeRef = useRef<boolean>(canvasStyle === 'dots');

  // Sync user's pen/roughness defaults dynamically into active Excalidraw instance
  useEffect(() => {
    const api = excalidrawAPIRef.current;
    if (!api || !board || board.userRole === 'VIEWER') return;
    isApplyingRemoteRef.current = true;
    api.updateScene({
      appState: {
        currentItemStrokeColor: activePen,
        currentItemRoughness: sketchyStyle ? 1 : 0,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 0);
  }, [activePen, sketchyStyle, board]);

  // Sync dot grid mode cleanly (componentDidUpdate in Excalidraw ignores prop changes)
  useEffect(() => {
    const api = excalidrawAPIRef.current;
    const gridEnabled = canvasStyle === 'dots';
    if (!api || !board) return;
    if (prevGridModeRef.current === gridEnabled) return;
    prevGridModeRef.current = gridEnabled;

    isApplyingRemoteRef.current = true;
    api.updateScene({
      appState: {
        gridModeEnabled: gridEnabled,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 0);
  }, [canvasStyle, board]);

  // Apply canvas & contrast adaptation whenever the user changes theme or custom canvas
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

    isApplyingRemoteRef.current = true;
    api.updateScene({
      elements: adapted as unknown as Parameters<
        ExcalidrawImperativeAPI['updateScene']
      >[0]['elements'],
      appState: {
        viewBackgroundColor: activeCanvas,
        currentItemStrokeColor: activePen,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 0);
  }, [activeCanvas, activePen, board]);

  // Real-time collaboration handlers
  const handleRemoteSceneUpdate = useCallback(
    (remoteElements: readonly Record<string, unknown>[]) => {
      const api = excalidrawAPIRef.current;
      if (!api) return;

      const { activeCanvas: bg, activePen: pen } = defaultsRef.current;
      const adaptedRemote = adaptElementsForCanvas(remoteElements, bg, pen);
      const localElements =
        api.getSceneElementsIncludingDeleted() as unknown as ExcalidrawElementLike[];
      const merged = mergeElements(
        localElements,
        adaptedRemote as unknown as ExcalidrawElementLike[]
      );

      isApplyingRemoteRef.current = true;
      api.updateScene({
        elements: merged as unknown as Parameters<
          ExcalidrawImperativeAPI['updateScene']
        >[0]['elements'],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 0);
    },
    []
  );

  const handleResyncState = useCallback((sceneJson: string) => {
    const api = excalidrawAPIRef.current;
    if (!api) return;
    const {
      activeCanvas: bg,
      activePen: pen,
      sketchyStyle: sketchy,
      gridModeEnabled: grid,
    } = defaultsRef.current;
    const parsed = parseSceneWithDefaults(sceneJson, bg, pen, sketchy, grid);
    const localElements =
      api.getSceneElementsIncludingDeleted() as unknown as ExcalidrawElementLike[];
    const remoteElements = (parsed.elements ||
      []) as unknown as ExcalidrawElementLike[];
    const merged = mergeElements(localElements, remoteElements);

    isApplyingRemoteRef.current = true;
    api.updateScene({
      elements: merged as unknown as Parameters<
        ExcalidrawImperativeAPI['updateScene']
      >[0]['elements'],
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 0);
  }, []);

  const handleCollaboratorsChange = useCallback(
    (collaborators: Map<string, RemoteCollaborator>) => {
      const api = excalidrawAPIRef.current;
      if (!api) return;
      api.updateScene({
        collaborators: collaborators as unknown as Parameters<
          ExcalidrawImperativeAPI['updateScene']
        >[0]['collaborators'],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    []
  );

  const {
    wsStatus,
    participants,
    collabError,
    sendSceneUpdate,
    sendCursorUpdate,
  } = useCollaboration({
    boardId: board ? board.id : undefined,
    token,
    currentUserId: user?.userId,
    userRole: board?.userRole,
    onRemoteSceneUpdate: handleRemoteSceneUpdate,
    onResyncState: handleResyncState,
    onCollaboratorsChange: handleCollaboratorsChange,
  });

  useEffect(() => {
    if (!boardId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const fetched = await getBoard(boardId!);
        if (cancelled) return;

        setBoard(fetched);
        setBoardTitle(fetched.title);

        const {
          activeCanvas: bg,
          activePen: pen,
          sketchyStyle: sketchy,
          gridModeEnabled: grid,
        } = defaultsRef.current;
        const localBackup = localStorage.getItem(`sketchflow_unsaved_${boardId}`);
        if (localBackup && fetched.userRole !== 'VIEWER') {
          const parsed = parseSceneWithDefaults(localBackup, bg, pen, sketchy, grid);
          setInitialScene(parsed);
          lastSavedJsonRef.current = fetched.sceneJson || '';
          pendingPayloadRef.current = localBackup;
          persistScene(localBackup);
        } else {
          const parsed = parseSceneWithDefaults(fetched.sceneJson, bg, pen, sketchy, grid);
          setInitialScene(parsed);
          lastSavedJsonRef.current = JSON.stringify({
            elements: parsed.elements || [],
            appState: {
              viewBackgroundColor: parsed.appState?.viewBackgroundColor || bg,
            },
          });
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setLoadError(
          axiosErr?.response?.data?.error || 'Could not load this board.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [boardId, persistScene]);

  useEffect(() => {
    const handleOnline = () => {
      if (pendingPayloadRef.current) {
        persistScene(pendingPayloadRef.current);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [persistScene]);

  const handleSceneChange = useCallback(
    (
      elements: readonly unknown[],
      appState: { viewBackgroundColor?: string }
    ) => {
      if (isApplyingRemoteRef.current) return;
      if (!board || board.userRole === 'VIEWER') return;

      const serialized = JSON.stringify({
        elements,
        appState: {
          viewBackgroundColor:
            appState?.viewBackgroundColor || defaultsRef.current.activeCanvas,
        },
      });

      if (serialized === lastSavedJsonRef.current) {
        return;
      }

      sendSceneUpdate(elements);

      pendingPayloadRef.current = serialized;
      if (unsavedStorageKey) {
        localStorage.setItem(unsavedStorageKey, serialized);
      }
      setSaveStatus('saving');

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistScene(serialized);
      }, 1200);
    },
    [board, persistScene, sendSceneUpdate, unsavedStorageKey]
  );

  const handleTitleSave = async () => {
    if (!boardId || !board || board.userRole !== 'OWNER') return;
    const trimmed = boardTitle.trim();
    if (!trimmed || trimmed === board.title) {
      setBoardTitle(board.title);
      return;
    }
    setSaveStatus('saving');
    try {
      const updated = await updateBoard(boardId, { title: trimmed });
      setBoard(updated);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('offline');
    }
  };

  if (loading) {
    return (
      <div className="dashboard-empty sf-fullscreen-state">
        <Loader2 size={16} strokeWidth={1.5} className="spin" />
        <p>Loading board...</p>
      </div>
    );
  }

  if (loadError || !board) {
    return (
      <div className="dashboard-empty sf-fullscreen-state">
        <AlertTriangle size={20} strokeWidth={1.5} color="var(--danger)" />
        <h3>Unable to open board</h3>
        <p>{loadError || 'Board not found.'}</p>
        <button
          type="button"
          className="sf-btn sf-btn-primary"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  const isViewer = board.userRole === 'VIEWER';
  const isOwner = board.userRole === 'OWNER';

  const saveLabel = isViewer
    ? 'View only'
    : saveStatus === 'saved'
    ? 'Saved'
    : saveStatus === 'saving'
    ? 'Saving...'
    : 'Offline';
  const dotClass = isViewer
    ? ''
    : saveStatus === 'saved'
    ? 'live'
    : saveStatus === 'offline'
    ? 'error'
    : '';
  const wsLabel =
    wsStatus === 'connected'
      ? `Live (${participants.length || 1})`
      : wsStatus === 'reconnecting'
      ? 'Syncing...'
      : 'Connecting...';
  const mobileDotClass =
    saveStatus === 'offline'
      ? 'error'
      : saveStatus === 'saving' || wsStatus === 'reconnecting'
      ? ''
      : 'live';
  const mobileStatusLabel = `${saveLabel} • ${wsLabel}`;

  return (
    <div
      className={`sketchflow-container sketchflow-editor-shell ${
        autoHideBar ? 'sf-container-autohide' : ''
      } ${autoHideBar && isDrawing ? 'is-drawing' : ''}`}
      data-canvas-style={canvasStyle}
    >
      <header className="sf-topbar sf-topbar-auto-hide">
        <div className="sf-topbar-left">
          <button
            type="button"
            className="icon-btn"
            onClick={() => navigate('/dashboard')}
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft size={20} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            className="sf-brand sf-desktop-only"
            onClick={() => navigate('/dashboard')}
            title="SketchFlow Workspace"
          >
            <BrandMark size={20} />
            <span>SketchFlow</span>
          </button>

          <div className="sf-divider sf-desktop-only" />

          <input
            type="text"
            className="sf-title-input"
            value={boardTitle}
            onChange={(e) => setBoardTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            disabled={!isOwner}
            title={
              isOwner ? 'Click to rename board' : 'Only the owner can rename'
            }
            aria-label="Board title"
          />

          {isViewer ? (
            <div className="status-indicator sf-desktop-only">
              <Lock size={16} strokeWidth={1.5} />
              <span>View only</span>
            </div>
          ) : (
            <div className="status-indicator sf-desktop-only">
              <span className={`status-dot ${dotClass}`} />
              <span>{saveLabel}</span>
            </div>
          )}
        </div>

        <div className="sf-topbar-right">
          <span
            className={`status-dot sf-editor-status-dot sf-mobile-only ${mobileDotClass}`}
            title={mobileStatusLabel}
            aria-label={mobileStatusLabel}
          />

          {participants.length > 0 && (
            <div
              className="collab-avatars sf-desktop-only"
              title={participants
                .map((p) => `${p.displayName} (${p.role})`)
                .join(', ')}
            >
              {participants.slice(0, 5).map((p, idx) => (
                <div
                  key={`${p.userId}-${idx}`}
                  className="collab-avatar"
                  style={{ backgroundColor: p.color }}
                  title={`${p.displayName} (${p.role})`}
                >
                  {p.displayName.slice(0, 2).toUpperCase()}
                </div>
              ))}
              {participants.length > 5 && (
                <button
                  type="button"
                  className="collab-avatar collab-avatar-more"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowCollabPopover((v) => !v);
                  }}
                  aria-label={`${participants.length} active collaborators`}
                >
                  +{participants.length - 5}
                </button>
              )}
            </div>
          )}

          <div
            className="status-indicator sf-desktop-only"
            title={collabError || 'Real-time WebSocket status'}
          >
            <span
              className={`status-dot ${wsStatus === 'connected' ? 'live' : ''}`}
            />
            <span>{wsLabel}</span>
          </div>

          <div className="sf-desktop-only">
            <ThemeQuickControls showEditorOptions={true} />
          </div>

          <button
            type="button"
            className="sf-btn sf-desktop-only"
            onClick={() => setShowExportModal(true)}
            title="Export & Backup Board"
          >
            <Download size={16} strokeWidth={1.5} />
            <span>Export</span>
          </button>

          <button
            type="button"
            className="sf-btn sf-btn-primary sf-btn-share"
            onClick={() => setShowShareModal(true)}
            title="Invite Collaborators & Share"
          >
            <Share2 size={16} strokeWidth={1.5} />
            <span>Share</span>
          </button>

          <button
            type="button"
            className="icon-btn sf-mobile-only"
            onClick={() => {
              setShowCollabPopover(false);
              setShowMobileMenu((v) => !v);
            }}
            aria-label="More options"
            aria-expanded={showMobileMenu}
          >
            <MoreHorizontal size={20} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {showCollabPopover && (
        <>
          <div
            className="sf-popover-backdrop"
            onClick={() => setShowCollabPopover(false)}
          />
          <div className="sf-popover-menu" role="dialog" aria-label="Active collaborators">
            <div className="sf-popover-header">
              <span>Collaborators ({participants.length})</span>
            </div>
            {participants.length === 0 ? (
              <div className="sf-popover-status-row">
                <span>No active collaborators right now.</span>
              </div>
            ) : (
              participants.map((p, idx) => (
                <div key={`${p.userId}-${idx}`} className="sf-collab-row">
                  <div className="sf-collab-row-user">
                    <div
                      className="collab-avatar"
                      style={{ backgroundColor: p.color, marginLeft: 0 }}
                    >
                      {p.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="sf-collab-row-name">{p.displayName}</span>
                  </div>
                  <span className="role-text">{p.role.toLowerCase()}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}

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
              {isViewer ? (
                <Lock size={16} strokeWidth={1.5} />
              ) : (
                <span className={`status-dot ${dotClass}`} />
              )}
              <span>{saveLabel}</span>
            </div>
            <div className="sf-popover-status-row">
              <span
                className={`status-dot ${wsStatus === 'connected' ? 'live' : ''}`}
              />
              <span>{wsLabel}</span>
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
              <span>Appearance &amp; Canvas</span>
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
            <button
              type="button"
              className="sf-popover-item"
              role="menuitem"
              onClick={() => {
                setShowMobileMenu(false);
                setShowCollabPopover(true);
              }}
            >
              <Users size={16} strokeWidth={1.5} />
              <span>Collaborators ({participants.length})</span>
            </button>
          </div>
        </>
      )}

      <main className="sketchflow-canvas-wrapper">
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawAPIRef.current = api;
          }}
          name={boardTitle}
          theme={currentPreset.mode}
          initialData={initialScene || undefined}
          viewModeEnabled={isViewer}
          validateEmbeddable={isSafeEmbeddableUrl}
          onChange={(elements, appState) => handleSceneChange(elements, appState)}
          onPointerUpdate={(payload) => {
            if (autoHideBar) {
              setIsDrawing(payload?.button === 'down');
            }
            if (payload?.pointer) {
              sendCursorUpdate(payload.pointer, payload.button || 'up');
            }
          }}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: !isViewer,
              toggleTheme: false,
            },
            tools: {
              image: !isViewer,
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
              Appearance &amp; Canvas
            </MainMenu.Item>
            <MainMenu.Item
              icon={<Grid3X3 size={16} strokeWidth={1.5} />}
              onSelect={() =>
                setCanvasStyle(canvasStyle === 'dots' ? 'plain' : 'dots')
              }
            >
              {canvasStyle === 'dots' ? 'Hide dot grid' : 'Show dot grid'}
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

      {showShareModal && (
        <ShareModal
          boardId={board.id}
          boardTitle={boardTitle}
          isOwner={isOwner}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showThemeModal && (
        <ThemePickerModal
          onClose={() => setShowThemeModal(false)}
          showEditorOptions={true}
        />
      )}

      {showExportModal && (
        <ExportModal
          boardTitle={boardTitle}
          canImport={!isViewer}
          getSceneData={() => {
            const api = excalidrawAPIRef.current;
            if (!api) return null;
            return {
              elements: api.getSceneElements(),
              appState: api.getAppState() as unknown as Record<string, unknown>,
              files: api.getFiles() as unknown as Record<string, unknown>,
            };
          }}
          onImportScene={(elements, appState) => {
            const api = excalidrawAPIRef.current;
            if (!api || isViewer) return;
            api.updateScene({
              elements: elements as unknown as Parameters<
                ExcalidrawImperativeAPI['updateScene']
              >[0]['elements'],
              appState: appState as unknown as Parameters<
                ExcalidrawImperativeAPI['updateScene']
              >[0]['appState'],
            });
            handleSceneChange(elements, appState as { viewBackgroundColor?: string });
          }}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
