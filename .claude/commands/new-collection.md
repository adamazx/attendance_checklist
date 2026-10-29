---
description: Scaffold a new Payload collection with role-scoped access + AuditLog
argument-hint: <CollectionName>
---

Create a new Payload collection named $ARGUMENTS for the advisor attendance system. Follow the conventions in `CLAUDE.md` and `.claude/rules/code-style.md`: TypeScript, role-scoped access (advisors limited to their own classroom), relationships to existing entities where appropriate, and an AuditLog `afterChange` hook if it is mutable. Match the style of existing collections. Prefer delegating to the `payload-collection-builder` subagent, then show me the diff.
