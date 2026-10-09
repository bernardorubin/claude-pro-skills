---
name: claude-learn
description: Use when the user wants to document learnings from the current session into CLAUDE.md files, making future Claude sessions smarter. Triggers on phrases like "document what we learned", "update CLAUDE.md with this learning", "save this to CLAUDE.md", "claude-learn", "review the session for learnings", "what should we document from this session".
---

# Claude Learn

Review the current session and document valuable learnings to CLAUDE.md files, making future Claude sessions smarter.

## Usage

- `/claude-learn` - Review session and apply updates
- `/claude-learn [learning]` - Document a specific learning

## Instructions

### Step 1: Review the Session

Analyze what happened in this conversation:
1. What problems were solved?
2. What patterns or conventions were established?
3. What gotchas or tricky bugs were discovered?
4. What workflow optimizations were found?
5. What integration quirks or project-specific rules emerged?

### Step 2: Identify Valuable Learnings

Filter for learnings worth documenting:

**Worth adding:**
- Patterns that will recur (coding conventions, architectural decisions)
- Gotchas that were tricky to solve and could happen again
- Project-specific rules that deviate from general practices
- Integration quirks that aren't obvious from code
- Workflow optimizations specific to this project
- User preferences for tools, workflow, or communication style

**Skip:**
- One-off fixes unlikely to recur
- Information already in code comments or READMEs
- Temporary workarounds
- General knowledge not specific to this project
- Session-specific context (current task details, in-progress work)

### Step 3: Determine Location

Choose where to add each learning (most specific location wins):

| Knowledge type | Location |
|---------------|----------|
| Cross-project (user prefs, general patterns) | `~/.claude/CLAUDE.md` |
| Project-wide (architecture, gotchas) | Project root `CLAUDE.md` |
| Module-specific (component patterns) | Nearest subdirectory `CLAUDE.md` |

### Step 4: Read Before Writing

Before making any edits:
1. Read the target CLAUDE.md file to check for duplicates
2. Check the file size — enforce these limits:
   - **Global CLAUDE.md** (`~/.claude/CLAUDE.md`): Keep under 300 lines
   - **Project root CLAUDE.md**: Keep under 700 lines
   - **Module CLAUDE.md files**: Keep under 400 lines each
3. If approaching limits: consolidate or prune outdated entries before adding new ones
4. Edit existing entries before adding new ones — deepen, don't duplicate

### Step 5: Write Updates

For each learning, write a concise addition:
- Keep it to 2-5 lines typically
- Make it actionable (tell future Claude what to DO, not just what exists)
- Include WHY when not obvious
- Place in appropriate existing section, or create new section if needed

### Step 6: Apply and Confirm

1. Edit the target CLAUDE.md file
2. Confirm what was added using the output format below

## Output Format

```markdown
## Self-Improvement Report

### Added to [path/to/CLAUDE.md]:
**Section: [section name]**
> [content added]

### Added to Global CLAUDE.md:
**Section: [section name]**
> [content added]

### Skipped (already documented or not valuable):
- [item] - [reason]

### No updates needed:
Nothing worth documenting from this session.
```

## Examples of Good Updates

```markdown
# In Project CLAUDE.md (root):

## API Patterns
- Always use `fetchWithRetry()` from `lib/api.ts` instead of raw fetch - it handles auth refresh and rate limiting

## Gotchas
- The `UserProfile` component expects `user.preferences` to be initialized - pass empty object `{}` not `undefined`

# In modular files (if project has them):

## In components/CLAUDE.md:
- Always wrap icons in Animated.View, never animate icons directly (breaks on web)

## In server/CLAUDE.md or api/CLAUDE.md:
- Mutations must be idempotent - always check for existing record before writing

# In Global CLAUDE.md:

## TypeScript Patterns
- Prefer type inference over explicit types when the type is obvious from context
```
