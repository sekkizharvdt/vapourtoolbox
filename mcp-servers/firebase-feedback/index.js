#!/usr/bin/env node

/**
 * Firebase Feedback MCP Server
 *
 * Provides access to the feedback collection in Firestore
 * for reviewing and managing bug reports and feature requests.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
let db;

function initializeFirebase() {
  // Look for service account key in multiple locations
  const possiblePaths = [
    resolve(__dirname, 'service-account-key.json'),
    resolve(__dirname, '../../service-account-key.json'),
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  ].filter(Boolean);

  let serviceAccountPath = null;
  for (const path of possiblePaths) {
    if (path && existsSync(path)) {
      serviceAccountPath = path;
      break;
    }
  }

  if (!serviceAccountPath) {
    throw new Error(
      'Service account key not found. Please create service-account-key.json in the mcp-servers/firebase-feedback directory.'
    );
  }

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
}

// Helper to format feedback items
function formatFeedback(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    type: data.type,
    status: data.status,
    title: data.title,
    description: data.description,
    stepsToReproduce: data.stepsToReproduce || null,
    expectedBehavior: data.expectedBehavior || null,
    actualBehavior: data.actualBehavior || null,
    consoleErrors: data.consoleErrors || null,
    screenshotUrls: data.screenshotUrls || [],
    pageUrl: data.pageUrl || null,
    browserInfo: data.browserInfo || null,
    userName: data.userName,
    userEmail: data.userEmail,
    adminNotes: data.adminNotes || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  };
}

// Create MCP server
const server = new Server(
  {
    name: 'firebase-feedback',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_feedback',
        description:
          'List all feedback submissions (bug reports, feature requests, general feedback). Can filter by type and status.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['bug', 'feature', 'general', 'all'],
              description: 'Filter by feedback type. Default: all',
            },
            status: {
              type: 'string',
              enum: ['new', 'in_progress', 'resolved', 'closed', 'wont_fix', 'all'],
              description: 'Filter by status. Default: all',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of items to return. Default: 50',
            },
          },
        },
      },
      {
        name: 'get_feedback',
        description: 'Get detailed information about a specific feedback item by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The feedback document ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_feedback_stats',
        description: 'Get statistics about feedback submissions',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'search_feedback',
        description: 'Search feedback by keyword in title or description',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to match against title and description',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'update_feedback',
        description:
          'Update feedback status and/or admin notes. Use this to mark items as in_progress when starting work, resolved when fixed (with resolution notes), or closed after user acknowledgment.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The feedback document ID',
            },
            status: {
              type: 'string',
              enum: ['new', 'in_progress', 'resolved', 'closed', 'wont_fix'],
              description: 'New status for the feedback item',
            },
            adminNotes: {
              type: 'string',
              description:
                'Resolution notes or admin comments. For resolved items, include: what was fixed, commit reference, and deployment date.',
            },
          },
          required: ['id'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_feedback': {
        const type = args?.type || 'all';
        const status = args?.status || 'all';
        const limit = args?.limit || 50;

        let query = db.collection('feedback').orderBy('createdAt', 'desc');

        if (type !== 'all') {
          query = query.where('type', '==', type);
        }

        if (status !== 'all') {
          query = query.where('status', '==', status);
        }

        const snapshot = await query.limit(limit).get();
        const items = snapshot.docs.map(formatFeedback);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: items.length,
                  filters: { type, status },
                  items,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_feedback': {
        const { id } = args;
        const doc = await db.collection('feedback').doc(id).get();

        if (!doc.exists) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Feedback not found', id }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatFeedback(doc), null, 2),
            },
          ],
        };
      }

      case 'get_feedback_stats': {
        const snapshot = await db.collection('feedback').get();

        const stats = {
          total: snapshot.size,
          byType: { bug: 0, feature: 0, general: 0 },
          byStatus: {
            new: 0,
            in_progress: 0,
            resolved: 0,
            closed: 0,
            wont_fix: 0,
          },
        };

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (stats.byType[data.type] !== undefined) {
            stats.byType[data.type]++;
          }
          if (stats.byStatus[data.status] !== undefined) {
            stats.byStatus[data.status]++;
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      case 'search_feedback': {
        const { query } = args;
        const queryLower = query.toLowerCase();

        // Firestore doesn't support full-text search, so we fetch all and filter
        const snapshot = await db
          .collection('feedback')
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get();

        const items = snapshot.docs
          .map(formatFeedback)
          .filter(
            (item) =>
              item.title?.toLowerCase().includes(queryLower) ||
              item.description?.toLowerCase().includes(queryLower)
          );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query,
                  count: items.length,
                  items,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'update_feedback': {
        const { id, status, adminNotes } = args;

        // Validate at least one update field is provided
        if (!status && adminNotes === undefined) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'At least one of status or adminNotes must be provided',
                }),
              },
            ],
          };
        }

        // Check if document exists
        const docRef = db.collection('feedback').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Feedback not found', id }),
              },
            ],
          };
        }

        // Build update object
        const updateData = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (status) {
          updateData.status = status;
        }

        if (adminNotes !== undefined) {
          updateData.adminNotes = adminNotes;
        }

        // Perform update
        await docRef.update(updateData);

        // Fetch updated document
        const updatedDoc = await docRef.get();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Feedback ${id} updated successfully`,
                  feedback: formatFeedback(updatedDoc),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            stack: error.stack,
          }),
        },
      ],
    };
  }
});

// Main
async function main() {
  try {
    initializeFirebase();
    console.error('Firebase initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Firebase Feedback MCP server running');
}

main().catch(console.error);
