import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {
  Sparkles,
  ArrowLeft,
  Share2,
  Download,
  Lock,
  Loader2,
  AlertTriangle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { getBoard, saveBoardScene, updateBoard } from '../services/boardService';
import { useAuthStore } from '../store/authStore';
import type { Board } from '../types';
import { useCollaboration, type RemoteCollaborator } from '../hooks/useCollaboration';
import { ShareModal } from '../components/ShareModal';

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

  const [board, setBoard] = useState<Board | null>(null);
  const [boardTitle, setBoardTitle] = useState('Untitled Board');
  const [initialScene, setInitialScene] = useState<InitialDataState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [showShareModal, setShowShareModal] = useState(false);

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const isApplyingRemoteRef = useRef(false);

  const lastSavedJsonRef = useRef<string>('');
  const pendingPayloadRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unsavedStorageKey = boardId ? `sketchflow_unsaved_${boardId}` : '';

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
    [boardId, unsavedStorageKey]
  );

  // Real-time collaboration handlers
  const handleRemoteSceneUpdate = useCallback(
    (remoteElements: readonly Record<string, unknown>[]) => {
      const api = excalidrawAPIRef.current;
      if (!api) return;

      const localElements =
        api.getSceneElementsIncludingDeleted() as unknown as ExcalidrawElementLike[];
      const merged = mergeElements(
        localElements,
        remoteElements as unknown as ExcalidrawElementLike[]
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
    const parsed = parseSceneSafe(sceneJson);
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

        const localBackup = localStorage.getItem(`sketchflow_unsaved_${boardId}`);
        if (localBackup && fetched.userRole !== 'VIEWER') {
          const parsed = parseSceneSafe(localBackup);
          setInitialScene(parsed);
          lastSavedJsonRef.current = fetched.sceneJson || '';
          pendingPayloadRef.current = localBackup;
          persistScene(localBackup);
        } else {
          const parsed = parseSceneSafe(fetched.sceneJson);
          setInitialScene(parsed);
          lastSavedJsonRef.current = JSON.stringify({
            elements: parsed.elements || [],
            appState: {
              viewBackgroundColor:
                parsed.appState?.viewBackgroundColor || '#ffffff',
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
          viewBackgroundColor: appState?.viewBackgroundColor || '#ffffff',
        },
      });

      if (serialized === lastSavedJsonRef.current) {
        return;
      }

      // Broadcast real-time update to peers (throttled at 80ms)
      sendSceneUpdate(elements);

      // Protect unsaved work locally immediately (FR-BOARD-07)
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
        <Loader2 size={32} className="spin" />
        <p>Loading board canvas...</p>
      </div>
    );
  }

  if (loadError || !board) {
    return (
      <div className="dashboard-empty" style={{ height: '100vh' }}>
        <AlertTriangle size={40} color="#ef4444" />
        <h3>Unable to open board</h3>
        <p>{loadError || 'Board not found.'}</p>
        <button
          type="button"
          className="sketchflow-btn sketchflow-btn-primary"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={15} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  const isViewer = board.userRole === 'VIEWER';
  const isOwner = board.userRole === 'OWNER';

  return (
    <div className="sketchflow-container">
      {/* Top Application Shell */}
      <header className="sketchflow-header">
        <div className="sketchflow-left-section">
          <button
            type="button"
            className="icon-btn"
            onClick={() => navigate('/dashboard')}
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>

          <div
            className="sketchflow-brand"
            onClick={() => navigate('/dashboard')}
            title="SketchFlow Workspace"
          >
            <div className="sketchflow-logo-icon">
              <Sparkles size={18} />
            </div>
            <span>SketchFlow</span>
          </div>

          <div className="sketchflow-divider" />

          {/* Board Title Input */}
          <div className="sketchflow-title-wrapper">
            <input
              type="text"
              className="sketchflow-title-input"
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
          </div>

          {/* Autosave Status Indicator */}
          {isViewer ? (
            <div className="sketchflow-save-indicator">
              <Lock size={12} />
              <span>View Only</span>
            </div>
          ) : (
            <div className="sketchflow-save-indicator">
              <span
                className={`sketchflow-save-dot ${
                  saveStatus === 'saving'
                    ? 'saving'
                    : saveStatus === 'offline'
                    ? 'offline'
                    : ''
                }`}
              />
              <span>
                {saveStatus === 'saved'
                  ? 'Saved'
                  : saveStatus === 'saving'
                  ? 'Saving...'
                  : 'Offline / Retrying'}
              </span>
            </div>
          )}
        </div>

        {/* Right Action Shell */}
        <div className="sketchflow-right-section">
          {/* Active Collaborator Avatars */}
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

          {/* WebSocket Live Sync Pill */}
          <div
            className="sketchflow-save-indicator"
            style={{ border: '1px solid #e2e8f0' }}
            title={collabError || 'Real-time WebSocket status'}
          >
            {wsStatus === 'connected' ? (
              <Wifi size={13} color="#10b981" />
            ) : (
              <WifiOff size={13} color="#f59e0b" />
            )}
            <span>
              {wsStatus === 'connected'
                ? `Live (${participants.length || 1})`
                : wsStatus === 'reconnecting'
                ? 'Syncing...'
                : 'Connecting WS...'}
            </span>
          </div>

          <button
            type="button"
            className="sketchflow-btn"
            onClick={() =>
              alert(
                'Use the top-left Excalidraw menu (≡) to export PNG, SVG, or JSON.'
              )
            }
            title="Export Board"
          >
            <Download size={15} />
            <span>Export</span>
          </button>

          <button
            type="button"
            className="sketchflow-btn sketchflow-btn-primary"
            onClick={() => setShowShareModal(true)}
            title="Invite Collaborators & Share"
          >
            <Share2 size={15} />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* Embedded Whiteboard Canvas */}
      <main className="sketchflow-canvas-wrapper">
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawAPIRef.current = api;
          }}
          name={boardTitle}
          initialData={initialScene || undefined}
          viewModeEnabled={isViewer}
          onChange={(elements, appState) => handleSceneChange(elements, appState)}
          onPointerUpdate={(payload) => {
            if (payload?.pointer) {
              sendCursorUpdate(payload.pointer, payload.button || 'up');
            }
          }}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: !isViewer,
              toggleTheme: true,
            },
          }}
        />
      </main>

      {showShareModal && (
        <ShareModal
          boardId={board.id}
          boardTitle={boardTitle}
          isOwner={isOwner}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
