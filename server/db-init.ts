import { db } from "./db";
import * as schema from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Password hashing function
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Initialize the database with default data
export async function initializeDatabase() {
  try {
    console.log("Initializing database...");
    
    // Check if tables are created by checking if we have any users
    const users = await db.select().from(schema.users);
    if (users && users.length > 0) {
      console.log("Database already initialized. Skipping initialization.");
      return;
    }
    
    // Create admin user
    const adminPassword = await hashPassword("admin");
    const [admin] = await db.insert(schema.users).values({
      username: "admin",
      password: adminPassword,
      email: "admin@plot.local",
      displayName: "Administrator",
      bio: "Platform administrator"
    }).returning();
    
    // Create demo user
    const demoPassword = await hashPassword("password");
    const [demo] = await db.insert(schema.users).values({
      username: "demo",
      password: demoPassword,
      email: "demo@plot.local",
      displayName: "Demo User",
      bio: "Demo account for testing"
    }).returning();
    
    // Create a demo project
    const [project] = await db.insert(schema.projects).values({
      name: "My First Project",
      description: "A sample project to get started with PLOT",
      visibility: "private",
      language: "nodejs",
      ownerId: demo.id
    }).returning();
    
    // Create some sample files
    await db.insert(schema.files).values({
      name: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demo Project</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <h1>Welcome to PLOT</h1>
    <p>Your coding journey starts here</p>
  </header>
  
  <main>
    <p>This is a simple HTML page to help you get started.</p>
    <button id="myButton">Click Me!</button>
  </main>
  
  <script src="script.js"></script>
</body>
</html>`,
      isFolder: false,
      projectId: project.id,
      parentId: null
    });
    
    await db.insert(schema.files).values({
      name: "styles.css",
      content: `body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
  margin: 0;
  padding: 20px;
  color: #333;
}

header {
  text-align: center;
  margin-bottom: 30px;
}

h1 {
  color: #0070F3;
}

button {
  background-color: #0070F3;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #005cc5;
}`,
      isFolder: false,
      projectId: project.id,
      parentId: null
    });
    
    await db.insert(schema.files).values({
      name: "script.js",
      content: `// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get the button element
  const button = document.getElementById('myButton');
  
  // Add a click event listener
  button.addEventListener('click', function() {
    alert('Hello from PLOT! Your JavaScript is working!');
  });
});`,
      isFolder: false,
      projectId: project.id,
      parentId: null
    });
    
    console.log("Database initialized successfully with default data.");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}