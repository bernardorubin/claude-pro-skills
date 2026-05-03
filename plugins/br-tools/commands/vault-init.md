# Initialize a new project vault

Scaffold a Karpathy-style LLM Wiki vault for the current project, register it, and (optionally) version-control it.

After this runs, the [[vault-keeper]] skill will auto-engage on this project — Claude reads from and writes to the vault during normal work.

## Arguments

`$ARGUMENTS` — Optional. Accepts a vault path. If omitted, prompts interactively.

```
/vault-init                            → Interactive: prompts for paths, git, GitHub
/vault-init ~/MyProjectVault           → Use this vault path; still prompts for the rest
/vault-init ~/MyProjectVault --no-git  → No git; just scaffold + register
```

## Instructions

### Step 1 — Determine the project path

The **project path** is the directory whose Claude sessions should activate the vault. Walk up from the current working directory until you find a directory that looks like a project root (contains any of: `.git/`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `CLAUDE.md`).

If `$ARGUMENTS` doesn't override the path, **ask the user**:

> Project path to register? \[default: `<detected>`\]

If they accept the default, use it. Otherwise use what they provide. Resolve to an absolute path.

### Step 2 — Determine the vault path

Default vault path: `~/<project-basename>Vault` (e.g., project `apps/myapp` → `~/MyappVault`, capitalized).

If `$ARGUMENTS` provided a vault path, use that. Otherwise ask:

> Vault path? \[default: `~/MyappVault`\]

Expand `~` to `$HOME`. Resolve to an absolute path.

**Refuse to proceed if:**
- The project path is already registered in `~/.config/br-tools/vaults.json` (offer to overwrite explicitly)
- The vault path already exists and contains files other than `.obsidian/` or `.git/` (offer to use it as-is and skip scaffolding, or pick a different path)

### Step 3 — Ask about version control

Two prompts (independent):

> Init git inside the vault? \[Y/n\]

> Create a private GitHub repo? \[Y/n\]

Default both to yes. The GitHub repo only happens if `gh` is installed and authed (`gh auth status` succeeds). If git is no, GitHub is automatically no.

### Step 4 — Scaffold the vault

Create the directory structure:

```bash
mkdir -p {vault}/raw/{projects,work-logs/archive,archive/projects}
mkdir -p {vault}/wiki/{people,projects,integrations,concepts,playbooks,tickets,sources}
mkdir -p {vault}/templates
touch    {vault}/raw/{projects,work-logs,work-logs/archive,archive,archive/projects}/.gitkeep
touch    {vault}/wiki/{people,projects,integrations,concepts,playbooks,tickets,sources}/.gitkeep
```

Write the following files (use the exact content shown — these are templates, not Claude-generated prose):

#### `{vault}/CLAUDE.md`

The schema. Generic Karpathy-style. The user will customize it over time as their domain becomes clearer.

````markdown
# {Project} Vault — LLM Wiki

A persistent, auto-updating second brain for {Project} work. Based on Andrej Karpathy's LLM Wiki pattern.

The human curates sources, asks questions, and directs analysis. **Claude maintains the wiki** — writing pages, cross-linking, updating the index, logging operations, and folding new findings into existing pages so knowledge compounds instead of getting re-derived every session.

## Folder structure

```
raw/                    ← source documents
  projects/             ← EPIC/INITIATIVE-SCOPED bundles — refs + plans for one project
    <epic-slug>/        ← e.g. eve-integration/, mobile-redesign/, etc.
      *.md              ← reference docs (immutable) AND living plans together
  work-logs/            ← worklog files; current month at top, past months in archive/
    archive/            ← past months auto-rotated here by /save-session-to-worklog
  archive/
    projects/           ← retired epic folders (final-ingested + archived)
wiki/                   ← LLM-maintained markdown
  index.md    ← TOC for the entire wiki, organized by category
  log.md      ← append-only chronological operation log (single file, Karpathy pattern)
  people/     ← people involved (one page per person)
  projects/   ← repos / sub-projects
  integrations/ ← third-party services and APIs
  concepts/   ← flows, patterns, domain ideas
  playbooks/  ← repeatable how-tos (testing, deployment, debugging)
  tickets/    ← major tickets/epics worth persistent context
  sources/    ← summary pages for ingested raw/ docs
templates/    ← page templates for new wiki entries
.obsidian/    ← Obsidian config (don't touch, if used)
```

