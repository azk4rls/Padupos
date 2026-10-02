# AGENT_WORKFLOW.md

Multi-Agent Coordination

## PRINCIPLE

Agents do NOT share chat memory. The repository documentation is the shared memory.


## BEFORE WORK
1. Read AGENTS.md
2. Read docs/PROJECT_STATUS.md
3. Read relevant architecture/spec documents
4. Inspect actual repository (code, contracts, schemas, tests)
5. Inspect actual API contracts/types/schemas/tests
6. Confirm current active phase


## DURING WORK
- Work ONLY within active phase scope
- Never invent APIs, production data, or fake results
- No silent architecture changes
- Preserve all invariants (accounting, payments, tenant isolation)
- Backend is authoritative; never move business logic to frontend


## AFTER WORK
- Run typecheck (pnpm -r run typecheck)
- Run lint (pnpm -r run lint)
- Run relevant tests (pnpm -r run test or specific suites as appropriate)
- Build where appropriate (pnpm build)
- Update docs/PROJECT_STATUS.md with current state
- List exact files changed
- Record next step
- Commit only if explicitly requested by user


## AGENT EXAMPLE FLOW
- Antigravity verifies/updates status, commits if requested
- OpenCode reads AGENTS.md + PROJECT_STATUS.md, inspects repo, implements active phase, verifies, updates status, reports
- Future agents follow identical process

