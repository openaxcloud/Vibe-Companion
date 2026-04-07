import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type SeedUser = {
  email: string;
  name: string;
  passwordHash: string;
  avatarUrl?: string | null;
};

type SeedProject = {
  name: string;
  key: string;
  description?: string | null;
};

type SeedBoard = {
  name: string;
  type: 'KANBAN' | 'SCRUM';
};

type SeedColumn = {
  name: string;
  position: number;
  wipLimit?: number | null;
};

type SeedSprint = {
  name: string;
  goal: string;
  startDate: Date;
  endDate: Date;
};

type SeedStatus = {
  name: string;
  category: 'TODO' | 'IN_PROGRESS' | 'DONE';
  position: number;
};

type SeedTask = {
  title: string;
  description: string;
  estimate: number | null;
  statusName: string;
  columnName: string;
  assigneeEmail?: string | null;
  reporterEmail: string;
};

type SeedComment = {
  body: string;
  authorEmail: string;
  taskTitle: string;
};

const users: SeedUser[] = [
  {
    email: 'demo.admin@example.com',
    name: 'Demo Admin',
    passwordHash: '$2b$10$wU/9D5EFakeHashForDemoOnly12345678901234567890abcdefghijk',
    avatarUrl: null
  },
  {
    email: 'jane.doe@example.com',
    name: 'Jane Doe',
    passwordHash: '$2b$10$wU/9D5EFakeHashForDemoOnly12345678901234567890abcdefghijk',
    avatarUrl: null
  },
  {
    email: 'john.smith@example.com',
    name: 'John Smith',
    passwordHash: '$2b$10$wU/9D5EFakeHashForDemoOnly12345678901234567890abcdefghijk',
    avatarUrl: null
  }
];

const project: SeedProject = {
  name: 'Demo Project',
  key: 'DEMO',
  description: 'A demo project with sample data for trying out the application.'
};

const board: SeedBoard = {
  name: 'Demo Board',
  type: 'SCRUM'
};

const columns: SeedColumn[] = [
  { name: 'To Do', position: 1, wipLimit: null },
  { name: 'In Progress', position: 2, wipLimit: 3 },
  { name: 'Done', position: 3, wipLimit: null }
];

const statuses: SeedStatus[] = [
  { name: 'To Do', category: 'TODO', position: 1 },
  { name: 'In Progress', category: 'IN_PROGRESS', position: 2 },
  { name: 'In Review', category: 'IN_PROGRESS', position: 3 },
  { name: 'Blocked', category: 'IN_PROGRESS', position: 4 },
  { name: 'Done', category: 'DONE', position: 5 }
];

const createSprintDates = (): SeedSprint => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 3);
  const end = new Date(start);
  end.setDate(end.getDate() + 11);
  return {
    name: 'Sprint 1',
    goal: 'Deliver core demo functionality',
    startDate: start,
    endDate: end
  };
};

const tasks: SeedTask[] = [
  {
    title: 'Set up project repository',
    description: 'Initialize the repository with base configuration, tooling, and CI workflow.',
    estimate: 3,
    statusName: 'Done',
    columnName: 'Done',
    assigneeEmail: 'demo.admin@example.com',
    reporterEmail: 'demo.admin@example.com'
  },
  {
    title: 'Design database schema',
    description: 'Model entities for users, projects, boards, sprints, and tasks.',
    estimate: 5,
    statusName: 'In Review',
    columnName: 'In Progress',
    assigneeEmail: 'jane.doe@example.com',
    reporterEmail: 'demo.admin@example.com'
  },
  {
    title: 'Implement authentication',
    description: 'Add JWT-based authentication with role-based access control.',
    estimate: 8,
    statusName: 'In Progress',
    columnName: 'In Progress',
    assigneeEmail: 'john.smith@example.com',
    reporterEmail: 'demo.admin@example.com'
  },
  {
    title: 'Create Kanban board UI',
    description: 'Build a drag-and-drop board for managing tasks across columns.',
    estimate: 8,
    statusName: 'To Do',
    columnName: 'To Do',
    assigneeEmail: 'jane.doe@example.com',
    reporterEmail: 'demo.admin@example.com'
  },
  {
    title: 'Write API documentation',
    description: 'Document core REST endpoints and authentication flow.',
    estimate: 3,
    statusName: 'To Do',
    columnName: 'To Do',
    assigneeEmail: null,
    reporterEmail: 'john.smith@example.com'
  }
];

