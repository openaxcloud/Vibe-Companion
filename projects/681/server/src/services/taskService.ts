import { PrismaClient, Task as TaskModel, Prisma, TaskStatus } from '@prisma/client';

const prisma = new PrismaClient();

export type TaskStatusType = TaskStatus;

export interface TaskDTO {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatusType;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatusType;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatusType;
}

export interface TaskFilter {
  status?: TaskStatusType | TaskStatusType[];
  search?: string;
  skip?: number;
  take?: number;
  orderBy?:
    | 'createdAt:asc'
    | 'createdAt:desc'
    | 'updatedAt:asc'
    | 'updatedAt:desc'
    | 'title:asc'
    | 'title:desc';
}

export class TaskService {
  private mapToDTO(task: TaskModel): TaskDTO {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private buildOrderBy(
    orderBy: TaskFilter['orderBy']
  ): Prisma.TaskOrderByWithRelationInput | undefined {
    if (!orderBy) return undefined;
    const [field, direction] = orderBy.split(':') as [string, 'asc' | 'desc'];
    if (!['createdAt', 'updatedAt', 'title'].includes(field) || !['asc', 'desc'].includes(direction)) {
      return undefined;
    }
    return { [field]: direction };
  }

  private buildWhere(filter?: TaskFilter): Prisma.TaskWhereInput | undefined {
    if (!filter) return undefined;

    const where: Prisma.TaskWhereInput = {};

    if (filter.status) {
      if (Array.isArray(filter.status)) {
        where.status = { in: filter.status };
      } else {
        where.status = filter.status;
      }
    }

    if (filter.search && filter.search.trim()) {
      const search = filter.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async createTask(input: CreateTaskInput): Promise<TaskDTO> {
    const data: Prisma.TaskCreateInput = {
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? TaskStatus.PENDING,
    };

    const task = await prisma.task.create({ data });
    return this.mapToDTO(task);
  }

  async getTaskById(id: string): Promise<TaskDTO | null> {
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) return null;
    return this.mapToDTO(task);
  }

  async getTasks(filter?: TaskFilter): Promise<TaskDTO[]> {
    const where = this.buildWhere(filter);
    const orderBy = this.buildOrderBy(filter?.orderBy);

    const tasks = await prisma.task.findMany({
      where,
      skip: filter?.skip,
      take: filter?.take,
      orderBy,
    });

    return tasks.map((task) => this.mapToDTO(task));
  }

  async getTasksByStatus(status: TaskStatusType): Promise<TaskDTO[]> {
    const tasks = await prisma.task.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map((task) => this.mapToDTO(task));
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<TaskDTO | null> {
    const data: Prisma.TaskUpdateInput = {};

    if (typeof input.title !== 'undefined') {
      data.title = input.title;
    }

    if (typeof input.description !== 'undefined') {
      data.description = input.description;
    }

    if (typeof input.status !== 'undefined') {
      data.status = input.status;
    }

    try {
      const task = await prisma.task.update({
        where: { id },
        data,
      });
      return this.mapToDTO(task);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  async deleteTask(id: string): Promise<boolean> {
    try {
      await prisma.task.delete({
        where: { id },
      });
      return true;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        return false;
      }
      throw error;
    }
  }

  async countTasks(filter?: TaskFilter): Promise<number> {
    const where = this.buildWhere(filter);
    const count = await prisma.task.count({ where });
    return count;
  }
}

const taskService = new TaskService();
export default taskService;