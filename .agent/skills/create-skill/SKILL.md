---
name: create-skill
description: Creates new Antigravity skills following the correct folder structure, frontmatter conventions, and best practices. Use when the user asks to create a new skill, document a repeating pattern, or extend the agent's capabilities for a specific task.
---

# Skill: Create Skill

Use this skill when creating a new Antigravity skill. A skill is a reusable knowledge package that extends the agent's capabilities for a specific, repeatable task.

## When to Create a Skill

Create a skill when you identify:

- A **multi-step pattern** that repeats across conversations (e.g., creating features, debugging issues)
- A **complex domain** that requires consolidated knowledge (e.g., financial calculations)
- A task that benefits from **helper scripts** the agent can execute

**Don't create a skill** when:

- A simple rule in `.agent/rules/` would suffice (static guidelines)
- A workflow in `.agent/workflows/` covers it (sequential steps)
- The pattern is too unique to repeat

## Decision Tree: Skill vs Rule vs Workflow

```
Is it a set of static guidelines the agent should always follow?
  → YES → Create a Rule (.agent/rules/*.md)
  → NO ↓

Is it a sequence of terminal commands to execute?
  → YES → Create a Workflow (.agent/workflows/*.md)
  → NO ↓

Does it involve domain knowledge + examples + optional scripts?
  → YES → Create a Skill (.agent/skills/<name>/)
```

## Steps

### 1. Choose a Name

- Lowercase with hyphens: `create-feature`, `debug-rta`, `deploy-staging`
- Verb-noun format preferred: action + target
- Must be unique across all skills

### 2. Create the Folder Structure

Use the template from [resources/folder-template.txt](resources/folder-template.txt):

```
.agent/skills/<skill-name>/
├── SKILL.md           # Instructions (required)
├── examples/          # Reference implementations (if needed)
├── scripts/           # Helper scripts (if needed)
└── resources/         # Templates and assets (if needed)
```

**Rules:**

- `SKILL.md` is the **only required file**
- Code examples go in `examples/`, NOT inline in SKILL.md
- Executable scripts go in `scripts/`
- Templates and static assets go in `resources/`

### 3. Write the SKILL.md

Use the template from [resources/skill-template.md](resources/skill-template.md). Key sections:

#### Frontmatter (Critical)

```yaml
---
name: my-skill
description: Precise, keyword-rich description that helps the agent recognize when this skill is relevant. Written in third person.
---
```

**The `description` is the trigger mechanism.** The agent decides whether to use a skill based primarily on this field. Follow these rules:

- ❌ Vague: `"Database tools"`
- ❌ Generic: `"Helps with testing"`
- ✅ Precise: `"Creates Playwright E2E tests using the project's auth setup, navigation helpers, and data-testid selectors. Use when adding browser-level integration tests."`
- ✅ Keyword-rich: `"Diagnostic flowchart for debugging Ready to Assign (RTA) calculation discrepancies"`

**Tips for descriptions:**

- Write in **third person** ("Creates...", "Generates...", "Debugs...")
- Include **keywords** the user would say ("E2E test", "debug RTA", "new feature")
- Mention **when** to use it ("Use when adding...", "Use for debugging...")
- Keep it to **1-2 sentences**

#### Body Structure

The SKILL.md body should contain:

1. **One-line purpose** — When to use this skill
2. **Prerequisites/infrastructure** — What the user needs to know upfront
3. **Steps** — Numbered, sequential instructions
4. **Key rules/pitfalls** — Gotchas and common mistakes
5. **File reference table** — Links to examples/ and scripts/

**Key principles:**

- **Keep it concise** — Instructions, not documentation. Reference `examples/` for code
- **Reference, don't inline** — `See [examples/route.ts](examples/route.ts)` not a 50-line code block
- **Use tables** — For file references, helper mappings, pitfall lists
- **Include a checklist** — For multi-step skills

### 4. Create Supporting Files

#### Examples (`examples/`)

- **Annotated, runnable reference implementations**
- Each file should have a header comment explaining the pattern
- Name files by layer/purpose: `repo.ts`, `route.ts`, `example.spec.ts`
- Include comments that explain _why_, not just _what_

See [examples/good-example-header.ts](examples/good-example-header.ts) for the annotation style.

#### Scripts (`scripts/`)

- **Atomic:** Each script does one thing well
- **Self-documenting:** Support `--help` flag so the agent can discover usage
- **Language-agnostic:** Use whatever fits (Bash, TypeScript, Python)
- **Referenced by relative path** in SKILL.md

#### Resources (`resources/`)

- Templates, checklists, or static assets the SKILL.md references
- Not executable — just reference material

### 5. Verify

After creating the skill, verify:

- [ ] `SKILL.md` has valid YAML frontmatter with `description`
- [ ] Description is specific and keyword-rich (not vague)
- [ ] No large code blocks inline — examples are in `examples/`
- [ ] Scripts are in `scripts/`, not inline
- [ ] All relative paths in SKILL.md actually resolve
- [ ] Skill does ONE thing well (not a catch-all)

## Anti-Patterns

| Anti-Pattern                           | Fix                                    |
| -------------------------------------- | -------------------------------------- |
| Giant SKILL.md with all code inline    | Move code to `examples/` files         |
| Vague description like "Utility tools" | Be precise: what, when, keywords       |
| Skill that does 5 different things     | Split into focused skills              |
| Script without `--help`                | Add usage documentation                |
| No examples directory                  | Add annotated reference files          |
| Duplicating rules/workflows as skills  | Use the right tool (see decision tree) |

## Reference

| File                                                               | Purpose                             |
| ------------------------------------------------------------------ | ----------------------------------- |
| [resources/skill-template.md](resources/skill-template.md)         | SKILL.md template with placeholders |
| [resources/folder-template.txt](resources/folder-template.txt)     | Folder structure template           |
| [examples/good-example-header.ts](examples/good-example-header.ts) | Annotation style for example files  |
