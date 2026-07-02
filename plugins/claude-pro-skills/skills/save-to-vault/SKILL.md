---
name: save-to-vault
description: Use when the user wants a deliberate end-of-session sweep that files everything valuable from the WHOLE conversation into the project's knowledge vault (Karpathy-style LLM Wiki) in one pass — not the ambient single-fact writes that [[vault-keeper]] does during normal work. Reviews the entire session, dedupes against what's already filed, and writes each worth-keeping finding into the right wiki page. Resolves the cwd against `~/.config/claude-pro-skills/vaults.json`; if no vault is registered it says so and points to `/vault-init`. Triggers on phrases like "save to vault", "save this session to the vault", "save whatever's valuable from this session", "dump this session to the wiki", "file everything worth keeping", "/save-to-vault".
allowed-tools: Read, Write, Edit, Bash(jq:*), Bash(cat:*), Bash(test:*), Bash(ls:*), Bash(date:*), Bash(grep:*), Bash(find:*), Bash(git:*)
---

# Save to Vault

A one-pass, deliberate sweep of the **current conversation** into the project's knowledge vault. Where `vault-keeper` files facts incidentally as they come up during work, this skill is the explicit "we're done, now capture everything worth keeping" command — the session-level analogue of `vault-keeper`'s ingest mode, with the conversation itself as the source.

This skill does NOT reinvent the vault's mechanics. It **defers to `vault-keeper`'s write-mode rules and the vault's own `CLAUDE.md`** for page format, citation style, folder choice, and the index/log update. Its only added value is scope and intent: review the *whole* session, decide what clears the bar, file it all, and report.

---

## Step 1 — Resolve the vault

Same registry lookup as `vault-keeper`. Walk up the cwd directory tree against `~/.config/claude-pro-skills/vaults.json`:

```bash
test -f ~/.config/claude-pro-skills/vaults.json || { echo "no-registry"; exit 0; }
DIR="$(pwd)"
VAULT=""
while [ "$DIR" != "/" ] && [ -z "$VAULT" ]; do
  VAULT=$(jq -r --arg d "$DIR" '.vaults[$d] // empty' ~/.config/claude-pro-skills/vaults.json 2>/dev/null)
  DIR="$(dirname "$DIR")"
done
echo "${VAULT:-(no vault for this project)}"
```

**If no vault matches**: unlike `vault-keeper` (which self-terminates silently because it auto-fires), this skill was invoked explicitly — so tell the user plainly: "No vault is registered for this project. Run `/vault-init` to set one up." Then stop.

**If a vault matches**: continue.

## Step 2 — Load the vault's schema

Read `{vault}/CLAUDE.md` once. It is the schema authority — page format, citation conventions, folder semantics, auto-update triggers, hard rules. Everything you write must conform to it. If it's missing, the vault is malformed: surface that and suggest `/vault-init`; don't improvise rules.

Also read `{vault}/wiki/index.md` to learn what pages already exist (so you file into the right ones and don't create near-duplicates).

## Step 3 — Sweep the conversation

Scan the entire session and extract every finding that clears the vault's filing threshold (the vault's `CLAUDE.md` defines it; typically: *would knowing this have saved 5+ minutes at session start?*). Pull from these categories:

- **Debugging findings** — root cause + the reusable fix or diagnostic signature → `wiki/playbooks/<topic>.md`
- **Integration details/quirks** — non-obvious behavior of a third-party service or API → `wiki/integrations/<service>.md`
- **Architectural decisions + rationale** → relevant `wiki/projects/*.md` and/or `wiki/concepts/*.md`
- **Team/ownership facts** — who owns what, who to ping, expertise → `wiki/people/<name>.md`
- **Epic context** spanning multiple files/sessions → `wiki/tickets/<ID>.md`
- **New terms/concepts** used repeatedly → `wiki/concepts/<term>.md`

**Skip**: ephemeral status (PR review state, in-flight bugs already fixed in the same commits), anything the source code already documents clearly, and one-off trivia.

## Step 4 — Dedupe, then write

