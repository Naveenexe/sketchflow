import { useCallback, useEffect, useRef, useState } from 'react';
import { WS_BASE_URL } from '../services/api';
import type { BoardRole, CollabParticipant } from '../types';

export interface RemoteCollaborator {
  pointer?: { x: number; y: number; tool?: 'pointer' | 'laser' };
  button?: 'down' | 'up';
  username?: string;
  color?: { background: string; stroke: string };
  id?: string;
}

interface UseCollaborationOptions {
  boardId: string | undefined;
  token: string | null;
  currentUserId: string | undefined;
  userRole: BoardRole | undefined;
  onRemoteSceneUpdate: (elements: readonly Record<string, unknown>[]) => void;
  onResyncState: (sceneJson: string) => void;
  onCollaboratorsChange: (collaborators: Map<string, RemoteCollaborator>) => void;
}

export function useCollaboration({
  boardId,
  token,
  currentUserId,
  userRole,
  onRemoteSceneUpdate,
  onResyncState,
  onCollaboratorsChange,
}: UseCollaborationOptions) {
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
  const [participants, setParticipants] = useState<CollabParticipant[]>([]);
  const [collabError, setCollabError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const hasConnectedOnceRef = useRef(false);
  const isUnmountedRef = useRef(false);

  // Throttling refs
  const sceneThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingElementsRef = useRef<readonly unknown[] | null>(null);
  const lastCursorSentRef = useRef(0);

  // Deduplication & collaborator cursor state
  const seenEventsRef = useRef<Set<string>>(new Set());
  const collaboratorsRef = useRef<Map<string, RemoteCollaborator>>(new Map());

  // Latest callbacks in refs to avoid reconnecting socket on render
  const onRemoteSceneRef = useRef(onRemoteSceneUpdate);
  const onResyncRef = useRef(onResyncState);
  const onCollaboratorsRef = useRef(onCollaboratorsChange);

  onRemoteSceneRef.current = onRemoteSceneUpdate;
  onResyncRef.current = onResyncState;
  onCollaboratorsRef.current = onCollaboratorsChange;

  const markEventSeen = (eventId: string) => {
    if (!eventId) return true;
    if (seenEventsRef.current.has(eventId)) return false;
    seenEventsRef.current.add(eventId);
    if (seenEventsRef.current.size > 500) {
      const first = seenEventsRef.current.values().next().value;
      if (first) seenEventsRef.current.delete(first);
    }
    return true;
  };

  useEffect(() => {
    if (!boardId || !token) return;
    isUnmountedRef.current = false;

    const connect = () => {
      if (isUnmountedRef.current) return;
      setWsStatus(hasConnectedOnceRef.current ? 'reconnecting' : 'connecting');

      const url = `${WS_BASE_URL}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        reconnectAttemptRef.current = 0;
        setWsStatus('connected');
        setCollabError(null);

        ws.send(
          JSON.stringify({
            type: 'JOIN_BOARD',
            boardId,
            eventId: crypto.randomUUID(),
            timestamp: Date.now(),
          })
        );

        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'PRESENCE_PING',
                boardId,
                eventId: crypto.randomUUID(),
                timestamp: Date.now(),
              })
            );
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const { type, eventId, userId, displayName, color, payload } = msg;

          switch (type) {
            case 'BOARD_STATE': {
              if (payload?.participants) {
                setParticipants(payload.participants);
              }
              if (hasConnectedOnceRef.current && payload?.sceneJson) {
                onResyncRef.current(payload.sceneJson);
              }
              hasConnectedOnceRef.current = true;
              break;
            }
            case 'PRESENCE_UPDATE': {
              const list: CollabParticipant[] = payload?.participants || [];
              setParticipants(list);

              // Remove cursors of users who left
              const activeIds = new Set(list.map((p) => p.userId));
              let changed = false;
              for (const id of collaboratorsRef.current.keys()) {
                if (!activeIds.has(id)) {
                  collaboratorsRef.current.delete(id);
                  changed = true;
                }
              }
              if (changed) {
                onCollaboratorsRef.current(new Map(collaboratorsRef.current));
              }
              break;
            }
            case 'SCENE_UPDATE': {
              if (userId === currentUserId) return;
              if (!markEventSeen(eventId)) return;
              if (Array.isArray(payload?.elements)) {
                onRemoteSceneRef.current(payload.elements);
              }
              break;
            }
            case 'CURSOR_UPDATE': {
              if (userId === currentUserId) return;
              const existing = collaboratorsRef.current.get(userId) || {};
              collaboratorsRef.current.set(userId, {
                ...existing,
                id: userId,
                username: displayName || 'Collaborator',
                pointer: payload?.pointer,
                button: payload?.button || 'up',
                color: {
                  background: color || '#6366f1',
                  stroke: color || '#4f46e5',
                },
              });
              onCollaboratorsRef.current(new Map(collaboratorsRef.current));
              break;
            }
            case 'ERROR': {
              setCollabError(payload?.message || 'Collaboration error');
              break;
            }
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        if (isUnmountedRef.current) {
          setWsStatus('disconnected');
          return;
        }
        setWsStatus('reconnecting');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 10000);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (sceneThrottleTimerRef.current) clearTimeout(sceneThrottleTimerRef.current);
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN && boardId) {
          wsRef.current.send(
            JSON.stringify({
              type: 'LEAVE_BOARD',
              boardId,
              eventId: crypto.randomUUID(),
              timestamp: Date.now(),
            })
          );
        }
        wsRef.current.close();
      }
    };
  }, [boardId, token, currentUserId]);

  const sendSceneUpdate = useCallback(
    (elements: readonly unknown[]) => {
      if (!boardId || userRole === 'VIEWER') return;
      pendingElementsRef.current = elements;

      if (sceneThrottleTimerRef.current) return;

      sceneThrottleTimerRef.current = setTimeout(() => {
        sceneThrottleTimerRef.current = null;
        const payloadElements = pendingElementsRef.current;
        pendingElementsRef.current = null;

        if (!payloadElements || wsRef.current?.readyState !== WebSocket.OPEN) return;

        wsRef.current.send(
          JSON.stringify({
            type: 'SCENE_UPDATE',
            boardId,
            eventId: crypto.randomUUID(),
            timestamp: Date.now(),
            payload: { elements: payloadElements },
          })
        );
      }, 80);
    },
    [boardId, userRole]
  );

  const sendCursorUpdate = useCallback(
    (pointer: { x: number; y: number; tool?: string }, button: string) => {
      if (!boardId || wsRef.current?.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      if (now - lastCursorSentRef.current < 50) return;
      lastCursorSentRef.current = now;

      wsRef.current.send(
        JSON.stringify({
          type: 'CURSOR_UPDATE',
          boardId,
          eventId: crypto.randomUUID(),
          timestamp: now,
          payload: { pointer, button },
        })
      );
    },
    [boardId]
  );

  const requestSync = useCallback(() => {
    if (!boardId || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'REQUEST_SYNC',
        boardId,
        eventId: crypto.randomUUID(),
        timestamp: Date.now(),
      })
    );
  }, [boardId]);

  return {
    wsStatus,
    participants,
    collabError,
    sendSceneUpdate,
    sendCursorUpdate,
    requestSync,
  };
}
