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

// Copy seed data JSON files to lib directory
const seedDataSrc = path.join(__dirname, '..', 'scripts', 'seed-data');
const seedDataDest = path.join(libDir, 'seed-data');

if (fs.existsSync(seedDataSrc)) {
  console.log('📦 Copying seed data files...');

  if (!fs.existsSync(seedDataDest)) {
    fs.mkdirSync(seedDataDest, { recursive: true });
  }

  const seedFiles = fs.readdirSync(seedDataSrc).filter(f => f.endsWith('.json'));
  for (const file of seedFiles) {
    fs.copyFileSync(
      path.join(seedDataSrc, file),
      path.join(seedDataDest, file)
    );
  }

  console.log(`✅ Copied ${seedFiles.length} seed data files`);
} else {
  console.log('⚠️  Seed data directory not found - skipping');
}

// Copy PDF templates (HTML files) to lib directory
const templatesSrc = path.join(__dirname, 'src', 'pdf', 'templates');
const templatesDest = path.join(libDir, 'pdf', 'templates');

if (fs.existsSync(templatesSrc)) {
  console.log('📦 Copying PDF templates...');

  if (!fs.existsSync(templatesDest)) {
    fs.mkdirSync(templatesDest, { recursive: true });
  }

  const templateFiles = fs.readdirSync(templatesSrc).filter(f => f.endsWith('.html'));
  for (const file of templateFiles) {
    fs.copyFileSync(
      path.join(templatesSrc, file),
      path.join(templatesDest, file)
    );
  }

  console.log(`✅ Copied ${templateFiles.length} PDF template files`);
} else {
  console.log('⚠️  PDF templates directory not found - skipping');
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
