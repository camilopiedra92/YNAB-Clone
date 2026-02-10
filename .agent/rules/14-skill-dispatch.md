# Skill Dispatch Table (Mandatory)

**Before starting any task, check this table.** If the user's request matches a trigger pattern, you **MUST** read the corresponding skill's `SKILL.md` via `view_file` BEFORE writing any code or running any command. Skipping a matching skill is a protocol violation.

## Dispatch Table

| Trigger Pattern                                                      | Skill                  | Action                                                                                 |
| -------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| Git commit, push, save, subir, enviar, envía, guardar cambios        | `git-commit-formatter` | `view_file` on `.agent/skills/git-commit-formatter/SKILL.md` → follow protocol exactly |
| New feature, new entity, CRUD, full-stack addition                   | `create-feature`       | `view_file` on `.agent/skills/create-feature/SKILL.md` → follow all steps              |
| UI design, styling, component visual design, layout, CSS, aesthetics | `frontend-design`      | `view_file` on `.agent/skills/frontend-design/SKILL.md` → follow guidelines            |
| Code review, PR review, quality audit, review changes                | `code-review`          | `view_file` on `.agent/skills/code-review/SKILL.md` → follow checklist                 |
| E2E test, Playwright test, browser test, integration test            | `create-e2e-test`      | `view_file` on `.agent/skills/create-e2e-test/SKILL.md` → follow patterns              |
| RTA mismatch, RTA bug, Ready to Assign wrong, RTA discrepancy        | `debug-rta`            | `view_file` on `.agent/skills/debug-rta/SKILL.md` → follow diagnostic flow             |
| Create a skill, new skill, document a pattern                        | `create-skill`         | `view_file` on `.agent/skills/create-skill/SKILL.md` → follow structure                |

## Rules

1. **Check BEFORE acting.** The dispatch check happens before any code generation, file editing, or command execution.
2. **Multiple matches are possible.** If a task involves both "new feature" AND "E2E test", read BOTH skills.
3. **Skills are instructions, not suggestions.** Once a skill is read, follow its steps as a protocol.
4. **No shortcuts.** Even if you "already know" the procedure, you MUST `view_file` the SKILL.md. The skill is the single source of truth.
