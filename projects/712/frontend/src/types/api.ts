/* eslint-disable @typescript-eslint/no-explicit-any */

export type ID = string;

export type ISODateString = string; // e.g., "2025-01-31T12:34:56.789Z"
export type Timestamp = ISODateString;

export type Role = 'admin' | 'manager' | 'member' | 'guest';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskType = 'task' | 'bug' | 'story' | 'epic';

export type WorkflowStatusKey =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'blocked'
  | 'done'
  | 'archived';

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'moved'
  | 'commented'
  | 'attached'
  | 'status_changed'
  | 'time_logged'
  | 'assigned'
  | 'unassigned'
  | 'archived'
  | 'restored';

export type ActivityEntityType =
  | 'user'
  | 'project'
  | 'board'
  | 'column'
  | 'sprint'
  | 'task'
  | 'time_entry'
  | 'comment'
  | 'attachment'
  | 'workflow_status';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface User {
  id: ID;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Project {
  id: ID;
  name: string;
  key: string; // short code, e.g. "PROJ"
  description?: string | null;
  ownerId: ID;
  isArchived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startDate?: ISODateString | null;
  endDate?: ISODateString | null;
  members: ProjectMember[];
}

export interface ProjectMember {
  userId: ID;
  projectId: ID;
  role: Role;
  joinedAt: Timestamp;
}

export interface Board {
  id: ID;
  projectId: ID;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Column {
  id: ID;
  boardId: ID;
  name: string;
  position: number;
  wipLimit?: number | null;
  workflowStatusKey: WorkflowStatusKey;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Sprint {
  id: ID;
  projectId: ID;
  name: string;
  goal?: string | null;
  startDate: ISODateString;
  endDate: ISODateString;
  isActive: boolean;
  isCompleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Task {
  id: ID;
  projectId: ID;
  boardId: ID;
  columnId: ID;
  sprintId?: ID | null;
  parentId?: ID | null; // for epics/subtasks
  title: string;
  description?: string | null;
  type: TaskType;
  status: WorkflowStatusKey;
  priority: Priority;
  estimate?: number | null; // in hours or story points depending on project settings
  timeSpent?: number; // total logged time in seconds
  assigneeId?: ID | null;
  reporterId?: ID | null;
  tags?: string[];
  position: number;
  dueDate?: ISODateString | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  closedAt?: Timestamp | null;
}

export interface TimeEntry {
  id: ID;
  taskId: ID;
  userId: ID;
  projectId: ID;
  startedAt: Timestamp;
  endedAt: Timestamp;
  durationSeconds: number;
  description?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Comment {
  id: ID;
  taskId: ID;
  authorId: ID;
  body: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isEdited: boolean;
  isDeleted: boolean;
}

export interface Attachment {
  id: ID;
  taskId: ID;
  uploaderId: ID;
  fileName: string;
  fileSize: number; // bytes
  mimeType: string;
  url: string;
  thumbnailUrl?: string | null;
  createdAt: Timestamp;
}

export interface WorkflowStatus {
  key: WorkflowStatusKey;
  label: string;
  description?: string | null;
  isTerminal: boolean;
  isDefault: boolean;
  color: string; // hex color
  position: number;
}

export interface ActivityLogChange {
  field: string;
  from?: any;
  to?: any;
}

export interface ActivityLog {
  id: ID;
  actorId: ID | null; // null for system actions
  projectId?: ID | null;
  entityType: ActivityEntityType;
  entityId: ID;
  action: ActivityAction;
  message: string;
  changes?: ActivityLogChange[];
  createdAt: Timestamp;
  meta?: Record<string, any>;
}

// API response shapes

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// Common aggregate / view models

export interface TaskWithRelations extends Task {
  assignee?: User | null;
  reporter?: User | null;
  sprint?: Sprint | null;
  column?: Column | null;
  project?: Project | null;
  board?: Board | null;
}

export interface ProjectSummary extends Project {
  boardsCount: number;
  activeSprintsCount: number;
  openTasksCount: number;
  completedTasksCount: number;
}

export interface BoardWithColumns extends Board {
  columns: Column[];
}

export interface TaskDetails extends TaskWithRelations {
  comments: Comment[];
  attachments: Attachment[];
  timeEntries: TimeEntry[];
  activity: ActivityLog[];
}

// Utility types

export type EntityMap = {
  user: User;
  project: Project;
  board: Board;
  column: Column;
  sprint: Sprint;
  task: Task;
  time_entry: TimeEntry;
  comment: Comment;
  attachment: Attachment;
  workflow_status: WorkflowStatus;
  activity_log: ActivityLog;
};

export type EntityByType<T extends ActivityEntityType> = EntityMap[
  T extends 'time_entry'
    ? 'time_entry'
    : T extends 'workflow_status'
    ? 'workflow_status'
    : T extends 'activity_log'
    ? 'activity_log'
    : T
];

export interface ListQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface DateRange {
  from?: ISODateString;
  to?: ISODateString;
}