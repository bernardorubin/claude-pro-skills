# Add and Commit (no push)

Stage all changes, generate an appropriate commit message based on the diff, and commit. Does not push — use this when the remote blocks pushes (branch protection, pre-receive hooks, push-blocked config) or when you want to keep commits local.

## Instructions

1. Run `git status` and `git diff` to understand what changed
2. Stage all changes with `git add -A`
3. Generate a concise, descriptive commit message based on the changes (1-2 sentences focusing on the "why")
4. Commit with the generated message (no co-author lines or AI attribution)
5. Report the result to the user — do NOT push
