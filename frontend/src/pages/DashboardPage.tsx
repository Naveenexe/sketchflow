import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Plus,
  LogOut,
  Trash2,
  Copy,
  Archive,
  ArchiveRestore,
  Edit3,
  ExternalLink,
  Loader2,
  LayoutGrid,
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

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim() || 'Untitled Board';
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

  const visibleBoards = boards.filter((b) => Boolean(b.archived) === showArchived);
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
      <header className="sketchflow-header">
        <div className="sketchflow-left-section">
          <div className="sketchflow-brand">
            <div className="sketchflow-logo-icon">
              <Sparkles size={18} />
            </div>
            <span>SketchFlow</span>
          </div>
          <div className="sketchflow-divider" />
          <span className="dashboard-subtitle">My Workspace</span>
        </div>

        <div className="sketchflow-right-section">
          <CloudStatusBadge />
          <div className="sketchflow-user-badge" title={user?.email}>
            <div className="sketchflow-avatar">{initials}</div>
            <span>{user?.displayName || 'User'}</span>
          </div>
          <button
            type="button"
            className="sketchflow-btn"
            onClick={handleLogout}
            title="Sign Out"
          >
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-toolbar">
          <form onSubmit={handleCreate} className="create-board-form">
            <input
              type="text"
              className="create-board-input"
              placeholder="New board title (e.g. System Architecture)..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={creating}
            />
            <button
              type="submit"
              className="sketchflow-btn sketchflow-btn-primary"
              disabled={creating}
            >
              {creating ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
              <span>New Board</span>
            </button>
          </form>

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

        {error && (
          <div className="auth-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="dashboard-empty">
            <Loader2 size={28} className="spin" />
            <p>Loading your boards from Neon PostgreSQL...</p>
          </div>
        ) : visibleBoards.length === 0 ? (
          <div className="dashboard-empty">
            <LayoutGrid size={40} color="#94a3b8" />
            <h3>{showArchived ? 'No archived boards' : 'No boards yet'}</h3>
            <p>
              {showArchived
                ? 'Boards you archive will appear here.'
                : 'Create your first board above to start sketching!'}
            </p>
          </div>
        ) : (
          <div className="boards-grid">
            {visibleBoards.map((board) => (
              <div key={board.id} className="board-card">
                <div
                  className="board-card-preview"
                  onClick={() => navigate(`/board/${board.id}`)}
                >
                  <Sparkles size={26} color="#6366f1" style={{ opacity: 0.5 }} />
                  <span className="board-open-hint">
                    Open Canvas <ExternalLink size={13} />
                  </span>
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

                    <span className={`role-badge role-${board.userRole.toLowerCase()}`}>
                      {board.userRole}
                    </span>
                  </div>

                  <div className="board-card-meta">
                    <span>v{board.version}</span>
                    <span>•</span>
                    <span>
                      Updated {new Date(board.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

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
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Duplicate"
                        onClick={() => handleDuplicate(board.id)}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title={board.archived ? 'Restore' : 'Archive'}
                        onClick={() => handleToggleArchive(board)}
                      >
                        {board.archived ? (
                          <ArchiveRestore size={14} />
                        ) : (
                          <Archive size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        title="Delete"
                        onClick={() => handleDelete(board)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