const comments: SeedComment[] = [
  {
    body: 'Repository initialized with base config and CI.',
    authorEmail: 'demo.admin@example.com',
    taskTitle: 'Set up project repository'
  },
  {
    body: 'Schema draft ready for review. Please check task relationships.',
    authorEmail: 'jane.doe@example.com',
    taskTitle: 'Design database schema'
  },
  {
    body: 'Started implementing login endpoint and token refresh.',
    authorEmail: 'john.smith@example.com',
    taskTitle: 'Implement authentication'
  },
  {
    body: 'We should also document error responses for each endpoint.',
    authorEmail: 'john.smith@example.com',
    taskTitle: 'Write API documentation'
  }
];

async function clearExistingData() {
  await prisma.comment.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.sprint.deleteMany({});
  await prisma.boardColumn.deleteMany({});
  await prisma.board.deleteMany({});
  await prisma.workflowStatus.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});
}

async function seed() {
  const useTransactional = typeof (prisma as any).$transaction === 'function';

  if (useTransactional) {
    await prisma.$transaction(async (tx) => {
      await runSeed(tx);
    });
  } else {
    await runSeed(prisma);
  }
}

async function runSeed(client: PrismaClient | Omit<PrismaClient, '$transaction'>) {
  await clearExistingData();

  const userRecords = await Promise.all(
    users.map((u) =>
      client.user.create({
        data: {
          email: u.email,
          name: u.name,
          passwordHash: u.passwordHash,
          avatarUrl: u.avatarUrl ?? null
        }
      })
    )
  );

  const demoAdmin = userRecords.find((u) => u.email === 'demo.admin@example.com');
  if (!demoAdmin) {
    throw new Error('Demo admin user not created');
  }

  const projectRecord = await client.project.create({
    data: {
      name: project.name,
      key: project.key,
      description: project.description ?? null,
      ownerId: demoAdmin.id
    }
  });

  await Promise.all(
    userRecords.map((user) =>
      client.projectMember.create({
        data: {
          projectId: projectRecord.id,
          userId: user.id,
          role: user.email === 'demo.admin@example.com' ? 'ADMIN' : 'MEMBER'
        }
      })
    )
  );

  const statusRecords = await Promise.all(
    statuses.map((status) =>
      client.workflowStatus.create({
        data: {
          name: status.name,
          category: status.category,
          position: status.position,
          projectId: projectRecord.id
        }
      })
    )
  );

  const boardRecord = await client.board.create({
    data: {
      name: board.name,
      type: board.type,
      projectId: projectRecord.id
    }
  });

  const columnRecords = await Promise.all(
    columns.map((col) =>
      client.boardColumn.create({
        data: {
          name: col.name,
          position: col.position,
          wipLimit: col.wipLimit ?? null,
          boardId: boardRecord.id
        }
      })
    )
  );

  const sprintConfig = createSprintDates();
  const sprintRecord = await client.sprint.create({
    data: {
      name: sprintConfig.name,
      goal: sprintConfig.goal,
      startDate: sprintConfig.startDate,
      endDate: sprintConfig.endDate,
      projectId: projectRecord.id,
      boardId: boardRecord.id,
      isActive: true
    }
  });

  const statusByName = new Map(statusRecords.map((s) => [s.name, s]));
  const columnByName = new Map(columnRecords.map((c) => [c.name, c]));
  const userByEmail = new Map(userRecords.map((u) => [u.email, u]));

  const taskRecords = await Promise.all(
    tasks.map((task, index