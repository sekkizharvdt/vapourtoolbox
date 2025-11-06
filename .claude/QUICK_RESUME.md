# 🚀 Quick Resume After VSCode Crash

## TL;DR - One Command Resume

```bash
./.claude/resume.sh
```

This shows everything you need: git status, recent commits, session log, and todo lists.

---

## What Survives a Crash? ✅

| What                     | Where                    | Survives? | Reliable?              |
| ------------------------ | ------------------------ | --------- | ---------------------- |
| **Git Commits**          | `.git/`                  | ✅ YES    | ✅ Always accurate     |
| **Git Status**           | Working directory        | ✅ YES    | ✅ Always accurate     |
| **Session Log**          | `.claude/SESSION_LOG.md` | ✅ YES    | ✅ If manually updated |
| **Uncommitted Changes**  | Working directory        | ✅ YES    | ✅ Always accurate     |
| **Todo Lists**           | `~/.claude/todos/*.json` | ✅ YES    | ⚠️ May be stale        |
| **Conversation History** | Claude's memory          | ❌ NO     | ❌ Lost on crash       |

**Note**: Todo lists are session-specific and only updated when Claude explicitly calls TodoWrite. They can be stale. **Always prioritize git status and SESSION_LOG.md for resumption.**

---

## How to Resume

### Option 1: Quick Context (Recommended)

```bash
# Run the resume script
./.claude/resume.sh

# Then tell Claude:
"VSCode crashed. Here's the resume output: [paste output]"
```

### Option 2: Manual Context

Tell Claude:

```
VSCode crashed. Please check:
1. .claude/SESSION_LOG.md
2. git status
3. git log -3
4. Latest todo from ~/.claude/todos/

What were we working on?
```

### Option 3: If You Remember

```
VSCode crashed. We were working on [describe what you remember].
Can you check the session log and git status to confirm?
```

---

## Important Files

### `.claude/SESSION_LOG.md`

- **What**: Running log of current session's work
- **Update**: After completing major tasks or before ending session
- **Contains**: What was done, what's next, important context

### `~/.claude/todos/*.json`

- **What**: Auto-saved todo lists (per session)
- **Location**: Your home directory (persists across projects)
- **Contains**: Task lists with completion status

### Git Commits

- **What**: Permanent checkpoints of your work
- **View**: `git log --oneline -5`
- **Contains**: Code changes + descriptive messages

---

## Pro Tips

1. **Update SESSION_LOG.md regularly** - It's your resume anchor
2. **Commit working code often** - Each commit is a recovery point
3. **Use descriptive commit messages** - Helps Claude understand context
4. **Keep untracked files minimal** - Easier to see what matters

---

## Example Resume Flow

```bash
# 1. Run resume script
./.claude/resume.sh > ~/resume-output.txt

# 2. Start new Claude session and say:
"VSCode crashed. I've run .claude/resume.sh and here's the output:
[paste or describe the key points]

What were we working on and what's the status?"

# 3. Claude will read:
#    - SESSION_LOG.md
#    - git status
#    - Recent commits
#    And tell you exactly where you left off
```

---

## When SESSION_LOG.md Doesn't Exist Yet

If this is your first session or SESSION_LOG.md is empty:

```bash
# Claude can still help by checking:
git log -5 --oneline          # Recent work
git status                     # Current state
git diff                       # Uncommitted changes
ls ~/.claude/todos/            # Todo history
```

---

## Create New Session Log Entry

When starting new work after a crash, Claude can create a new entry:

```
"Please create a new session log entry based on:
- Current git status
- Last few commits
- Any todo lists you can find
- What I'm about to work on: [describe]"
```

---

**Remember**: The THREE RELIABLE sources for resumption:

1. 🔀 **Git commits** (automatic, always accurate) ⭐
2. 📊 **Git status** (automatic, always accurate) ⭐
3. 📝 **SESSION_LOG.md** (manual, but reliable if updated) ⭐

~~4. 📋 ~/.claude/todos/ (can be stale, don't rely on it)~~

**Pro Tip**: Update SESSION_LOG.md before ending your session, and commit your code often. These two habits make resumption effortless.
