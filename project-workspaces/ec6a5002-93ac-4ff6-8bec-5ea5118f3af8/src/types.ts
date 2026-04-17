// Shared type definitions
import { ReactNode } from 'react';

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Comment {
  id: string;
  author: User;
  createdAt: string; // ISO
  body: string;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
}

export type Status = 'todo' | 'in-progress' | 'review' | 'done';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: Status;
  assignee?: User;
  estimateHours?: number;
  timeSpentHours?: number;
  dueDate?: string; // ISO
  priority: 'low' | 'medium' | 'high' | 'critical';
  comments: Comment[];
  attachments: Attachment[];
  activity: ActivityEntry[];
}

export interface ActivityEntry {
  id: string;
  message: string;
  createdAt: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  tasks: Task[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  sprints: Sprint[];
  members: User[];
}

export interface SidebarItem {
  name: string;
  icon: ReactNode;
  path: string;
}