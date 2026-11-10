import { apiClient } from './api';
import type {
  Board,
  BoardMember,
  BoardRole,
  CreateBoardRequest,
  ShareLink,
  UpdateBoardRequest,
} from '../types';

export async function listBoards(): Promise<Board[]> {
  const response = await apiClient.get<Board[]>('/boards');
  return response.data;
}

export async function createBoard(payload: CreateBoardRequest): Promise<Board> {
  const response = await apiClient.post<Board>('/boards', payload);
  return response.data;
}

export async function getBoard(boardId: string): Promise<Board> {
  const response = await apiClient.get<Board>(`/boards/${boardId}`);
  return response.data;
}

export async function updateBoard(
  boardId: string,
  payload: UpdateBoardRequest
): Promise<Board> {
  const response = await apiClient.patch<Board>(`/boards/${boardId}`, payload);
  return response.data;
}

export async function duplicateBoard(boardId: string): Promise<Board> {
  const response = await apiClient.post<Board>(`/boards/${boardId}/duplicate`);
  return response.data;
}

export async function deleteBoard(boardId: string): Promise<void> {
  await apiClient.delete(`/boards/${boardId}`);
}

export async function getBoardScene(boardId: string): Promise<string> {
  const response = await apiClient.get<{ sceneJson: string }>(
    `/boards/${boardId}/scene`
  );
  return response.data.sceneJson;
}

export async function saveBoardScene(
  boardId: string,
  sceneJson: string
): Promise<Board> {
  const response = await apiClient.put<Board>(`/boards/${boardId}/scene`, {
    sceneJson,
  });
  return response.data;
}

export async function listBoardMembers(boardId: string): Promise<BoardMember[]> {
  const response = await apiClient.get<BoardMember[]>(
    `/boards/${boardId}/members`
  );
  return response.data;
}

export async function addBoardMember(
  boardId: string,
  email: string,
  role: BoardRole
): Promise<BoardMember> {
  const response = await apiClient.post<BoardMember>(
    `/boards/${boardId}/members`,
    { email, role }
  );
  return response.data;
}

export async function removeBoardMember(
  boardId: string,
  userId: string
): Promise<void> {
  await apiClient.delete(`/boards/${boardId}/members/${userId}`);
}

export async function listShareLinks(boardId: string): Promise<ShareLink[]> {
  const response = await apiClient.get<ShareLink[]>(
    `/boards/${boardId}/share-links`
  );
  return response.data;
}

export async function createShareLink(
  boardId: string,
  permission: BoardRole,
  expiresInDays: number | null
): Promise<ShareLink> {
  const response = await apiClient.post<ShareLink>(
    `/boards/${boardId}/share-links`,
    { permission, expiresInDays }
  );
  return response.data;
}

export async function revokeShareLink(linkId: string): Promise<void> {
  await apiClient.delete(`/share-links/${linkId}`);
}

export async function resolveShareLink(token: string): Promise<Board> {
  const response = await apiClient.get<Board>(`/share-links/${token}`);
  return response.data;
}