For each finding, before writing:

1. **Check whether it's already filed.** `vault-keeper` may have written some of it proactively earlier in the same session (this is common). Read the candidate target page. If the fact is already there and current, skip it. If it's there but now contradicted or outdated, update it — and per the vault's hard rules, mark contradictions explicitly rather than silently overwriting (note both claims, link the newer source).
2. **Write the new/changed facts** into the appropriate page, following the vault `CLAUDE.md`'s page format and citation rules. Add `[[wiki-links]]` in both directions; if you introduce a link to a page that doesn't exist yet, stub it (summary line + Related pages section — no empty pages).

When uncertain which folder a finding belongs in, ask the user rather than guessing.

## Step 5 — Update index and log (required)

After all writes, per the vault's hard rules:

1. Refresh the affected entries in `{vault}/wiki/index.md`.
2. Append one line per touched page to `{vault}/wiki/log.md`:
   ```bash
   TODAY=$(date "+%Y-%m-%d")
   # e.g. ## [2026-06-13] update | playbooks/<topic> | <what changed>
   ```

## Step 6 — Sync the vault to its remote (git-backed vaults only)

If the vault is a git repo with a remote, commit and push everything you just wrote, and auto-resolve any conflict by **union-merge**. This keeps a shared vault in sync across machines/teammates with no manual git step. The vault is its own repo, separate from any code repo, and is designed to be synced continuously, so **push it without asking** (this does not affect code-repo push approvals). Skip silently if the vault isn't a git repo or has no `origin` remote (a local-only vault).

```bash
# $VAULT was resolved in Step 1. Always use `git -C "$VAULT"`, never cd.
if git -C "$VAULT" rev-parse --git-dir >/dev/null 2>&1 \
   && git -C "$VAULT" remote get-url origin >/dev/null 2>&1; then
  if [ -n "$(git -C "$VAULT" status --porcelain)" ]; then
    git -C "$VAULT" add -A
    git -C "$VAULT" commit -q -m "vault: <short summary of what this sweep filed>"
  fi
  BRANCH="$(git -C "$VAULT" rev-parse --abbrev-ref HEAD)"
  git -C "$VAULT" pull --rebase origin "$BRANCH"   # sync teammates first
  git -C "$VAULT" push origin "$BRANCH"
fi
```

**Auto-resolve conflicts by union-merge.** If the `pull --rebase` conflicts (a teammate edited the same page/log), keep **BOTH** sides — never discard either. `wiki/log.md` and per-user worklogs are append-only and union cleanly; a wiki page edited on both sides keeps both statements (mark the contradiction per the vault's hard rules). This is exactly the [[vault-resolve-conflicts]] behavior — invoke that skill, or apply it inline: for each conflicted file replace the `<<<<<<< / ======= / >>>>>>>` block with both sides concatenated, then `git -C "$VAULT" add -A && git -C "$VAULT" rebase --continue`, then push. Only stop and surface if a conflict genuinely can't be union-merged.

## Step 7 — Report

Tell the user briefly what was filed — one line per page touched, in the form `Filed [[page-name]] — <hook>`. If nothing cleared the bar (e.g. a short or purely conversational session, or everything was already filed by `vault-keeper`), say so plainly instead of forcing entries. If the vault was synced, note it in one line (e.g. `Committed + pushed to the vault remote.`).

---

## Relationship to other skills

| Skill | When | Scope |
|---|---|---|
| `vault-keeper` | Auto-fires during work; ambient | One or two pages per incidental finding |
| **`save-to-vault`** | Explicit, end-of-session | Sweeps the whole conversation in one deliberate pass |
| `save-session-to-worklog` | Explicit, end-of-session | Writes the chronological worklog (`raw/work-logs/`), NOT the wiki |
| `vault-init` | One-time | Scaffolds a new vault + registers it |

`save-to-vault` and `save-session-to-worklog` are complementary: the worklog records *what you did* (for standups/invoicing); the vault records *what you learned* (cross-linked domain knowledge). Running both at session end is a reasonable habit.
