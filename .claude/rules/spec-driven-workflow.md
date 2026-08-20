# Spec-driven development (OpenSpec)

This repo uses [OpenSpec](https://github.com/Fission-AI/OpenSpec) for spec-driven development.
Non-trivial changes (new feature, behavior change, data-shape change) should go through it
instead of being implemented directly from a one-line request:

1. `/opsx:propose "<what you want to build>"` — creates `openspec/changes/<name>/` with
   `proposal.md`, a spec delta under `specs/<capability>/spec.md`, `design.md`, and `tasks.md`.
   This step is planning-only: no app code is touched.
2. Review the generated artifacts (or ask for edits) before implementation starts.
3. `/opsx:apply` — implements the change per `tasks.md`, following `openspec/config.yaml`'s
   project context and rules.
4. `/opsx:archive` — once shipped, folds the spec delta into `openspec/specs/` (the running
   source of truth for what the system does) and archives the change.

Use `/opsx:explore` to investigate/discuss an idea without committing to a proposal yet, and
`/opsx:update` to revise an in-flight change's artifacts.

Skip this workflow for trivial fixes (typo, small copy change, obvious one-line bug fix) — use
judgment, don't force process onto work that doesn't need it. `openspec/config.yaml` carries
this project's tech stack, data-model, and scraper-specific rules so proposals stay grounded —
read it, don't restate it in specs.
