import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";

const scryptAsync = promisify(scrypt);

// Password hashing function
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Seed database with test user
export async function seedDatabase() {
  try {
    // Check if test user already exists
    const existingUser = await storage.getUserByUsername("testuser");
    if (existingUser) {
      console.log("Test user already exists");
      return;
    }

    // Create test user
    const hashedPassword = await hashPassword("testpass123");
    const testUser = await storage.createUser({
      username: "testuser",
      password: hashedPassword,
      email: "test@example.com",
      displayName: "Test User",
    });

    // Update user to mark as email verified for testing
    await storage.updateUser(testUser.id, {
      emailVerified: true
    });

    console.log("✅ Test user created successfully:");
    console.log("   Username: testuser");
    console.log("   Password: testpass123");
    console.log("   Email: test@example.com");
    
    return testUser;
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}