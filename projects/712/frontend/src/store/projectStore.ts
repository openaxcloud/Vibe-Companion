import create from "zustand";
import { devtools, persist } from "zustand/middleware";

export type TaskId = string;
export type ColumnId = string;
export type BoardId = string;
export type ProjectId = string;

export interface Task {
  id: TaskId;
  title: string;
  description?: string;
  columnId: ColumnId;
  boardId: BoardId;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: ColumnId;
  title: string;
  boardId: BoardId;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: BoardId;
  title: string;
  projectId: ProjectId;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: ProjectId;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedTasksByColumn {
  [columnId: ColumnId]: TaskId[];
}

export interface NormalizedColumnsByBoard {
  [boardId: BoardId]: ColumnId[];
}

export interface ProjectsState {
  projects: Record<ProjectId, Project>;
  boards: Record<BoardId, Board>;
  columns: Record<ColumnId, Column>;
  tasks: Record<TaskId, Task>;
  tasksByColumn: NormalizedTasksByColumn;
  columnsByBoard: NormalizedColumnsByBoard;
  boardOrderByProject: Record<ProjectId, BoardId[]>;
  isLoading: boolean;
  error: string | null;
  currentProjectId: ProjectId | null;
  // Optimistic update tracking
  pendingTaskReorders: string[];
}

export interface LoadProjectPayload {
  project: Project;
  boards: Board[];
  columns: Column[];
  tasks: Task[];
}

export interface ReorderArrayItemPayload<TId extends string = string> {
  array: TId[];
  fromIndex: number;
  toIndex: number;
}

export interface MoveTaskPayload {
  taskId: TaskId;
  sourceColumnId: ColumnId;
  destinationColumnId: ColumnId;
  sourceIndex: number;
  destinationIndex: number;
}

export interface ReorderColumnPayload {
  boardId: BoardId;
  sourceIndex: number;
  destinationIndex: number;
}

export interface ReorderBoardPayload {
  projectId: ProjectId;
  sourceIndex: number;
  destinationIndex: number;
}

export interface ProjectStoreActions {
  setCurrentProjectId: (projectId: ProjectId | null) => void;
  loadProjectRequest: () => void;
  loadProjectSuccess: (payload: LoadProjectPayload) => void;
  loadProjectFailure: (error: string) => void;

  reorderBoardsOptimistic: (payload: ReorderBoardPayload) => void;
  revertBoardsOrder: (projectId: ProjectId, previousOrder: BoardId[]) => void;

  reorderColumnsOptimistic: (payload: ReorderColumnPayload) => void;
  revertColumnsOrder: (boardId: BoardId, previousOrder: ColumnId[]) => void;

  moveTaskOptimistic: (payload: MoveTaskPayload) => void;
  revertTaskMove: (taskId: TaskId, previousState: { tasksByColumn: NormalizedTasksByColumn; tasks: Record<TaskId, Task> }) => void;

