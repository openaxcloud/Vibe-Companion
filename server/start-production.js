#!/usr/bin/env node
/**
 * Production startup script that handles TypeScript compilation
 * Works with Replit deployment that expects compiled JavaScript
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

console.log('🚀 Starting E-Code Platform in production mode...');
process.env.NODE_ENV = 'production';

const projectRoot = path.join(__dirname, '..');
const distPath = path.join(projectRoot, 'dist');
const distIndexPath = path.join(distPath, 'index.js');

// Function to compile TypeScript
function buildProject() {
  console.log('⚙️ Building application for production...');
  
  try {
    // First, build the client with Vite
    console.log('📦 Building client with Vite...');
    execSync('npx vite build', {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    // Then, build the server with esbuild
    console.log('📦 Building server with esbuild...');
    execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', {
      cwd: projectRoot,
      stdio: 'inherit'
    });
    
    console.log('✅ Build completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    return false;
  }
}

// Check if dist/index.js exists
if (!fs.existsSync(distIndexPath)) {
  console.log('⚠️ Compiled production build not found at dist/index.js');
  
  // Try to build the project
  if (!buildProject()) {
    console.error('❌ Failed to build the project');
    
    // Fallback: Try to run with tsx if available
    console.log('🔄 Attempting to run TypeScript directly with tsx...');
    try {
      execSync('npx tsx server/index.ts', {
        cwd: projectRoot,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' }
      });
    } catch (tsxError) {
      console.error('❌ Failed to run with tsx:', tsxError.message);
      process.exit(1);
    }
    return;
  }
}

// Run the compiled production server
console.log('🚀 Starting compiled production server from dist/index.js...');
try {
  // Use spawn for better process handling
  const serverProcess = spawn('node', [distIndexPath], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  serverProcess.on('error', (error) => {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  });
  
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Server exited with code ${code}`);
      process.exit(code);
    }
  });
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
}