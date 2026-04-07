/**
 * Application Entry Point
 *
 * This file serves as a simple, documented entry to the project.
 *
 * Project Structure Overview:
 * - backend/src/index.ts     → Backend server entry point
 * - backend/src              → Backend application code (API, services, database)
 * - frontend/                → Frontend application(s) and assets
 *
 * This file does not start the backend server directly to avoid conflicts
 * with the backend server entry configuration. Use the scripts defined in
 * package.json (e.g. `npm run dev`, `npm run start`, `npm run backend:start`)
 * to run the appropriate part of the system.
 */

export type ProjectSection =
  | "backend"
  | "frontend"
  | "shared";

export interface ProjectStructureInfo {
  sections: ProjectSection[];
  backendEntry: string;
  notes: string[];
}

export function getProjectStructureInfo(): ProjectStructureInfo {
  return {
    sections: ["backend", "frontend", "shared"],
    backendEntry: "backend/src/index.ts",
    notes: [
      "This root index.ts is a documentation/coordination entry point.",
      "The actual backend server is started from backend/src/index.ts.",
      "Use package.json scripts to run backend and frontend independently."
    ]
  };
}

/**
 * If this module is executed directly with ts-node/node, log a brief help message.
 * In typical setups this file is imported, not executed.
 */
if (require.main === module) {
  const info = getProjectStructureInfo();
  // eslint-disable-next-line no-console
  console.log("Project structure summary:");
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(info, null, 2));
  // eslint-disable-next-line no-console
  console.log(
    "\nTo start the backend server, run the appropriate npm script, e.g.:",
  );
  // eslint-disable-next-line no-console
  console.log("  npm run backend:start\n",
  );
}

export default getProjectStructureInfo;