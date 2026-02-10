# Git Commit Workflow (Mandatory)

**When the user asks to commit, push, save, "subir", or "enviar" code to Git, you MUST read and follow the `git-commit-formatter` skill BEFORE doing anything else.**

## The Rule

1. **Read the skill first:** `view_file` on `.agent/skills/git-commit-formatter/SKILL.md`.
2. **Follow it exactly:** Use `npm run git:sync -- "type(scope): message"` as described in the skill. No `git status`, no `git diff`, no exploration.
3. **No exceptions:** Even if the request seems simple or you "already know" what to do, the skill defines the protocol.

## Why This Exists

Without this rule, the agent sometimes skips the skill and runs raw `git` commands (status → add → commit → push), which causes multi-turn loops and inconsistent commit messages. The skill's Autopilot script handles everything in a single command.
