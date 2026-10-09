---
name: claude-modularize
description: Use when the user wants to break down a large, monolithic CLAUDE.md file into smaller maintainable pieces distributed across the project directory structure. Triggers on phrases like "modularize CLAUDE.md", "split up CLAUDE.md", "break down our CLAUDE.md", "distribute CLAUDE.md by directory", "claude-modularize", "our CLAUDE.md is too big".
---

# Modularize CLAUDE.md

Break down a large, monolithic CLAUDE.md file into smaller, maintainable pieces distributed across the project's directory structure.

## Instructions

### Phase 1: Analysis

1. **Read the existing CLAUDE.md** thoroughly to understand all instructions, patterns, and guidelines
2. **Explore the project structure** to understand:
   - Directory organization and naming conventions
   - Key areas (components, features, utilities, configs, etc.)
   - Where different types of code live
3. **Identify logical groupings** in the content:
   - Component-specific guidelines
   - Feature-specific patterns
   - Technology-specific rules (CSS, JS, Liquid, etc.)
   - Workflow and process instructions
   - Architecture and design principles

### Phase 2: Planning

1. **Map content to locations**:
   - Component guidelines → `components/CLAUDE.md` or `src/components/CLAUDE.md`
   - API patterns → `api/CLAUDE.md` or `lib/api/CLAUDE.md`
   - Styling rules → `styles/CLAUDE.md`
   - Testing standards → `tests/CLAUDE.md`
   - Feature-specific → `features/[feature-name]/CLAUDE.md`

2. **Present plan to user** before making changes:
   - Proposed file locations
   - Content for each file
   - How root CLAUDE.md will reference them
   - Get explicit approval before proceeding

### Phase 3: Implementation

1. **Create modular CLAUDE.md files**:
   - Each file focused and self-contained
   - Only instructions relevant to that directory's scope
   - Clear headers and organization
   - Concise but comprehensive

2. **Restructure root CLAUDE.md** to:
   - Contain only project-wide, universal instructions
   - Include directory of modular files with purposes
   - Reference child files using consistent format

### Reference Format for Root CLAUDE.md

```markdown
## Modular Instructions

This project uses distributed CLAUDE.md files for context-specific guidance:

| File | Purpose |
|------|---------|
| `src/components/CLAUDE.md` | Component development standards |
| `src/api/CLAUDE.md` | API integration patterns |
| `tests/CLAUDE.md` | Testing requirements |

Refer to these files when working in their respective directories.
```

## Content Distribution

**Keep in root CLAUDE.md:**
- Project overview and context
- Universal coding standards
- Git/version control policies
- Communication preferences
- Cross-cutting architectural principles
- References to modular files

**Move to modular files:**
- Directory-specific patterns
- Technology-specific rules (isolated to certain areas)
- Feature-specific guidelines
- Component patterns and examples
- Testing strategies for specific areas

## Quality Standards

1. **No content loss** - All original instructions preserved somewhere
2. **No duplication** - Each instruction in exactly one place
3. **Logical placement** - Instructions near the code they affect
4. **Clear references** - Root file makes it easy to find any instruction
5. **Appropriate granularity** - 3-8 modular files is optimal
6. **Consistent formatting** - All CLAUDE.md files follow similar structure

## Common Patterns by Project Type

**React/Next.js:**
- `components/CLAUDE.md`, `hooks/CLAUDE.md`, `pages/CLAUDE.md`, `lib/CLAUDE.md`

**Shopify Themes:**
- `sections/CLAUDE.md`, `blocks/CLAUDE.md`, `snippets/CLAUDE.md`, `assets/CLAUDE.md`

**Backend:**
- `controllers/CLAUDE.md`, `models/CLAUDE.md`, `services/CLAUDE.md`, `middleware/CLAUDE.md`

## Execution Rules

1. Always read before writing
2. Explore project structure first
3. Propose before implementing - get user confirmation
4. Create files atomically (complete each before moving on)
5. Update root CLAUDE.md last
6. Verify all original content is accounted for
