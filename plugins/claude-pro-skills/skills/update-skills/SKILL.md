---
name: update-skills
description: >-
  Use when the user wants to update the claude-pro-skills plugin (this toolkit)
  to its latest published version. Triggers on "update the claude pro skills",
  "update my skills to the latest", "update the plugin to latest", "pull the
  latest claude-pro-skills", "update the toolkit", "update-skills", "get the
  newest skills". Runs the non-interactive `claude plugin` CLI to update the
  marketplace from its GitHub source and reinstall the latest version, reports
  the old → new version, and reminds the user to run /reload-plugins to apply it
  in the current session. NOT for editing a skill's *content* (that's
  skill-creator) — this only pulls the newest published build of the plugin.
---

# Update Skills

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

### 3. Reinstall the latest

```bash
claude plugin install claude-pro-skills@claude-pro-skills
```

Installs at `user` scope by default (matches how it's installed). This pulls
whatever version the marketplace now points at.

### 4. Confirm the new version

```bash
claude plugin list 2>/dev/null | grep -iA2 'claude-pro-skills@claude-pro-skills' | grep -i version
```

### 5. Report + hand off the reload

Tell the user briefly:
- **old → new version** (e.g. "Updated 3.9.1 → 3.10.0"). If it was already latest,
  say "Already on the latest (3.x.y) — nothing to update."
- **Run `/reload-plugins`** to apply it in this session (or it's live next session).
  You can't run that yourself — it's an interactive command.

## If the CLI isn't available or a step fails

Fall back to the manual path and hand the user the exact slash commands to run
themselves:

```
/plugin marketplace update claude-pro-skills
/plugin install claude-pro-skills@claude-pro-skills
/reload-plugins
```

## Notes

- **Just this toolkit** — to update *every* installed plugin instead, `claude plugin
  marketplace update` with no name updates all marketplaces; mention that only if the
  user asks for a broader update.
- This is a pull of the newest *published* build. If the user wants to change what a
  skill *does*, that's an edit to the skill's `SKILL.md` (skill-creator territory),
  not this.
