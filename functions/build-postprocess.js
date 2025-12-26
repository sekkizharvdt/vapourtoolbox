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

// Rewrite @vapour/* imports to relative paths
console.log('📦 Rewriting @vapour/* imports...');
rewriteVapourImports(libDir);
console.log('✅ @vapour/* imports rewritten');

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

/**
 * Rewrite @vapour/* imports to relative paths in compiled JS files
 * This is needed because Firebase Functions doesn't have access to the monorepo's
 * workspace packages at runtime.
 */
function rewriteVapourImports(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Don't process the packages directory itself
      if (entry.name !== 'packages') {
        rewriteVapourImports(fullPath);
      }
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // Calculate relative path from current file to lib/packages
      const relativeToLib = path.relative(path.dirname(fullPath), libDir);
      const packagesPath = path.join(relativeToLib, 'packages');

      // Rewrite @vapour/constants to relative path
      if (content.includes('@vapour/constants')) {
        let relativePath = path.posix.join(packagesPath, 'constants', 'src');
        // Ensure it starts with ./ for proper relative resolution
        if (!relativePath.startsWith('.')) {
          relativePath = './' + relativePath;
        }
        content = content.replace(
          /require\("@vapour\/constants"\)/g,
          `require("${relativePath}")`
        );
        modified = true;
      }

      // Rewrite @vapour/types to relative path (if used)
      if (content.includes('@vapour/types')) {
        let relativePath = path.posix.join(packagesPath, 'types', 'src');
        // Ensure it starts with ./ for proper relative resolution
        if (!relativePath.startsWith('.')) {
          relativePath = './' + relativePath;
        }
        content = content.replace(
          /require\("@vapour\/types"\)/g,
          `require("${relativePath}")`
        );
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log(`  Rewrote imports in: ${path.relative(libDir, fullPath)}`);
      }
    }
  }
}
