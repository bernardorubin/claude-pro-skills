---
name: update-claude-pro-skills
description: >-
  Use when the user wants to update the claude-pro-skills plugin (this toolkit)
  to its latest published version. Triggers on "update the claude pro skills",
  "update my skills to the latest", "update the plugin to latest", "pull the
  latest claude-pro-skills", "update the toolkit", "update-claude-pro-skills", "get the
  newest skills". Runs the non-interactive `claude plugin` CLI to update the
  marketplace from its GitHub source and reinstall the latest version, reports
  the old → new version, and reminds the user to run /reload-plugins to apply it
  in the current session. NOT for editing a skill's *content* (that's
  skill-creator) — this only pulls the newest published build of the plugin.
---

# Update Claude Pro Skills

Pull the latest published version of the **claude-pro-skills** plugin. The user
has been updating it by hand with the interactive `/plugin` slash commands; this
skill does the same via the non-interactive `claude plugin` CLI so it "just works"
from a plain request.

**The one thing this skill can't do:** apply the update to the *currently running*
session — that needs the interactive `/reload-plugins`, which is user-side UI (a
skill can't type slash commands into the session). So this skill updates the plugin
on disk and tells the user to run `/reload-plugins`; the update is picked up
automatically on the next session either way.

## Steps

### 1. Capture the current version

```bash
claude plugin list 2>/dev/null | grep -iA2 'claude-pro-skills@claude-pro-skills' | grep -i version
```

Note it (e.g. `3.9.1`) so you can show old → new at the end.

### 2. Update the marketplace from its GitHub source

```bash
claude plugin marketplace update claude-pro-skills
```

This re-fetches `bernardorubin/claude-pro-skills` so the newest published version
becomes available to install.

### 3. Update the plugin to the latest

```bash
claude plugin update claude-pro-skills@claude-pro-skills
```

This is the command that actually upgrades it — it prints e.g. `updated from 3.9.1
to 3.10.0`. **Use `update`, not `install`**: `claude plugin install` no-ops with
"already installed" when the plugin is present and does NOT upgrade it.

### 4. Confirm the new version

```bash
claude plugin list 2>/dev/null | grep -iA2 'claude-pro-skills@claude-pro-skills' | grep -i version
```

### 5. Report + hand off the reload

Tell the user briefly:
- **old → new version** (e.g. "Updated 3.9.1 → 3.10.0"). If it was already latest,
  say "Already on the latest (3.x.y) — nothing to update."
- **Apply it**: the update lands on disk, but the running session needs a reload to
  pick it up. Tell the user to run **`/reload-plugins`** (that reloads the plugin and
  its skills) — and if a **new or renamed** skill still doesn't show up (a rename like
  `ship-build` → `cut-release` sometimes needs it), **`/reload-skills`** too. Or just
  restart Claude Code (the CLI notes "restart to apply"), which always works. You can't
  run any of those yourself — they're interactive commands. It's live automatically in
  the next session regardless.

  **Word the reminder to the user with both, e.g.:** "Run `/reload-plugins` to apply it
  (and `/reload-skills` if the renamed/new skills don't appear), or restart."

## If the CLI isn't available or a step fails

Fall back to the manual path and hand the user the exact slash commands to run
themselves:

```
/plugin marketplace update claude-pro-skills
/reload-plugins
```

(The interactive `/plugin` menu updates the plugin and `/reload-plugins` applies it —
that's the by-hand flow this skill automates.)

## Notes

- **Just this toolkit** — to update *every* installed plugin instead, `claude plugin
  marketplace update` with no name updates all marketplaces; mention that only if the
  user asks for a broader update.
- This is a pull of the newest *published* build. If the user wants to change what a
  skill *does*, that's an edit to the skill's `SKILL.md` (skill-creator territory),
  not this.