## Page format

Every wiki page uses YAML frontmatter + a structured body:

```markdown
---
summary: One-line description.
sources:
  - filename.md
last_updated: YYYY-MM-DD
tags: [tag1, tag2]
---

# Page Title

**Summary**: One to two sentences expanding on the frontmatter summary.

---

Main content. Short paragraphs, clear headings. Use [[wiki-links]] generously to connect related concepts.

Every factual claim that came from a source gets a citation: Some claim (source: filename.md).

## Related pages

- [[related-page-1]]
- [[related-page-2]]
```

**Page-name conventions**: lowercase, hyphenated. Tickets are the exception (e.g., `HPY-5611.md`).

## When to write to the vault (auto-update triggers)

You don't wait for an explicit "ingest" command for everyday updates. During any session, when you encounter one of the following, write or update the relevant wiki page **without asking permission** (1–2 page touches max). For larger ingests of a new raw source, follow the **ingest workflow** below.

| Signal | Action |
|---|---|
| Integration detail or quirk worth remembering | Update `wiki/integrations/<service>.md` |
| Architectural decision + rationale | Update `wiki/projects/*.md` and/or `wiki/concepts/*.md` |
| Debugging finding (root cause + fix pattern) | Add/update `wiki/playbooks/<topic>.md` |
| Person fact (ownership, expertise, communication norms) | Update `wiki/people/<name>.md` |
| Multi-step or multi-week effort touching many files | Create/update `wiki/tickets/<ID>.md` |
| Contradiction with an existing claim | Note both, mark contradiction explicitly, link to newer source |
| New term/concept used multiple times | Create `wiki/concepts/<term>.md` |

**Always after any auto-update**:
1. Add or refresh the entry in `wiki/index.md`
2. Append a one-line entry to `wiki/log.md` (single append-only operation log). Format: `## [YYYY-MM-DD] update | {page} | {what}`
3. If the update introduces a new wiki-link, ensure the target page exists (stub if needed)

**Threshold for writing**: if a fact would have saved 5+ minutes if known at session start, file it. If it's obvious from reading the code, don't.

## Ingest workflow

When the user adds a new source to `raw/` and asks you to ingest it:

1. Read the full source document
2. **Discuss key takeaways with the user before writing anything** — surface the 3–7 most important findings and ask which to emphasize
3. Write a summary page in `wiki/sources/` named after the source
4. Create or update concept/entity/integration pages for each major idea or entity
5. Add `[[wiki-links]]` connecting related pages (in both directions)
6. Update `wiki/index.md` with new pages and one-line summaries
7. Append a log entry to `wiki/log.md`: `## [YYYY-MM-DD] ingest | {source title} | {pages touched count}`

If a source contradicts an existing wiki page, do NOT silently overwrite. Note the contradiction in the page (`> **Conflict**: source X says ..., source Y says ...`) and ask the user how to resolve.

## Query workflow

When the user asks a question:

1. Read `wiki/index.md` first to find candidate pages
2. Follow links and synthesize an answer with citations to specific wiki pages
3. If the answer isn't in the wiki, say so clearly. Offer to investigate and **file the answer back as a new wiki page**

## Lint workflow

When asked to lint or audit:
- Orphans (pages with no inbound `[[wiki-links]]`)
- Stubs (`[[wiki-links]]` to nonexistent pages)
- Contradictions
- Stale claims (`last_updated` older than newer sources cited)
- Format violations
- Index drift (pages exist but not in `index.md`, or vice versa)

Report as a numbered list. Don't auto-fix — surface and let the user decide.

## Citation rules

- Every factual claim from `raw/` gets a citation: `(source: filename.md)`.
- If two sources disagree, note the contradiction explicitly.
- If a claim has no source (came from code, conversation, inference), mark it `(unverified)` or `(from code: path/to/file.ts)`.
- Wiki-to-wiki references use `[[wiki-links]]`, not citations.

## Hard rules

