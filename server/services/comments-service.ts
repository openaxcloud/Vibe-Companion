// @ts-nocheck
import { DatabaseStorage } from '../storage';

export interface Comment {
  id: number;
  projectId: number;
  fileId: number;
  userId: number;
  lineNumber: number;
  content: string;
  resolved: boolean;
  parentId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Annotation {
  id: number;
  projectId: number;
  fileId: number;
  userId: number;
  startLine: number;
  endLine: number;
  type: 'suggestion' | 'issue' | 'note' | 'review';
  title: string;
  description: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: Date;
  updatedAt: Date;
}

export class CommentsService {
  constructor(private storage: DatabaseStorage) {}

  async createComment(data: {
    projectId: number;
    fileId: number;
    userId: number;
    lineNumber: number;
    content: string;
    parentId?: number;
  }): Promise<Comment> {
    const comment = {
      ...data,
      resolved: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Store in database
    const id = await this.storage.createComment(comment);
    return { ...comment, id };
  }

  async getProjectComments(projectId: number): Promise<Comment[]> {
    return this.storage.getProjectComments(projectId);
  }

  async getFileComments(projectId: number, fileId: number): Promise<Comment[]> {
    return this.storage.getFileComments(projectId, fileId);
  }

  async resolveComment(commentId: number, userId: number): Promise<void> {
    await this.storage.updateComment(commentId, { resolved: true, updatedAt: new Date() });
  }

  async createAnnotation(data: {
    projectId: number;
    fileId: number;
    userId: number;
    startLine: number;
    endLine: number;
    type: 'suggestion' | 'issue' | 'note' | 'review';
    title: string;
    description: string;
  }): Promise<Annotation> {
    const annotation = {
      ...data,
      status: 'open' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const id = await this.storage.createAnnotation(annotation);
    return { ...annotation, id };
  }

  async getProjectAnnotations(projectId: number): Promise<Annotation[]> {
    return this.storage.getProjectAnnotations(projectId);
  }

  async updateAnnotationStatus(
    annotationId: number, 
    status: 'open' | 'resolved' | 'dismissed'
  ): Promise<void> {
    await this.storage.updateAnnotation(annotationId, { status, updatedAt: new Date() });
  }

  async deleteComment(commentId: number, userId: number): Promise<void> {
    await this.storage.deleteComment(commentId);
  }

  async deleteAnnotation(annotationId: number, userId: number): Promise<void> {
    await this.storage.deleteAnnotation(annotationId);
  }
}