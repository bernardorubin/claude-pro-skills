# Development Assistant Guidelines

## Defaults
- **Stack**: Next.js, TypeScript, Tailwind CSS (default for new projects — check project CLAUDE.md for overrides)
- **Package manager**: pnpm (always use pnpm, never npm/yarn)
- **Response style**: Balanced — brief explanations for non-obvious decisions, otherwise concise
- **Context persistence**: Never stop tasks early due to token budget. Be persistent and complete tasks fully.

## Migration playbook
When asked to help migrate to a new computer, read `~/Desktop/claude-migration.md` first — it has the full step-by-step playbook (br-tools install, third-party plugin reinstall, file transfers for hooks/scripts/credentials, smoke tests). If the file isn't on the new machine yet, ask me to AirDrop / copy it over from the old one.

## Available Tools

### Personal toolkit — `br-tools` plugin
Single install covers everything below: `/plugin install br-tools@claude-pro-skills`. Source repo: `bernardorubin/claude-pro-skills`.

**Slash commands** (explicit invocation only — namespaced):
`/br-tools:git-acp`, `/br-tools:git-pull-reapply`, `/br-tools:claude-learn`, `/br-tools:claude-modularize`, `/br-tools:prd-to-jira`, `/br-tools:save-session-to-worklog`

**Skills** (auto-trigger on natural language, also `/<name>` in slash palette):
- `/pr-review` — confidence-scored code review with parallel agents. Three modes:
  - **PR mode** (default): `/pr-review 463` or auto-detect from current branch
  - **Local mode**: `/pr-review --local` (review uncommitted + branch diff vs main; auto-fallback when no PR found)
  - **Full-repo mode**: `/pr-review --full-repo` (audit entire codebase; confirms before running on >50 files)
  - Flags: `--lite` (2 sonnet agents instead of 4+), `--inline` (skip file output), `--output <path>`
- `/pr-description` — generate/update a GitHub PR description from the diff
- `/write-slack-message` — copy-paste-ready Slack message saved to Desktop
- `/prd-to-jira` — PRD → Jira epic with right-sized tickets

### Frequently-used external plugins
- `/frontend-design:frontend-design` — ALWAYS use this for UI changes (creative, polished, avoids generic AI aesthetics)
- `/feature-dev:feature-dev` — guided feature development with architecture focus
- `/superpowers:*` — TDD, brainstorming, debugging, planning, writing skills, parallel agents
- `/skill-creator:skill-creator`, `/claude-md-management:*`, `/code-review:*`, `/code-simplifier:*`, `/context7:*`, `/figma:*`

## External Service Integrations

### Jira/Atlassian
- Use `jira-curl` wrapper script (`~/.local/bin/jira-curl`) for all Jira API calls (MCP tools are broken)
- **Usage**: `jira-curl <project> <method> <path> [curl args...]`
- **Projects**: `happy` and `horizon` — credentials live at `~/.config/jira/credentials` (sourced by the script; never commit this file)

## Project Workflow
- Never edit .env.local files - only provide suggestions for changes

### Post-Edit Code Quality (run automatically after edits)
- Run relevant quality tools on modified files only (not the whole project)
- Check project's package.json for available commands, typically:
  - **Linting**: `pnpm lint`
  - **Formatting**: `pnpm format`
  - **Type checking**: `npx tsc --noEmit` (ALWAYS run full project check - catches cross-file type errors that ESLint misses)
- Fix any errors introduced by your changes before moving on
- If a tool isn't available in the project, skip it

### Pre-Implementation Planning (do automatically for significant features)
Before implementing significant features or changes:
1. **Search for existing patterns** - Check how similar things are done in the codebase
2. **Identify reusable code** - Find existing components, hooks, utilities to leverage
3. **Check CLAUDE.md files** - Review project-specific conventions and gotchas
4. **Clarify requirements** - Ask questions if anything is ambiguous
5. **Outline approach** - Briefly explain your plan before writing code

Skip this for trivial changes (typos, small bug fixes, simple additions).

### QA Testing with Playwright (do automatically when QAing UI)
When verifying a UI fix or feature via playwright-cli, capture screenshots as evidence at each key state and save them to `~/Desktop/<TICKET-OR-FEATURE>-screenshots/`. Use descriptive filenames (e.g., `1-invalid-id-shows-error.png`, `2-error-clears-on-edit.png`). This gives me reviewable visual proof without re-running the test myself.

## Version Control
- Never commit or push code unless using `/br-tools:git-acp` - I handle all Git operations myself
- Never push database schema changes - these require manual review and migration
- Focus on providing code solutions and suggestions without any version control actions
- Never include Co-Authored-By lines or AI attribution in commit messages

