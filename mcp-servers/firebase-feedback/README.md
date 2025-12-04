# Firebase Feedback MCP Server

This MCP server provides Claude Code with read-only access to the Firebase feedback collection.

## Setup Instructions

### 1. Create a Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (vapour-toolbox)
3. Go to **Project Settings** (gear icon) → **Service Accounts**
4. Click **Generate new private key**
5. Save the downloaded JSON file as `service-account-key.json` in this directory

**IMPORTANT**: The service account key gives admin access to your Firebase project. Keep it secure and never commit it to version control.

### 2. Install Dependencies

```bash
cd mcp-servers/firebase-feedback
npm install
```

### 3. Configure Claude Code

Add the MCP server to your Claude Code settings.

**Option A: Project-level settings** (`.claude/settings.local.json`):

```json
{
  "mcpServers": {
    "firebase-feedback": {
      "command": "node",
      "args": ["/home/sekki/projects/VDT-Unified/mcp-servers/firebase-feedback/index.js"]
    }
  }
}
```

**Option B: User-level settings** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "firebase-feedback": {
      "command": "node",
      "args": ["/home/sekki/projects/VDT-Unified/mcp-servers/firebase-feedback/index.js"]
    }
  }
}
```

### 4. Restart Claude Code

After configuring, restart Claude Code to load the MCP server.

## Available Tools

Once configured, Claude will have access to:

- **list_feedback**: List all feedback with optional filters (type, status)
- **get_feedback**: Get details of a specific feedback item
- **get_feedback_stats**: Get statistics about feedback submissions
- **search_feedback**: Search feedback by keyword

## Security Notes

- This server provides **read-only** access to the feedback collection
- The service account key should be kept secure
- Add `service-account-key.json` to `.gitignore` (already done)

## Troubleshooting

If the server fails to start:

1. Check that `service-account-key.json` exists in this directory
2. Verify the JSON file is valid
3. Ensure Node.js is installed (v18+)
4. Check the Claude Code logs for errors
