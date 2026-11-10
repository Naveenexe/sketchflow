export type BoardRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface User {
  userId: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  displayName: string;
}

export interface Board {
  id: string;
  ownerId: string;
  title: string;
  sceneJson: string;
  thumbnailUrl?: string | null;
  version: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  userRole: BoardRole;
}

export interface CreateBoardRequest {
  title: string;
  sceneJson?: string;
}

export interface UpdateBoardRequest {
  title?: string;
  thumbnailUrl?: string;
  archived?: boolean;
}