  upsertTask: (task: Task) => void;
  removeTask: (taskId: TaskId) => void;
}

export type ProjectStore = ProjectsState & ProjectStoreActions;

const reorderArrayItem = <TId extends string>({ array, fromIndex, toIndex }: ReorderArrayItemPayload<TId>): TId[] => {
  const result = array.slice();
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
};

const buildNormalizedState = (payload: LoadProjectPayload): {
  projects: Record<ProjectId, Project>;
  boards: Record<BoardId, Board>;
  columns: Record<ColumnId, Column>;
  tasks: Record<TaskId, Task>;
  boardOrderByProject: Record<ProjectId, BoardId[]>;
  columnsByBoard: NormalizedColumnsByBoard;
  tasksByColumn: NormalizedTasksByColumn;
} => {
  const { project, boards, columns, tasks } = payload;

  const projects: Record<ProjectId, Project> = {
    [project.id]: project,
  };

  const boardsById: Record<BoardId, Board> = {};
  const boardOrderByProject: Record<ProjectId, BoardId[]> = {
    [project.id]: [],
  };

  boards
    .slice()
    .sort((a, b) => a.position - b.position)
    .forEach((board) => {
      boardsById[board.id] = board;
      boardOrderByProject[project.id].push(board.id);
    });

  const columnsById: Record<ColumnId, Column> = {};
  const columnsByBoard: NormalizedColumnsByBoard = {};

  columns.forEach((column) => {
    columnsById[column.id] = column;
    if (!columnsByBoard[column.boardId]) {
      columnsByBoard[column.boardId] = [];
    }
  });

  Object.keys(columnsByBoard).forEach((boardId) => {
    const cols = columns
      .filter((c) => c.boardId === boardId)
      .sort((a, b) => a.position - b.position)
      .map((c) => c.id);
    columnsByBoard[boardId] = cols;
  });

  const tasksById: Record<TaskId, Task> = {};
  const tasksByColumn: NormalizedTasksByColumn = {};

  tasks.forEach((task) => {
    tasksById[task.id] = task;
    if (!tasksByColumn[task.columnId]) {
      tasksByColumn[task.columnId] = [];
    }
  });

  Object.keys(tasksByColumn).forEach((columnId) => {
    const colTasks = tasks
      .filter((t) => t.columnId === columnId)
      .sort((a, b) => a.position - b.position)
      .map((t) => t.id);
    tasksByColumn[columnId] = colTasks;
  });

  return {
    projects,
    boards: boardsById,
    columns: columnsById,
    tasks: tasksById,
    boardOrderByProject,
    columnsByBoard,
    tasksByColumn,
  };
};

export const useProjectStore = create<ProjectStore>()(
  devtools(
    persist(
      (set, get) => ({
        projects: {},
        boards: {},
        columns: {},
        tasks: {},
        tasksByColumn: {},
        columnsByBoard: {},
        boardOrderByProject: {},
        isLoading: false,
        error: null,
        currentProjectId: null,
        pendingTaskReorders: [],

        setCurrentProjectId: (projectId) => {
          set({ currentProjectId: projectId });
        },

        loadProjectRequest: () => {
          set({
            isLoading: true,
            error: null,
          });
        },

        loadProjectSuccess: (payload) => {
          const normalized = buildNormalizedState(payload);
          set({
            ...normalized,
            isLoading: false,
            error: null,
            currentProjectId: payload.project.id,
          });
        },

        loadProjectFailure: (error) => {
          set({
            isLoading: false,
            error,
          });
        },

        reorderBoardsOptimistic: ({ projectId, sourceIndex, destinationIndex }) => {
          const { boardOrderByProject } = get();
          const currentOrder = boardOrderByProject[projectId] || [];
          if (sourceIndex === destinationIndex || sourceIndex < 0 || destinationIndex < 0) return;

          const newOrder = reorderArrayItem({
            array: currentOrder,
            fromIndex: sourceIndex,
            toIndex: destinationIndex,
          });

          set({
            boardOrderByProject: {
              ...boardOrderByProject,
              [projectId]: newOrder,
            },
          });
        },

        revertBoardsOrder: (projectId, previousOrder) => {
          const { boardOrderByProject } = get();
          set({
            boardOrderByProject: {
              ...boardOrderByProject,
              [projectId]: previousOrder,
            },
          });
        },

        reorderColumnsOptimistic: ({ boardId, sourceIndex, destinationIndex }) => {
          const { columnsByBoard } = get();
          const currentOrder = columnsByBoard[boardId] || [];
          if (sourceIndex === destinationIndex || sourceIndex < 0 || destinationIndex < 0) return;

          const newOrder = reorderArrayItem({
            array: currentOrder,
            fromIndex: sourceIndex,
            toIndex: destinationIndex,
          });

          set({
            columnsByBoard: {
              ...columnsByBoard,
              [boardId]: newOrder,
            },
          });
        },

        revertColumnsOrder: (boardId, previousOrder) => {
          const { columnsByBoard } = get();
          set({
            columnsByBoard: {
              ...columnsByBoard,
              [boardId]: previousOrder,
            },
          });
        },

        moveTaskOptimistic: ({ taskId, sourceColumnId, destinationColumnId, sourceIndex, destinationIndex }) =>