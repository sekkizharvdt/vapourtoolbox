#!/usr/bin/env node
/**
 * Delete old Firestore composite indexes that use 'entityId' on tenant-scoped collections.
 * These were renamed to 'tenantId' and the old indexes cause 409 conflicts on deploy.
 *
 * Uses the service account key for authentication via google-auth-library
 * (bundled with firebase-admin).
 *
 * Usage:
 *   node scripts/delete-old-entityid-indexes.js [--dry-run]
 */

const path = require('path');
const https = require('https');

const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  '../mcp-servers/firebase-feedback/service-account-key.json'
);
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
const PROJECT_ID = serviceAccount.project_id;
const DRY_RUN = process.argv.includes('--dry-run');

// Tenant-scoped collections renamed from entityId to tenantId
const TENANT_COLLECTIONS = [
  'accounts',
  'boms',
  'bought_out_items',
  'costConfigurations',
  'enquiries',
  'fixedAssets',
  'goodsReceipts',
  'hrLeaveRequests',
  'hrTravelExpenses',
  'manualTasks',
  'meetings',
  'onDutyRecords',
  'paymentBatches',
  'projects',
  'proposals',
  'purchaseOrders',
  'recurringTransactions',
];

// --- JWT token generation using service account ---
const crypto = require('crypto');

function base64url(data) {
  return Buffer.from(data).toString('base64url');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');
  const jwt = `${signInput}.${signature}`;

  return new Promise((resolve, reject) => {
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
    const req = https.request(
      {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const data = JSON.parse(body);
          if (data.access_token) resolve(data.access_token);
          else reject(new Error(`Token error: ${body}`));
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// --- HTTP helpers ---
function apiRequest(token, method, urlPath) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'firestore.googleapis.com',
        path: urlPath,
        method,
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body ? JSON.parse(body) : {});
          } else if (res.statusCode === 404) {
            resolve({ indexes: [] });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function formatFields(index) {
  return (index.fields || [])
    .map((f) => `${f.fieldPath}(${f.order || f.arrayConfig || '?'})`)
    .join(', ');
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== DELETING OLD INDEXES ===');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Collections to check: ${TENANT_COLLECTIONS.length}\n`);

  const token = await getAccessToken();
  const basePath = `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups`;

  let totalFound = 0;
  let totalDeleted = 0;

  // Fetch ALL indexes once (the API returns all indexes for any collection group query)
  const data = await apiRequest(token, 'GET', `${basePath}/${TENANT_COLLECTIONS[0]}/indexes`);
  const allIndexes = data.indexes || [];

  for (const idx of allIndexes) {
    // Extract collection group from index name:
    // projects/{id}/databases/{db}/collectionGroups/{group}/indexes/{indexId}
    const nameParts = idx.name.split('/');
    const cgIdx = nameParts.indexOf('collectionGroups');
    const collectionGroup = cgIdx >= 0 ? nameParts[cgIdx + 1] : '';

    // Skip if not a tenant-scoped collection
    if (!TENANT_COLLECTIONS.includes(collectionGroup)) continue;

    const fields = idx.fields || [];
    const hasEntityId = fields.some((f) => f.fieldPath === 'entityId');
    if (!hasEntityId) continue;

    // Skip entityType+entityId pairs — those are linked-entity refs, not tenant
    const hasEntityType = fields.some((f) => f.fieldPath === 'entityType');
    if (hasEntityType) continue;

    const fieldsStr = formatFields(idx);
    const state = idx.state || 'UNKNOWN';
    totalFound++;

    console.log(`  ${collectionGroup}: [${fieldsStr}] (${state})`);

    if (DRY_RUN) {
      console.log(`    -> Would delete`);
    } else {
      try {
        await apiRequest(token, 'DELETE', `/v1/${idx.name}`);
        console.log(`    -> Deleted`);
        totalDeleted++;
      } catch (err) {
        console.error(`    -> ERROR: ${err.message}`);
      }
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Found: ${totalFound} old entityId indexes`);

  if (DRY_RUN) {
    console.log('\nRun without --dry-run to delete them.');
  } else {
    console.log(`Deleted: ${totalDeleted}`);
    console.log('\nNow redeploy indexes:');
    console.log('  firebase deploy --only firestore:indexes --force --project vapour-toolbox');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
