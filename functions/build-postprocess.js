#!/usr/bin/env node
/**
 * Post-build script to flatten the lib directory structure
 * Cross-platform replacement for Windows robocopy/rmdir commands
 */

const fs = require('fs');
const path = require('path');

const libDir = path.join(__dirname, 'lib');
const nestedDir = path.join(libDir, 'functions', 'src');

// Check if nested directory exists
if (fs.existsSync(nestedDir)) {
  console.log('📦 Flattening build output...');

  // Copy files from nested directory to lib root
  copyRecursive(nestedDir, libDir);

  // Remove nested functions directory
  fs.rmSync(path.join(libDir, 'functions'), { recursive: true, force: true });

  console.log('✅ Build output flattened successfully');
} else {
  console.log('✅ Build output already flat - no post-processing needed');
}

/**
 * Recursively copy directory contents
 */
function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyRecursive(srcPath, destPath);
    } else {
      // Only copy if file doesn't already exist or is newer
      if (!fs.existsSync(destPath) ||
          fs.statSync(srcPath).mtime > fs.statSync(destPath).mtime) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
