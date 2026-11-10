import React, { useEffect, useState } from 'react';
import {
  X,
  UserPlus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Link2,
  ShieldBan,
} from 'lucide-react';
import {
  addBoardMember,
  createShareLink,
  listBoardMembers,
  listShareLinks,
  removeBoardMember,
  revokeShareLink,
} from '../services/boardService';
import type { BoardMember, BoardRole, ShareLink } from '../types';

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
  const [activeTab, setActiveTab] = useState<'members' | 'links'>('members');
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BoardRole>('EDITOR');
  const [inviting, setInviting] = useState(false);

  const [linkPerm, setLinkPerm] = useState<BoardRole>('VIEWER');
  const [expiryDays, setExpiryDays] = useState<string>('7');
  const [creatingLink, setCreatingLink] = useState(false);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const membersList = await listBoardMembers(boardId);
        setMembers(membersList);
        if (isOwner) {
          const linksList = await listShareLinks(boardId);
          setLinks(linksList);
        }
      } catch {
        setError('Could not load sharing settings.');
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [boardId, isOwner]);

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
      setError(axiosErr?.response?.data?.error || 'Failed to invite user.');
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

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingLink(true);
    setError(null);
    setNewShareUrl(null);
    try {
      const days = expiryDays === 'never' ? null : Number(expiryDays);
      const created = await createShareLink(boardId, linkPerm, days);
      setLinks((prev) => [created, ...prev]);
      if (created.token) {
        const fullUrl = `${window.location.origin}/#/share/${created.token}`;
        setNewShareUrl(fullUrl);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(
        axiosErr?.response?.data?.error || 'Failed to generate share link.'
      );
    } finally {
      setCreatingLink(false);
    }
  };

  const handleRevokeLink = async (linkId: string) => {
    try {
      await revokeShareLink(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      setNewShareUrl(null);
    } catch {
      setError('Failed to revoke share link.');
    }
  };

  const handleCopyBoardLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyShareUrl = async () => {
    if (!newShareUrl) return;
    try {
      await navigator.clipboard.writeText(newShareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Share &ldquo;{boardTitle}&rdquo;</h2>
            <p>Manage collaborators and revocable share links.</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {isOwner && (
          <div className="dashboard-tabs">
            <button
              type="button"
              className={`dashboard-tab ${activeTab === 'members' ? 'active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setActiveTab('members')}
            >
              Collaborators ({members.length})
            </button>
            <button
              type="button"
              className={`dashboard-tab ${activeTab === 'links' ? 'active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setActiveTab('links')}
            >
              Share Links ({links.length})
            </button>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        {activeTab === 'members' ? (
          <>
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
                  className="sf-btn sf-btn-primary"
                  disabled={inviting}
                >
                  {inviting ? (
                    <Loader2 size={16} strokeWidth={1.5} className="spin" />
                  ) : (
                    <UserPlus size={16} strokeWidth={1.5} />
                  )}
                  <span>Invite</span>
                </button>
              </form>
            )}

            <div className="share-members-list">
              <h4>Board Access</h4>
              {loading ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-muted)' }}>
                  <Loader2 size={16} strokeWidth={1.5} className="spin" />
                </div>
              ) : (
                members.map((m) => (
                  <div key={m.userId} className="share-member-row">
                    <div className="share-member-info">
                      <div className="sf-avatar">
                        {m.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="share-member-name">{m.displayName}</div>
                        <div className="share-member-email">{m.email}</div>
                      </div>
                    </div>
                    <div className="share-member-actions">
                      <span className="role-text">{m.role.toLowerCase()}</span>
                      {isOwner && m.role !== 'OWNER' && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          onClick={() => handleRemove(m.userId)}
                          title="Remove access"
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleCreateLink} className="share-invite-form">
              <select
                value={linkPerm}
                onChange={(e) => setLinkPerm(e.target.value as BoardRole)}
                disabled={creatingLink}
                style={{ flex: 1 }}
              >
                <option value="VIEWER">Public Read-Only (Viewer)</option>
                <option value="EDITOR">Signed-in Editor</option>
              </select>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                disabled={creatingLink}
              >
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="never">No expiry</option>
              </select>
              <button
                type="submit"
                className="sf-btn sf-btn-primary"
                disabled={creatingLink}
              >
                {creatingLink ? (
                  <Loader2 size={16} strokeWidth={1.5} className="spin" />
                ) : (
                  <Link2 size={16} strokeWidth={1.5} />
                )}
                <span>Create</span>
              </button>
            </form>

            {newShareUrl && (
              <div className="share-new-link-box">
                <div className="share-new-link-label">
                  Copy this link now (secret token is shown only once):
                </div>
                <div className="share-new-link-row">
                  <input type="text" readOnly value={newShareUrl} />
                  <button
                    type="button"
                    className="sf-btn sf-btn-primary"
                    onClick={handleCopyShareUrl}
                  >
                    {copiedLink ? (
                      <Check size={16} strokeWidth={1.5} />
                    ) : (
                      <Copy size={16} strokeWidth={1.5} />
                    )}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="share-members-list">
              <h4>Active Share Links</h4>
              {links.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '4px 0' }}>
                  No active share links. Create one above.
                </p>
              ) : (
                links.map((link) => (
                  <div key={link.id} className="share-member-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="role-text">
                        {link.permission.toLowerCase()}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                        {link.expiresAt
                          ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}`
                          : 'Never expires'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="sf-btn sf-btn-danger"
                      onClick={() => handleRevokeLink(link.id)}
                    >
                      <ShieldBan size={16} strokeWidth={1.5} />
                      <span>Revoke</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div className="modal-footer">
          <button
            type="button"
            className="sf-btn"
            onClick={handleCopyBoardLink}
          >
            {copied ? (
              <Check size={16} strokeWidth={1.5} />
            ) : (
              <Copy size={16} strokeWidth={1.5} />
            )}
            <span>{copied ? 'Board URL Copied' : 'Copy Board URL'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
