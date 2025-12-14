#!/usr/bin/env node
/**
 * Script to update system status in Firestore
 *
 * Runs pnpm audit and pnpm outdated, parses the results,
 * and uploads them to Firestore for the super-admin dashboard.
 *
 * Run with: node scripts/update-system-status.js
 * Can be run manually or as part of CI/CD pipeline
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Error: firebase-service-account.json not found');
  console.error('Please download it from Firebase Console -> Project Settings -> Service Accounts');
  console.error('Place it in the project root directory');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
});

const db = admin.firestore();

/**
 * Parse pnpm audit JSON output
 */
function parseAuditOutput(auditJson) {
  const vulnerabilities = {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    info: 0,
    total: 0,
    details: [],
  };

  try {
    const data = JSON.parse(auditJson);

    // pnpm audit returns advisories in a specific format
    if (data.advisories) {
      Object.values(data.advisories).forEach((advisory) => {
        const severity = advisory.severity?.toLowerCase() || 'info';
        if (severity in vulnerabilities) {
          vulnerabilities[severity]++;
        }
        vulnerabilities.total++;
        vulnerabilities.details.push({
          id: advisory.id?.toString() || 'unknown',
          package: advisory.module_name || 'unknown',
          severity: severity,
          title: advisory.title || 'Unknown vulnerability',
          url: advisory.url || '',
          vulnerableVersions: advisory.vulnerable_versions || '*',
          patchedVersions: advisory.patched_versions || 'none',
          recommendation: advisory.recommendation || 'Update to latest version',
        });
      });
    } else if (data.metadata?.vulnerabilities) {
      // Alternative format
      const vuln = data.metadata.vulnerabilities;
      vulnerabilities.critical = vuln.critical || 0;
      vulnerabilities.high = vuln.high || 0;
      vulnerabilities.moderate = vuln.moderate || 0;
      vulnerabilities.low = vuln.low || 0;
      vulnerabilities.info = vuln.info || 0;
      vulnerabilities.total = vuln.total || 0;
    }
  } catch (e) {
    console.warn('Warning: Could not parse audit output:', e.message);
  }

  return vulnerabilities;
}

/**
 * Determine update type (major/minor/patch)
 */
function getUpdateType(current, latest) {
  const currentParts = current
    .replace(/[^\d.]/g, '')
    .split('.')
    .map(Number);
  const latestParts = latest
    .replace(/[^\d.]/g, '')
    .split('.')
    .map(Number);

  if ((latestParts[0] || 0) > (currentParts[0] || 0)) return 'major';
  if ((latestParts[1] || 0) > (currentParts[1] || 0)) return 'minor';
  return 'patch';
}

/**
 * Parse pnpm outdated JSON output
 */
function parseOutdatedOutput(outdatedJson) {
  const packages = [];

  try {
    const data = JSON.parse(outdatedJson);

    // pnpm outdated --json returns an object with package names as keys
    Object.entries(data).forEach(([name, info]) => {
      if (info.current && info.latest && info.current !== info.latest) {
        packages.push({
          name,
          current: info.current,
          wanted: info.wanted || info.current,
          latest: info.latest,
          workspace: info.dependentPackage || 'root',
          updateType: getUpdateType(info.current, info.latest),
          isSecurityUpdate: false, // Will be enhanced if audit data links to this
        });
      }
    });
  } catch (e) {
    console.warn('Warning: Could not parse outdated output:', e.message);
  }

  return packages;
}

/**
 * Get workspace information from package.json files
 */
function getWorkspaces() {
  const workspaces = [];
  const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

  // Add root
  workspaces.push({
    name: rootPkg.name || 'root',
    path: '.',
    version: rootPkg.version || '0.0.0',
    dependencyCount:
      Object.keys(rootPkg.dependencies || {}).length +
      Object.keys(rootPkg.devDependencies || {}).length,
  });

  // Check each workspace directory
  const workspaceDirs = ['apps', 'packages', 'functions'];

  for (const dir of workspaceDirs) {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) continue;

    const subdirs = fs.readdirSync(dirPath);
    for (const subdir of subdirs) {
      const pkgPath = path.join(dirPath, subdir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          workspaces.push({
            name: pkg.name || `${dir}/${subdir}`,
            path: `${dir}/${subdir}`,
            version: pkg.version || '0.0.0',
            dependencyCount:
              Object.keys(pkg.dependencies || {}).length +
              Object.keys(pkg.devDependencies || {}).length,
          });
        } catch (e) {
          console.warn(`Warning: Could not read ${pkgPath}`);
        }
      }
    }
  }

  return workspaces;
}

/**
 * Get runtime versions
 */
function getRuntimeInfo() {
  let nodeVersion = 'unknown';
  let pnpmVersion = 'unknown';

  try {
    nodeVersion = process.version.replace('v', '');
  } catch (e) {
    // Ignore
  }

  try {
    pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  } catch (e) {
    console.warn('Warning: Could not get pnpm version');
  }

  return {
    node: {
      current: nodeVersion,
      recommended: '20.x LTS',
    },
    pnpm: {
      current: pnpmVersion,
      recommended: '9.x',
    },
  };
}

/**
 * Main function
 */
async function main() {
  console.log('Updating system status...\n');

  // Get workspace info
  console.log('Getting workspace information...');
  const workspaces = getWorkspaces();
  console.log(`Found ${workspaces.length} workspaces\n`);

  // Get runtime info
  console.log('Getting runtime information...');
  const runtime = getRuntimeInfo();
  console.log(`Node: ${runtime.node.current}, pnpm: ${runtime.pnpm.current}\n`);

  // Run pnpm audit
  console.log('Running pnpm audit...');
  let auditOutput = '{}';
  try {
    auditOutput = execSync('pnpm audit --json', {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    // pnpm audit exits with non-zero if vulnerabilities found
    if (e.stdout) {
      auditOutput = e.stdout;
    }
  }
  const vulnerabilities = parseAuditOutput(auditOutput);
  console.log(`Found ${vulnerabilities.total} vulnerabilities\n`);

  // Run pnpm outdated
  console.log('Running pnpm outdated...');
  let outdatedOutput = '{}';
  try {
    outdatedOutput = execSync('pnpm outdated --json', {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    // pnpm outdated exits with non-zero if outdated packages found
    if (e.stdout) {
      outdatedOutput = e.stdout;
    }
  }
  const outdatedPackages = parseOutdatedOutput(outdatedOutput);
  console.log(`Found ${outdatedPackages.length} outdated packages\n`);

  // Calculate total dependencies
  const totalDependencies = workspaces.reduce((sum, w) => sum + w.dependencyCount, 0);

  // Build the status document
  const systemStatus = {
    generatedAt: new Date().toISOString(),
    runtime,
    workspaces,
    vulnerabilities,
    outdatedPackages,
    totalDependencies,
  };

  // Upload to Firestore
  console.log('Uploading to Firestore...');
  await db.collection('systemStatus').doc('current').set(systemStatus);

  console.log('\nSystem status updated successfully!');
  console.log(`- Workspaces: ${workspaces.length}`);
  console.log(`- Total dependencies: ${totalDependencies}`);
  console.log(`- Vulnerabilities: ${vulnerabilities.total}`);
  console.log(`- Outdated packages: ${outdatedPackages.length}`);
}

main().catch((error) => {
  console.error('Error updating system status:', error);
  process.exit(1);
});
