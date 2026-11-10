import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Excalidraw, MainMenu, exportToBlob } from '@excalidraw/excalidraw';
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
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { THEME_MAP, useThemeStore } from '../store/themeStore';
import {
  adaptElementsForCanvas,
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
  sketchyStyle: boolean
): InitialDataState {
  const defaultAppState = {
    viewBackgroundColor: activeCanvas,
    currentItemStrokeColor: activePen,
    currentItemRoughness: sketchyStyle ? 1 : 0,
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
  const [isDrawing, setIsDrawing] = useState(false);

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const isApplyingRemoteRef = useRef(false);

  const lastSavedJsonRef = useRef<string>('');
  const pendingPayloadRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultsRef = useRef({ activeCanvas, activePen, sketchyStyle });
  useEffect(() => {
    defaultsRef.current = { activeCanvas, activePen, sketchyStyle };
  }, [activeCanvas, activePen, sketchyStyle]);

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
    });
    setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 0);
  }, [activePen, sketchyStyle, board]);

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
    const { activeCanvas: bg, activePen: pen, sketchyStyle: sketchy } =
      defaultsRef.current;
    const parsed = parseSceneWithDefaults(sceneJson, bg, pen, sketchy);
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

        const { activeCanvas: bg, activePen: pen, sketchyStyle: sketchy } =
          defaultsRef.current;
        const localBackup = localStorage.getItem(`sketchflow_unsaved_${boardId}`);
        if (localBackup && fetched.userRole !== 'VIEWER') {
          const parsed = parseSceneWithDefaults(localBackup, bg, pen, sketchy);
          setInitialScene(parsed);
          lastSavedJsonRef.current = fetched.sceneJson || '';
          pendingPayloadRef.current = localBackup;
          persistScene(localBackup);
        } else {
          const parsed = parseSceneWithDefaults(fetched.sceneJson, bg, pen, sketchy);
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
      <div className="dashboard-empty" style={{ height: '100vh' }}>
        <Loader2 size={16} strokeWidth={1.5} className="spin" />
        <p>Loading board...</p>
      </div>
    );
  }

  if (loadError || !board) {
    return (
      <div className="dashboard-empty" style={{ height: '100vh' }}>
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
            className="sf-brand"
            onClick={() => navigate('/dashboard')}
            title="SketchFlow Workspace"
          >
            <BrandMark size={20} />
            <span>SketchFlow</span>
          </button>

          <div className="sf-divider" />

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
            <div className="status-indicator">
              <Lock size={16} strokeWidth={1.5} />
              <span>View only</span>
            </div>
          ) : (
            <div className="status-indicator">
              <span
                className={`status-dot ${
                  saveStatus === 'saved'
                    ? 'live'
                    : saveStatus === 'offline'
                    ? 'error'
                    : ''
                }`}
              />
              <span>
                {saveStatus === 'saved'
                  ? 'Saved'
                  : saveStatus === 'saving'
                  ? 'Saving...'
                  : 'Offline'}
              </span>
            </div>
          )}
        </div>

        <div className="sf-topbar-right">
          {participants.length > 0 && (
            <div
              className="collab-avatars"
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
                <div className="collab-avatar collab-avatar-more">
                  +{participants.length - 5}
                </div>
              )}
            </div>
          )}

          <div
            className="status-indicator"
            title={collabError || 'Real-time WebSocket status'}
          >
            <span
              className={`status-dot ${wsStatus === 'connected' ? 'live' : ''}`}
            />
            <span>
              {wsStatus === 'connected'
                ? `Live (${participants.length || 1})`
                : wsStatus === 'reconnecting'
                ? 'Syncing...'
                : 'Connecting...'}
            </span>
          </div>

          <ThemeQuickControls showEditorOptions={true} />

          <button
            type="button"
            className="sf-btn"
            onClick={() => setShowExportModal(true)}
            title="Export & Backup Board"
          >
            <Download size={16} strokeWidth={1.5} />
            <span>Export</span>
          </button>

          <button
            type="button"
            className="sf-btn sf-btn-primary"
            onClick={() => setShowShareModal(true)}
            title="Invite Collaborators & Share"
          >
            <Share2 size={16} strokeWidth={1.5} />
            <span>Share</span>
          </button>
        </div>
      </header>

      <main className="sketchflow-canvas-wrapper">
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawAPIRef.current = api;
          }}
          name={boardTitle}
          theme={currentPreset.mode}
          gridModeEnabled={canvasStyle === 'dots'}
          initialData={initialScene || undefined}
          viewModeEnabled={isViewer}
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
