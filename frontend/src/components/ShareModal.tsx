import React, { useEffect, useState } from 'react';
import { X, UserPlus, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import {
  addBoardMember,
  listBoardMembers,
  removeBoardMember,
} from '../services/boardService';
import type { BoardMember, BoardRole } from '../types';

interface ShareModalProps {
  boardId: string;
  boardTitle: string;
  isOwner: boolean;
  onClose: () => void;
}

export function ShareModal({
  boardId,
  boardTitle,
  isOwner,
  onClose,
}: ShareModalProps) {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BoardRole>('EDITOR');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listBoardMembers(boardId);
      setMembers(list);
    } catch {
      setError('Could not load board members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [boardId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const added = await addBoardMember(boardId, email.trim(), role);
      setMembers((prev) => {
        const exists = prev.some((m) => m.userId === added.userId);
        return exists
          ? prev.map((m) => (m.userId === added.userId ? added : m))
          : [...prev, added];
      });
      setEmail('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr?.response?.data?.error || 'Failed to invite user.'
      );
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeBoardMember(boardId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch {
      setError('Failed to remove member.');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard denial
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Share &ldquo;{boardTitle}&rdquo;</h2>
            <p>Invite registered users to collaborate in real time.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {isOwner && (
          <form onSubmit={handleInvite} className="share-invite-form">
            <input
              type="email"
              placeholder="Collaborator email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={inviting}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as BoardRole)}
              disabled={inviting}
            >
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button
              type="submit"
              className="sketchflow-btn sketchflow-btn-primary"
              disabled={inviting}
            >
              {inviting ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <UserPlus size={15} />
              )}
              <span>Invite</span>
            </button>
          </form>
        )}

        <div className="share-members-list">
          <h4>Board Access</h4>
          {loading ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={18} className="spin" />
            </div>
          ) : (
            members.map((m) => (
              <div key={m.userId} className="share-member-row">
                <div className="share-member-info">
                  <div className="sketchflow-avatar">
                    {m.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="share-member-name">{m.displayName}</div>
                    <div className="share-member-email">{m.email}</div>
                  </div>
                </div>
                <div className="share-member-actions">
                  <span className={`role-badge role-${m.role.toLowerCase()}`}>
                    {m.role}
                  </span>
                  {isOwner && m.role !== 'OWNER' && (
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      onClick={() => handleRemove(m.userId)}
                      title="Remove access"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="sketchflow-btn"
            onClick={handleCopyLink}
          >
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            <span>{copied ? 'Board URL Copied!' : 'Copy Board URL'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
