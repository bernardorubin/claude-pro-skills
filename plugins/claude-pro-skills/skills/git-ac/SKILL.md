---
name: git-ac
description: Use when the user wants to stage all changes and commit locally WITHOUT pushing. Useful when the remote blocks pushes (branch protection, pre-receive hooks, push-blocked config) or when batching commits locally before pushing. Triggers on phrases like "commit but don't push", "stage and commit", "commit locally", "git ac", "add and commit only", "commit without pushing".
---

# Add and Commit (no push)

Stage all changes, generate an appropriate commit message based on the diff, and commit. Does not push — use this when the remote blocks pushes (branch protection, pre-receive hooks, push-blocked config) or when you want to keep commits local.

## Instructions

1. Run `git status` and `git diff` to understand what changed
2. Stage all changes with `git add -A`
3. Generate the commit message: imperative mood, single lead line, no body, no bullets (e.g. `Add retry to webhook dispatcher`)
4. Commit with the generated message (no co-author lines or AI attribution)
5. Report the result to the user — do NOT push
