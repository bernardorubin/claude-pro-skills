---
name: wrap-session
description: Use at end of session when the user wants to do BOTH the worklog write AND the vault sweep in one command — the combined end-of-session wrap-up. Triggers on phrases like "wrap up the session", "wrap session", "save session everywhere", "save to worklog and vault", "worklog and vault", "save both", "do both", "log and save the session", "end-of-session save". For only the worklog use [[save-session-to-worklog]]; for only the wiki use [[save-to-vault]].
---

# Wrap Session

One command for the two things done at every session end: log **what you did**
(worklog, for standups/invoicing) and file **what you learned** (knowledge vault).
This skill is a conductor — it does not reimplement either; it invokes them in order.

## Steps

1. **Worklog** — invoke the [[save-session-to-worklog]] skill, forwarding `$ARGUMENTS`
   to it verbatim (that's the skill that takes freetext notes, `--project`, `--dry`).
2. **Vault** — invoke the [[save-to-vault]] skill. It takes no arguments.
3. **Report** — one combined summary: the worklog file + item count, then the vault
   pages filed (or "nothing new to file"). Don't repeat each sub-skill's full output.

## Notes

- **Order matters**: worklog first (chronology of the session), vault second (the
  distilled knowledge). Run step 2 even if step 1 logged nothing — a session can be
  learning-heavy but commit-light, or vice versa.
- **`--dry`**: if `$ARGUMENTS` contains `--dry`, run the worklog step in its dry-run
  preview and **skip the vault write** (dry means write nothing anywhere), then stop.
- **No vault registered**: [[save-to-vault]] will say so and point to `/vault-init`.
  That's fine — the worklog step still ran (it falls back to `~/Desktop/`). Just relay it.
- ponytail: both sub-skills each git-sync the vault, so a vault project gets two
  commits (worklog, then wiki). Left as-is — separate commits read cleanly; dedupe the
  sync only if it ever becomes a problem.
