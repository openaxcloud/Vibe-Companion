import bcrypt from "./utils/bcrypt-compat";
import crypto from "crypto";
import { storage } from "./storage";
import { createLogger } from './utils/logger';

const logger = createLogger('db-seed');
const isProduction = process.env.NODE_ENV === 'production';

// Generate a strong random password unless explicitly provided.
// In every environment we now prefer random over a hardcoded literal so
// dev installs can't be brute-forced from a leaked default.
// The generated password is printed ONCE to stdout so the operator can save it.
function getSecurePassword(envVar: string, label: string): string {
  const envPassword = process.env[envVar];
  if (envPassword) return envPassword;

  const randomPassword = crypto.randomBytes(18).toString('base64url');
  // Emit to plain stdout (not the structured logger, which may be silenced
  // in prod) so the password is never lost in log redaction.
  process.stdout.write(
    `\n` +
    `==================================================================\n` +
    `  [seed] Generated ${label} password (set ${envVar} to override):\n` +
    `  ${randomPassword}\n` +
    `==================================================================\n\n`
  );
  return randomPassword;
}

// Password hashing function - uses bcrypt to match auth.router.ts
async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

// Seed database with test user and test projects
export async function seedDatabase() {
  // SECURITY: Block test user creation in production to prevent security risks
  if (isProduction) {
    logger.info('[DB Seed] Skipping test user seed in production environment');
    return;
  }
  
  try {
    // Check if test user already exists
    let testUser = await storage.getUserByUsername("testuser");
    let isNewUser = false;
    
    if (!testUser) {
      // Create test user with secure password handling
      const testPassword = getSecurePassword('TEST_USER_PASSWORD', 'testuser');
      const hashedPassword = await hashPassword(testPassword);
      testUser = await storage.createUser({
        username: "testuser",
        password: hashedPassword,
        email: "testuser@test.com",
        displayName: "Test User",
      });

      // Update user to mark as email verified for testing
      await storage.updateUser(String(testUser.id), {
        emailVerified: true
      });
      
      isNewUser = true;
    }

    // Create test project with sample files for E2E testing (always check)
    if (testUser) {
      const existingProjects = await storage.getProjectsByUserId(String(testUser.id));
      
      if (existingProjects.length === 0) {
        // Create test project
        const testProject = await storage.createProject({
          name: "E2E Test Project",
          description: "Automated test project with sample files",
          ownerId: testUser.id,
          visibility: 'private' as const,
          language: 'typescript' as const,
        });

        // Create sample files for testing
        const sampleFiles = [
          {
            name: "index.html",
            path: "/index.html",
            content: `<!DOCTYPE html>
<html>
<head>
  <title>E2E Test App</title>
</head>
<body>
  <h1>Welcome to E-Code Platform</h1>
  <div id="app"></div>
  <script src="/app.ts"></script>
</body>
</html>`,
            projectId: testProject.id,
            isDirectory: false,
            language: 'html' as const,
          },
          {
            name: "app.ts",
            path: "/app.ts",
            content: `// E2E Test Application
class UserManager {
  private users: string[] = [];
  
  addUser(name: string): void {
    this.users.push(name);
  }
  
  getUsers(): string[] {
    return this.users;
  }
  
  removeUser(name: string): void {
    this.users = this.users.filter(u => u !== name);
  }
}

interface Config {
  apiUrl: string;
  timeout: number;
}

function initializeApp(config: Config): void {
  const manager = new UserManager();
  manager.addUser("Alice");
  manager.addUser("Bob");
  console.log("Users:", manager.getUsers());
}

const config: Config = {
  apiUrl: "https://api.example.com",
  timeout: 5000
};

initializeApp(config);`,
            projectId: testProject.id,
            isDirectory: false,
            language: 'typescript' as const,
          },
          {
            name: "README.md",
            path: "/README.md",
            content: `# E2E Test Project

This project is automatically created for E2E testing.

## Features
- TypeScript support
- Sample classes and functions
- Mobile symbol navigation testing`,
            projectId: testProject.id,
            isDirectory: false,
            language: 'markdown' as const,
          },
        ];

        // Create files in database
        for (const file of sampleFiles) {
          await storage.createFile(file);
        }

        logger.info(`✅ Test project created with ${sampleFiles.length} sample files (ID: ${testProject.id})`);
      }
    }

    // Create admin user for E2E testing if it doesn't exist
    const existingAdmin = await storage.getUserByUsername("admin");
    if (!existingAdmin) {
      const adminPassword = getSecurePassword('ADMIN_USER_PASSWORD', 'admin');
      const adminHashedPassword = await hashPassword(adminPassword);
      const adminUser = await storage.createUser({
        username: "admin",
        password: adminHashedPassword,
        email: "admin@test.com",
        displayName: "Admin User",
      });

      await storage.updateUser(String(adminUser.id), {
        role: 'admin',
        emailVerified: true
      });

      logger.info('✅ Admin user seeded (admin@test.com)');
    } else if (!existingAdmin.emailVerified || existingAdmin.role !== 'admin') {
      // Update existing admin to have email verified and admin role
      await storage.updateUser(String(existingAdmin.id), {
        emailVerified: true,
        role: 'admin'
      });
    }
    
    return testUser;
  } catch (error) {
    logger.error("Error seeding database:", error);
  }
}