1. **`raw/` is per-file mutable.** Reference docs (anything inside `raw/projects/<slug>/` that's not flagged as a living plan) are citation anchors and shouldn't be modified. Living plans (typically the execution-plan file within each project folder) and worklog files (`raw/work-logs/`) ARE meant to be edited freely by both Claude and the user. The immutability principle is per-file, not per-`raw/`.

## Epic-shipped workflow (when work for a project completes)

When an epic in `raw/projects/<slug>/` is complete:

User says: *"Do a final ingest of `raw/projects/<slug>/` then archive it"* (optionally adds *"and delete it"*).

Claude:
1. Re-reads each file in the folder and diffs against existing wiki content
2. Files anything new or changed into the relevant wiki pages (concepts, integrations, tickets, etc.)
3. Adds a log entry capturing what was new in the final pass
4. `git mv raw/projects/<slug>/ raw/archive/projects/<slug>/`
5. If the user said "and delete it": also `rm -rf raw/archive/projects/<slug>/` after archiving (or instead — confirm intent)
6. Confirms: "archived [and deleted]; citations are filename-only and remain valid"

Default behavior is archive (reversible). Deletion is explicit because re-ingestion is sometimes useful later.
2. **Always update `wiki/index.md` and `wiki/log.md`** after any wiki write.
3. **Page names are lowercase-hyphenated** (except ticket IDs).
4. **No empty wiki pages** — at least a summary line and a "Related pages" section.
5. **When uncertain about categorization, ask the user.**
````

> Replace `{Project}` with the project basename (e.g., "Happy", "MyApp"). Do this textual substitution, not literally.

#### `{vault}/wiki/index.md`

```markdown
---
summary: Table of contents for the entire {Project} wiki. Updated on every page create/update.
last_updated: YYYY-MM-DD
tags: [meta, index]
---

# {Project} Wiki Index

The catalog of every wiki page. Browse by category. Each entry: link + one-line summary.

> **Status**: scaffolded YYYY-MM-DD. Empty until first ingest.

---

## People

_Stubs to fill as encountered._

## Projects / Areas

_Stubs to fill as encountered._

## Integrations

_Stubs to fill as encountered._

## Concepts

_Stubs to fill as encountered._

## Playbooks

_Stubs to fill as encountered._

## Tickets / Epics

_Stubs to fill as encountered._

## Sources (raw/)

_Summary pages for ingested raw documents._
```

#### `{vault}/wiki/log.md`

Single append-only chronological log (Karpathy's pattern). One file, never rotates.

```markdown
# {Project} Vault Operation Log

Append-only chronological record of every vault operation. Newest entries at the bottom. Format: `## [YYYY-MM-DD] {op} | {target} | {note}`.

Greppable: `grep "^## \[" wiki/log.md | tail -10`

Operation types: `init`, `ingest`, `update`, `lint`, `query`, `worklog`.

---

## [YYYY-MM-DD] init | vault scaffolded
Created CLAUDE.md schema, wiki/index.md, wiki/log.md, and category subfolders. Registered with vault-keeper.
```

#### `{vault}/templates/page.md`

```markdown
---
summary: One-line description of this page.
sources: []
last_updated: YYYY-MM-DD
tags: []
---

# {{Page Title}}

**Summary**: One to two sentences.

---

## Overview

Main content.

## Related pages

- [[related-page]]
```

(Optionally also write `templates/person.md`, `templates/integration.md`, `templates/ticket.md` — same frontmatter+headings pattern as `page.md`, specialized per category. Keep it minimal at scaffold time; the user can add more templates as their wiki grows.)

#### `{vault}/.gitignore`

```gitignore
# Obsidian — track config, ignore per-machine workspace state
.obsidian/workspace*.json
.obsidian/cache/
.obsidian/plugins/*/data.json

# macOS
.DS_Store

# Editor / IDE
.vscode/
.idea/
*.swp
*~
```

#### `{vault}/README.md`

```markdown
# {Project} Vault

A personal knowledge base for {Project} work. Built on Andrej Karpathy's LLM Wiki pattern.

Three layers:
1. `raw/` — source documents (immutable; user curates)
2. `wiki/` — markdown pages Claude maintains, cross-linked via `[[wiki-links]]`
3. `CLAUDE.md` — the schema (page format, ingest workflow, auto-update triggers)

Open in [Obsidian](https://obsidian.md). Entry point: `wiki/index.md`. The vault auto-updates during Claude sessions via the `vault-keeper` skill in br-tools.

> ⚠️ Personal knowledge base.
```

### Step 5 — Init git (if requested)

```bash
cd {vault}
git init -q
git add -A
git commit -q -m "Scaffold {Project} vault"
```

### Step 6 — Create GitHub repo (if requested)

Confirm `gh` is installed and authed first:

```bash
command -v gh >/dev/null && gh auth status >/dev/null 2>&1
```

If yes, create the repo:

```bash
gh repo create "{vault-basename}" --private \
  --source=. --remote=origin --push \
  --description="Personal LLM Wiki / second brain for {Project} work (Karpathy pattern)"
```

If `gh` isn't available or auth fails, skip silently and tell the user how to do it manually:

> Skipped GitHub creation. To do it later: `cd {vault} && gh repo create {vault-basename} --private --source=. --remote=origin --push`

### Step 6.5 — Add a Knowledge Vault section to the project's CLAUDE.md

Look for an existing `CLAUDE.md` at the **project path** (not the vault path) — this is the file Claude auto-loads on every session in that project. Adding a short section makes the vault discoverable to anyone reading it.

Ask the user (default Yes):

> Add a "Knowledge Vault" section to `{project-path}/CLAUDE.md`? \[Y/n\]

If they accept:

- **If `{project-path}/CLAUDE.md` exists** and does NOT already contain a `## Knowledge Vault` heading: append the snippet below.
- **If `{project-path}/CLAUDE.md` exists** AND already has a `## Knowledge Vault` heading: skip with a note ("project already has a vault section, skipped"). Do not silently rewrite.
- **If `{project-path}/CLAUDE.md` does NOT exist**: ask whether to create one with just the vault section. Default Yes.

The snippet (substitute `{vault-path}` and `{project-basename}`):

```markdown

## Knowledge Vault

A `{project-basename}` vault is registered for this project at `{vault-path}` (Karpathy-style LLM Wiki, Obsidian-compatible). The `vault-keeper` skill (br-tools) handles read/write rules — see its SKILL.md for the auto-update triggers and the vault's own `CLAUDE.md` for schema rules. The `~/.claude/projects/<cwd-mangled>/memory/` files remain session-level scratch (per-conversation feedback) — distinct from the vault's persistent, cross-linked knowledge layer.
```

If the user declines, skip silently. The registry alone is enough for the skill to function.

### Step 7 — Register the vault

Update `~/.config/br-tools/vaults.json`. Create the file + parent dir if missing.

```bash
mkdir -p ~/.config/br-tools

if [ ! -f ~/.config/br-tools/vaults.json ]; then
  echo '{"vaults":{}}' > ~/.config/br-tools/vaults.json
fi

# Add the entry (idempotent — overwrites if key exists):
jq --arg p "{project-path}" --arg v "{vault-path}" \
  '.vaults[$p] = $v' \
  ~/.config/br-tools/vaults.json > ~/.config/br-tools/vaults.json.tmp \
  && mv ~/.config/br-tools/vaults.json.tmp ~/.config/br-tools/vaults.json
```

### Step 8 — Confirm

Tell the user, briefly:

```
✓ Vault scaffolded at {vault}
✓ Registered {project} → {vault}
[✓ Added "Knowledge Vault" section to {project}/CLAUDE.md]
[✓ git init + initial commit]
[✓ GitHub: github.com/<user>/<vault-basename> (private)]

The vault-keeper skill will now auto-engage on sessions in {project}.
Open the vault in Obsidian to browse. Entry point: wiki/index.md.
```

Don't dump the full file tree. The user can `ls` if curious. Bracketed lines are conditional — only include them for steps that actually ran.

## Edge cases

- **Project already registered**: ask if they want to overwrite the existing mapping. Default no.
- **Vault path exists with content**: ask if they want to use it as-is (skip scaffolding) or pick a different path.
- **`gh` not installed / not authed**: skip GitHub silently, tell the user how to do it manually.
- **Running outside a git repo and outside any project-like dir**: still allow it; vault doesn't require a project to be initialized for itself.

## Related

- `vault-keeper` skill — does the actual reading/writing once the vault exists
- `/save-session-to-worklog` — vault-aware; routes worklogs into `{vault}/raw/work-logs/` for any project registered in the vault registry