## Code Quality & Architecture
- Always use the `/frontend-design:frontend-design` skill when making UI changes
- Apply proper TypeScript typing - avoid `any`, use proper interfaces and types, infer types when possible
- Never use eslint-disable, @ts-ignore, or similar suppressions - fix the underlying issue instead. If unavoidable, ask first.
- Keep code DRY - reuse existing components, break large components into smaller pieces
- Use descriptive naming — prefix components with domain context (e.g., `OrderCard` not `Card`)
- Handle loading/error states consistently with skeleton loaders and error boundaries

### Project Structure
- Group by feature/module, not by type. Keep related files close together.
- Use absolute imports with descriptive paths
- Domain-focused structure - it should tell the story of what the application does
- Prefer duplication over wrong abstractions initially
- Make architectural changes early rather than building on shaky foundations

### Component Design
- Deep components that hide complexity behind simple interfaces
- Destructure props and provide defaults. >5 props may indicate mixed responsibilities.
- Separate business logic from UI using composable functions/hooks
- Accessibility: semantic HTML, aria labels, keyboard navigation. Target WCAG AA.
- Default to Server Components; add `"use client"` only when using hooks, event handlers, or browser APIs

### State & Data Management
- Use reducers or state machines for complex state instead of scattered variables
- Built-in state management before external libraries
- Prefer early data fetching over reactive side effects

### Testing
- Integration tests over unit tests, kept close to implementation
- Write tests when adding new features or fixing bugs — not retroactively for existing code
- Check project for test runner (vitest, jest, playwright) before writing tests

### Security & Error Handling
- Validate/sanitize all user inputs. Parameterized queries only. Never log sensitive data.
- Handle errors at appropriate boundaries - don't swallow silently. Use typed errors.

## Anti-Patterns (never do these)
- Don't refactor or "improve" code unrelated to the current task
- Don't add dependencies without asking first
- Don't write boilerplate comments, JSDoc, or type annotations on code you didn't change
- Don't create wrapper abstractions for things used once
- Don't add logging, error handling, or validation beyond what the task requires

## Error Recovery
- If a build/typecheck breaks mid-task, fix it before moving on — don't leave broken state
- If stuck after 2-3 attempts at the same approach, explain what's failing and ask for direction
- If you discover pre-existing bugs unrelated to the task, flag them but don't fix unless asked

## Communication Approach
- Question my assumptions when better solutions exist
- Ask clarifying questions before implementing - avoid making assumptions
- Suggest better approaches when my requests are unnecessarily complex
- Warn me about potential breaking changes
- Keep commit message suggestions short and descriptive
- Don't blindly agree with suggestions that seem problematic - push back constructively

## SOLID Principles
Follow SOLID strictly. Key emphasis:
- **SRP**: One reason to change per component. Separate data fetching, state, and UI.
- **OCP/DIP**: Use composition and dependency injection over modification. Abstract external deps behind hooks/services.
- **LSP**: Wrapped/variant components must accept and pass through all base props.
- **ISP**: Don't pass unused props through component chains. Split large interfaces.

## Auto-Documentation (Self-Improving Claude)

Run `/br-tools:claude-learn` before ending a session to review the conversation for documentation-worthy learnings. This is how Claude improves across sessions.

### What to Document
Document ONLY things that would have saved time if known at session start:
- Gotchas or bugs that were tricky to diagnose
- Architectural decisions and their rationale
- User preferences or workflow patterns
- Integration quirks not obvious from code
- New patterns or conventions established

Do NOT document: one-off fixes, obvious things, info already in code comments, temporary states.

### Where to Document

| Knowledge type | Location |
|---------------|----------|
| Cross-project (user prefs, general patterns) | `~/.claude/CLAUDE.md` |
| Project-wide (architecture, gotchas) | Project root `CLAUDE.md` |
| Module-specific (component patterns) | Nearest subdirectory `CLAUDE.md` |
| Session notes, uncertain learnings | `MEMORY.md` (auto-memory) |

### Documentation Rules
- **Edit existing entries** before adding new ones - deepen, don't duplicate
- Keep entries to 2-5 lines, actionable ("do X" not "X exists")
- If a file feels bloated, prune outdated entries before adding new ones
- Read the target file before writing to avoid duplicates
- Be highly selective - most sessions have nothing worth documenting

### Size Guardrails
- **Global CLAUDE.md**: Keep under 300 lines
- **Project root CLAUDE.md**: Keep under 700 lines
- **Module CLAUDE.md files**: Keep under 400 lines each
- If approaching limits: consolidate, remove outdated content, or move details to MEMORY.md
