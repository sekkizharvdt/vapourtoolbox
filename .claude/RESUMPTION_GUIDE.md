# How to Resume Work After VSCode Crashes

## Quick Resume Checklist

When starting a new session after a crash or interruption, follow these steps:

### 1. Check Session Log

```bash
cat .claude/SESSION_LOG.md
```

This file contains:

- What was accomplished in the last session
- What's pending
- Important context and decisions made
- Modified files that may need attention

### 2. Check Git Status

```bash
git status
git log -3 --oneline
git diff
```

This shows:

- Uncommitted changes
- Recent commits
- What was last worked on

### 3. Check Todo Lists

```bash
# List all active todo files (stored in home directory)
ls -la ~/.claude/todos/

# View the most recent todo file
ls -t ~/.claude/todos/*.json | head -1 | xargs cat | jq '.'
```

Todo lists are automatically saved in `~/.claude/todos/` and persist across sessions.

### 4. Ask Claude to Resume

Simply say:

> "Looks like VSCode crashed. We were working on [topic]. Can you see the session log and todo list?"

Or more generally:

> "Can you check SESSION_LOG.md and tell me what we were working on?"

Claude will:

- Read SESSION_LOG.md
- Check git status
- Review todo lists
- Provide a summary of where things were left off

## Best Practices for Smooth Resumption

### 1. Commit Early, Commit Often

- Commit working code frequently
- Use descriptive commit messages
- Each commit is a checkpoint you can resume from

### 2. Update SESSION_LOG.md

Before ending work or when making significant progress, update:

```markdown
## Current Session: YYYY-MM-DD

### ✅ Completed Tasks

- What was done
- Files modified
- Issues resolved

### 📋 Next Steps

- What needs to be done next
- Any blockers or considerations

### 🔍 Context

- Important decisions made
- Things to remember
- Links to relevant documentation
```

### 3. Use Todo Lists for Multi-Step Tasks

Todo lists are automatically saved. They help track:

- Which tasks are completed
- What's in progress
- What's pending

### 4. Clean Commit Messages

Good commit messages help resume context:

```
fix: resolve Firestore undefined values and deployment index errors

- Fix invoice/bill creation failure by conditionally including
  gstDetails and tdsDetails only when defined
- Remove 2 unnecessary composite indexes from projects collection
```

### 5. Keep Notes in .claude/ Directory

Store important information:

- `.claude/SESSION_LOG.md` - Current session progress
- `.claude/context.md` - Project-wide context (already exists)
- `.claude/claude.md` - Guidelines and conventions (already exists)

## What Claude Can Access After Crash

Claude can read:

- ✅ All files in the project
- ✅ Git history and status
- ✅ SESSION_LOG.md
- ✅ Todo lists (if manually shared or read)
- ✅ Recent commits
- ❌ Previous conversation history (lost after crash)

## Example Resume Commands

### Quick Status Check

```bash
# One-liner to show current state
echo "=== GIT STATUS ===" && git status --short && echo -e "\n=== LAST 3 COMMITS ===" && git log -3 --oneline && echo -e "\n=== SESSION LOG ===" && tail -20 .claude/SESSION_LOG.md
```

### Save this as a script

```bash
# Create resume script
cat > .claude/resume.sh << 'EOF'
#!/bin/bash
echo "📋 Current Session Status"
echo "========================="
echo ""
echo "🔍 Git Status:"
git status --short
echo ""
echo "📝 Last 3 Commits:"
git log -3 --oneline --decorate
echo ""
echo "📄 Session Log (last 30 lines):"
tail -30 .claude/SESSION_LOG.md
echo ""
echo "✅ Todo Lists:"
ls -1 .claude/todos/ 2>/dev/null || echo "No active todos"
EOF
chmod +x .claude/resume.sh
```

Then run: `.claude/resume.sh`

## Template for Resuming

When you restart, tell Claude:

```
VSCode crashed. Here's where we are:

1. Check .claude/SESSION_LOG.md for context
2. Git status: [paste output]
3. Last commit: [paste git log -1]
4. What I remember: [brief description]

Can you help me understand where we left off and what's next?
```

---

**Remember**: The combination of git commits + SESSION_LOG.md + todo lists gives you full resumption capability!
