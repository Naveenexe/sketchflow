import { apiClient } from './api';
import type { Board, CreateBoardRequest, UpdateBoardRequest } from '../types';

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
