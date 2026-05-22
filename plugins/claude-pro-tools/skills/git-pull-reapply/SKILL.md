---
name: git-pull-reapply
description: Use when the user wants to safely pull or rebase the current branch from remote while preserving any local work (handles dirty trees, divergent branches via stash + rebase). Triggers on phrases like "pull and reapply", "pull with my changes", "sync this branch safely", "safe pull", "rebase from remote", "pull but keep my work".
---

# Pull and Reapply Changes

Bring the current branch up to date with remote, preserving any local work.

Handles four scenarios:
1. **Clean tree + fast-forward** → simple `git pull`
2. **Uncommitted changes + fast-forward** → stash, pull, pop
3. **Clean tree + divergent branches** → rebase local commits onto remote
4. **Uncommitted changes + divergent branches** → stash, rebase, pop

Always prefer rebase over merge for divergent branches so history stays linear. Only rebase local commits that haven't been pushed elsewhere.

## Instructions

Run the steps below in order. Don't skip diagnostics — branching behavior depends on the current state.

```bash
# 1. Diagnose state
git fetch
LOCAL_DIRTY=$(git status --porcelain | grep -v '^??' | head -1)
UNTRACKED=$(git status --porcelain | grep '^??' | head -1)
AHEAD=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
BEHIND=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo 0)

echo "Dirty: ${LOCAL_DIRTY:+yes}${LOCAL_DIRTY:-no}"
echo "Untracked: ${UNTRACKED:+yes}${UNTRACKED:-no}"
echo "Ahead: $AHEAD  Behind: $BEHIND"
```

Then pick the matching branch:

### Case A — Already up to date (`BEHIND=0, AHEAD=0`)
Nothing to do. Print "✅ Already up to date" and stop.

### Case B — Fast-forward only (`BEHIND>0, AHEAD=0`)
```bash
# Stash only if dirty (include untracked)
DIRTY_OR_UNTRACKED=${LOCAL_DIRTY:-$UNTRACKED}
if [ -n "$DIRTY_OR_UNTRACKED" ]; then
    git stash push -u -m "Auto-stash before pull $(date)"
    STASHED=1
fi

git pull --ff-only

if [ "$STASHED" = "1" ]; then
    git stash pop
fi
```

### Case C — Local commits only (`BEHIND=0, AHEAD>0`)
Nothing to pull. Remind user to `git push`. Stop.

### Case D — Divergent branches (`BEHIND>0, AHEAD>0`)
Before rebasing, confirm the local commits haven't been pushed anywhere else:
```bash
git branch -r --contains HEAD
```
If the output shows only `origin/<branch>` or nothing, rebase is safe. If it shows another remote or branch, STOP and ask the user — rebasing rewrites commits that may have been shared.

Then:
```bash
DIRTY_OR_UNTRACKED=${LOCAL_DIRTY:-$UNTRACKED}
if [ -n "$DIRTY_OR_UNTRACKED" ]; then
    git stash push -u -m "Auto-stash before rebase $(date)"
    STASHED=1
fi

git pull --rebase

if [ "$STASHED" = "1" ]; then
    git stash pop
fi
```

If the rebase hits conflicts mid-flight, run `git status`, show the user the conflicting files, and stop. Do not run `git rebase --abort` or `--skip` automatically.

## After any case

```bash
# Report the final state
if git diff --name-only --diff-filter=U | grep -q .; then
    echo "⚠️  Conflicts unresolved:"
    git status
else
    git log --oneline -3
    echo "✅ Branch up to date with remote."
fi
```

## Notes

- Always use `git stash push -u` to include untracked files. Without `-u`, new files disappear from the stash.
- Prefer `--ff-only` when there's nothing local to preserve — it fails loudly if history diverged instead of silently creating a merge commit.
- Prefer `--rebase` when local commits exist — keeps history linear and avoids "merge branch 'main' of origin" noise.
- Never force-push or `git reset --hard` as a recovery shortcut. If something goes wrong, use `git reflog` to find the pre-rebase state and reset back.
