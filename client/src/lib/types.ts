export interface Project {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  files?: File[];
}

export interface File {
  id: number;
  name: string;
  content: string;
  isFolder: boolean;
  parentId: number | null;
  projectId: number;
  createdAt: string;
  updatedAt: string;
}
