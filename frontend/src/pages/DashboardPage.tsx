import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  LogOut,
  Trash2,
  Copy,
  Archive,
  ArchiveRestore,
  Edit3,
  Loader2,
  Search,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import {
  createBoard,
  deleteBoard,
  duplicateBoard,
  listBoards,
  updateBoard,
} from '../services/boardService';
import type { Board } from '../types';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { BrandMark } from '../components/BrandMark';
import { ThemeQuickControls } from '../components/ThemeQuickControls';
import { BoardThumbnail } from '../components/BoardThumbnail';

function formatRelativeTime(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return 'recently';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'edited just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `edited ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `edited ${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `edited ${diffDay}d ago`;
  return `edited ${new Date(isoDate).toLocaleDateString()}`;
}

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const newInputRef = useRef<HTMLInputElement | null>(null);

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'title'>('updated');
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadBoards = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBoards();
      setBoards(data);
    } catch {
      setError('Could not load boards. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoards();
  }, []);

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const useUntitled = typeof window !== 'undefined' && window.innerWidth < 640;
    const title = (useUntitled ? '' : newTitle.trim()) || 'Untitled Board';
    setCreating(true);
    setError(null);
    try {
      const created = await createBoard({ title });
      setNewTitle('');
      navigate(`/board/${created.id}`);
    } catch {
      setError('Failed to create board.');
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (boardId: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await updateBoard(boardId, { title: trimmed });
      setBoards((prev) => prev.map((b) => (b.id === boardId ? updated : b)));
    } catch {
      setError('Only the board owner can rename this board.');
    } finally {
      setEditingId(null);
    }
  };

  const handleDuplicate = async (boardId: string) => {
    try {
      const copy = await duplicateBoard(boardId);
      setBoards((prev) => [copy, ...prev]);
    } catch {
      setError('Failed to duplicate board.');
    }
  };

  const handleToggleArchive = async (board: Board) => {
    try {
      const updated = await updateBoard(board.id, { archived: !board.archived });
      setBoards((prev) => prev.map((b) => (b.id === board.id ? updated : b)));
    } catch {
      setError('Failed to update archive status.');
    }
  };

  const handleDelete = async (board: Board) => {
    if (!window.confirm(`Delete "${board.title}" permanently? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteBoard(board.id);
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
    } catch {
      setError('Failed to delete board.');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleBoards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return boards
      .filter((b) => Boolean(b.archived) === showArchived)
      .filter((b) => !query || b.title.toLowerCase().includes(query))
      .sort((a, b) => {
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [boards, showArchived, searchQuery, sortBy]);

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'SF';

  return (
    <div className="dashboard-layout">
      <header className="sf-topbar">
        <div className="sf-topbar-left">
          <div className="sf-brand" style={{ cursor: 'default' }}>
            <BrandMark size={20} />
            <span>SketchFlow</span>
          </div>
          <div className="sf-divider sf-desktop-only" />
          <span
            className="sf-desktop-only"
            style={{ color: 'var(--ink-muted)', fontSize: 13 }}
          >
            Workspace
          </span>
        </div>

        <div className="sf-topbar-right">
          <div className="sf-desktop-only">
            <CloudStatusBadge />
          </div>
          <ThemeQuickControls showEditorOptions={false} />
          <div className="sf-user-badge sf-desktop-only" title={user?.email}>
            <div className="sf-avatar">{initials}</div>
            <span>{user?.displayName || 'User'}</span>
          </div>
          <button
            type="button"
            className="sf-btn"
            onClick={handleLogout}
            title="Sign Out"
            aria-label="Sign out"
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span className="sf-desktop-only">Sign out</span>
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-toolbar">
          <form onSubmit={handleCreate} className="create-board-form">
            <input
              ref={newInputRef}
              type="text"
              className="sf-input create-board-input"
              placeholder="New board title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={creating}
            />
            <button
              type="submit"
              className="sf-btn sf-btn-primary create-board-submit"
              disabled={creating}
            >
              {creating ? (
                <Loader2 size={16} strokeWidth={1.5} className="spin" />
              ) : (
                <Plus size={16} strokeWidth={1.5} />
              )}
              <span>New board</span>
            </button>
          </form>

          <div className="dashboard-filters">
            <div className="search-input-wrap">
              <Search size={16} strokeWidth={1.5} className="search-input-icon" />
              <input
                type="search"
                className="sf-input"
                placeholder="Search title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search boards by title"
              />
            </div>

            <select
              className="sf-select dashboard-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'updated' | 'title')}
              aria-label="Sort boards"
            >
              <option value="updated">Last edited</option>
              <option value="title">Title</option>
            </select>

            <div className="dashboard-tabs">
              <button
                type="button"
                className={`dashboard-tab ${!showArchived ? 'active' : ''}`}
                onClick={() => setShowArchived(false)}
              >
                Active ({boards.filter((b) => !b.archived).length})
              </button>
              <button
                type="button"
                className={`dashboard-tab ${showArchived ? 'active' : ''}`}
                onClick={() => setShowArchived(true)}
              >
                Archived ({boards.filter((b) => b.archived).length})
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="dashboard-empty">
            <Loader2 size={16} strokeWidth={1.5} className="spin" />
            <p>Loading boards...</p>
          </div>
        ) : visibleBoards.length === 0 ? (
          <div className="dashboard-empty">
            <p>
              {searchQuery
                ? 'No boards match that title.'
                : showArchived
                ? 'No archived boards.'
                : 'No boards in this workspace yet.'}
            </p>
            {!showArchived && !searchQuery && (
              <button
                type="button"
                className="sf-btn sf-btn-primary"
                onClick={() => handleCreate()}
                disabled={creating}
              >
                <Plus size={16} strokeWidth={1.5} />
                <span>New board</span>
              </button>
            )}
          </div>
        ) : (
          <div className="boards-grid">
            {visibleBoards.map((board) => (
              <div key={board.id} className="board-card">
                <div
                  className="board-card-preview"
                  onClick={() => navigate(`/board/${board.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/board/${board.id}`);
                    }
                  }}
                  aria-label={`Open ${board.title}`}
                >
                  <BoardThumbnail boardId={board.id} sceneJson={board.sceneJson} />
                </div>

                <div className="board-card-body">
                  <div className="board-card-title-row">
                    {editingId === board.id ? (
                      <input
                        type="text"
                        className="board-rename-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleRename(board.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(board.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <h3
                        className="board-card-title"
                        onClick={() => navigate(`/board/${board.id}`)}
                        title={board.title}
                      >
                        {board.title}
                      </h3>
                    )}

                    <span className="role-text">
                      {board.userRole.toLowerCase()}
                    </span>
                  </div>

                  <div className="board-card-footer">
                    <span className="board-card-meta">
                      {formatRelativeTime(board.updatedAt)}
                    </span>

                    {board.userRole === 'OWNER' && (
                      <div className="board-card-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Rename"
                          onClick={() => {
                            setEditingId(board.id);
                            setEditTitle(board.title);
                          }}
                        >
                          <Edit3 size={16} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Duplicate"
                          onClick={() => handleDuplicate(board.id)}
                        >
                          <Copy size={16} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title={board.archived ? 'Restore' : 'Archive'}
                          onClick={() => handleToggleArchive(board)}
                        >
                          {board.archived ? (
                            <ArchiveRestore size={16} strokeWidth={1.5} />
                          ) : (
                            <Archive size={16} strokeWidth={1.5} />
                          )}
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          title="Delete"
                          onClick={() => handleDelete(board)}
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="sf-footer">Built with Excalidraw</footer>
    </div>
  );
}
