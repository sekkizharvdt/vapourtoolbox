#!/bin/bash

# Quick resume script to show current session status
# Run this after VSCode crashes to get context

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          Claude Code Session Resume Information               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "📍 Current Branch & Status"
echo "─────────────────────────────────────────────────────────────────"
git branch --show-current
echo ""
git status --short
echo ""

echo "📝 Last 3 Commits"
echo "─────────────────────────────────────────────────────────────────"
git log -3 --oneline --decorate --color=always
echo ""

echo "📄 Recent Session Log (last 40 lines)"
echo "─────────────────────────────────────────────────────────────────"
if [ -f ".claude/SESSION_LOG.md" ]; then
    tail -40 .claude/SESSION_LOG.md
else
    echo "⚠️  No SESSION_LOG.md found"
fi
echo ""

echo "✅ Active Todo Lists"
echo "─────────────────────────────────────────────────────────────────"
if [ -d "$HOME/.claude/todos" ] && [ "$(ls -A $HOME/.claude/todos)" ]; then
    echo "Found todo files in ~/.claude/todos/"
    ls -1 $HOME/.claude/todos/ | tail -3
    echo ""
    echo "Latest todo content:"
    latest_todo=$(ls -t $HOME/.claude/todos/*.json 2>/dev/null | head -1)
    if [ -n "$latest_todo" ]; then
        echo "File: $(basename $latest_todo)"
        cat "$latest_todo" 2>/dev/null | head -30
    fi
else
    echo "No active todo lists found in ~/.claude/todos/"
fi
echo ""

echo "🔧 Uncommitted Changes"
echo "─────────────────────────────────────────────────────────────────"
if [ -n "$(git diff --name-only)" ] || [ -n "$(git diff --cached --name-only)" ]; then
    echo "Modified files:"
    git diff --name-only
    git diff --cached --name-only
else
    echo "✅ No uncommitted changes (working tree clean)"
fi
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Share this information with Claude to resume your session     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
