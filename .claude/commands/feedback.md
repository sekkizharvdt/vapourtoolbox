# Feedback

Review and manage user feedback from the Firebase feedback system.

## Arguments

- `$ARGUMENTS` - Optional: "bugs", "features", "new", or a specific feedback ID

## Steps

1. List feedback based on arguments:
   - No args or "new": List new/unprocessed feedback
   - "bugs": List bug reports
   - "features": List feature requests
   - Specific ID: Get details for that feedback item

2. Use the MCP tools:
   - `mcp__firebase-feedback__list_feedback` - List all feedback
   - `mcp__firebase-feedback__get_feedback` - Get specific item
   - `mcp__firebase-feedback__search_feedback` - Search by keyword
   - `mcp__firebase-feedback__get_feedback_stats` - Get statistics

3. When working on feedback:
   - Update status to "in_progress" when starting
   - Add admin notes with what was done
   - Update status to "resolved" when fixed with commit reference
   - Include deployment date in resolution notes

4. For bug fixes:
   - Reproduce the issue first
   - Fix the code
   - Test the fix
   - Commit with reference to feedback ID
   - Update feedback status
