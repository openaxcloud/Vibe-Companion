import React, { useCallback, useEffect, useMemo, useState } from "react";

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  updatedAt: string;
}

export interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  isUpdating?: boolean;
  error?: string | null;
  onToggleComplete?: (taskId: string, completed: boolean) => Promise<void> | void;
  onUpdateTask?: (taskId: string, updates: Partial<Pick<Task, "title" | "description">>) => Promise<void> | void;
  onDeleteTask?: (taskId: string) => Promise<void> | void;
  emptyMessage?: string;
}

/**
 * TaskList provides optimistic UI updates for toggling, editing, and deleting tasks.
 * It syncs with the `tasks` prop but maintains a local working copy while operations are in-flight.
 */
const TaskList: React.FC<TaskListProps> = ({
  tasks,
  isLoading = false,
  isUpdating = false,
  error = null,
  onToggleComplete,
  onUpdateTask,
  onDeleteTask,
  emptyMessage = "No tasks yet. Create your first task to get started.",
}) => {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ title: string; description: string }>({
    title: "",
    description: "",
  });
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTaskId === null && pendingTaskIds.size === 0) {
      setLocalTasks(tasks);
    }
  }, [tasks, editingTaskId, pendingTaskIds]);

  const markPending = useCallback((taskId: string) => {
    setPendingTaskIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  }, []);

  const clearPending = useCallback((taskId: string) => {
    setPendingTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }, []);

  const isTaskPending = useCallback(
    (taskId: string): boolean => pendingTaskIds.has(taskId),
    [pendingTaskIds]
  );

  const handleToggleComplete = useCallback(
    async (task: Task) => {
      if (!onToggleComplete) return;

      const newCompleted = !task.completed;
      const previousTasks = localTasks;

      setInlineError(null);
      markPending(task.id);
      setLocalTasks((current) =>
        current.map((t) => (t.id === task.id ? { ...t, completed: newCompleted } : t))
      );

      try {
        await onToggleComplete(task.id, newCompleted);
      } catch (err) {
        setInlineError("Unable to update task status. Changes have been reverted.");
        setLocalTasks(previousTasks);
      } finally {
        clearPending(task.id);
      }
    },
    [onToggleComplete, localTasks, markPending, clearPending]
  );

  const startEditing = useCallback(
    (task: Task) => {
      if (isTaskPending(task.id)) return;
      setEditingTaskId(task.id);
      setEditValues({
        title: task.title,
        description: task.description ?? "",
      });
      setInlineError(null);
    },
    [isTaskPending]
  );

  const cancelEditing = useCallback(() => {
    setEditingTaskId(null);
    setInlineError(null);
  }, []);

  const handleEditChange = useCallback(
    (field: "title" | "description", value: string) => {
      setEditValues((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleSaveEdit = useCallback(
    async (taskId: string) => {
      if (!onUpdateTask) {
        setEditingTaskId(null);
        return;
      }

      const trimmedTitle = editValues.title.trim();
      const trimmedDescription = editValues.description.trim();

      if (!trimmedTitle) {
        setInlineError("Title cannot be empty.");
        return;
      }

      const previousTasks = localTasks;
      setInlineError(null);
      markPending(taskId);

      setLocalTasks((current) =>
        current.map((t) =>
          t.id === taskId
            ? {
                ...t,
                title: trimmedTitle,
                description: trimmedDescription || undefined,
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      );

      try {
        await onUpdateTask(taskId, {
          title: trimmedTitle,
          description: trimmedDescription || undefined,
        });
        setEditingTaskId(null);
      } catch (err) {
        setInlineError("Unable to save changes. Previous values have been restored.");
        setLocalTasks(previousTasks);
      } finally {
        clearPending(taskId);
      }
    },
    [onUpdateTask, editValues, localTasks, markPending, clearPending]
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      if (!onDeleteTask) return;

      const previousTasks = localTasks;
      setInlineError(null);
      markPending(taskId);

      setLocalTasks((current) => current.filter((t) => t.id !== taskId));

      try {
        await onDeleteTask(taskId);
        if (editingTaskId === taskId) {
          setEditingTaskId(null);
        }
      } catch (err) {
        setInlineError("Unable to delete task. It has been restored.");
        setLocalTasks(previousTasks);
      } finally {
        clearPending(taskId);
      }
    },
    [onDeleteTask, localTasks, editingTaskId, markPending, clearPending]
  );

  const sortedTasks = useMemo(() => {
    return [...localTasks].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [localTasks]);

  if (isLoading && localTasks.length === 0) {
    return (
      <div className="task-list task-list--loading">
        <p className="task-list__status">Loading tasks...</p>
      </div>
    );
  }

  if (!isLoading && sortedTasks.length === 0) {
    return (
      <div className="task-list task-list--empty">
        <p className="task-list__empty-message">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {(error || inlineError) && (
        <div className="task-list__error" role="alert">
          {inlineError || error}
        </div>
      )}

      {isUpdating && (
        <div className="task-list__status task-list__status--updating">
          Syncing changes…
        </div>
      )}

      <ul className="task-list__items">
        {sortedTasks.map((task) => {
          const isEditing = editingTaskId === task.id;
          const pending = isTaskPending(task.id);

          return (
            <li
              key={task.id}
              className={`task-list__item undefined undefined`}
            >
              <div className="task-list__item-main">
                <label className="task-list__checkbox-label">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    disabled={pending || !onToggleComplete}
                    onChange={() => handleToggleComplete(task)}
                  />
                  <span className="task-list__checkbox-custom" />
                </label>

                <div className="task-list__content">
                  {isEditing ? (
                    <div className="task-list__edit-form">
                      <input
                        className="task-list__edit-input task-list__edit-input--title"
                        type="text"
                        value={editValues.title}
                        onChange={(e) => handleEditChange("title", e.target.value)}
                        placeholder="Task title"
                        autoFocus
                      />
                      <textarea
                        className="task-list__edit-input task-list__edit-input--description"
                        value={editValues.description}
                        onChange={(e) => handleEditChange("description", e.target.value)}
                        placeholder="Description (optional)"
                        rows={2}
                      />
                    </div>
                  ) : (
                    <div className="task-list__text">
                      <div className="task-list__title" title={task.title}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="task-list__description">{task.description}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="task-list__item-actions">
                {isEditing