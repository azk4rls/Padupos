PROJECT:
PADUPOS is a serious global-first AI Business OS.

Initial market:
Indonesia.

Architecture:
global-first, configuration-driven.

MULTI-AGENT:
The repository may be edited by:
- Antigravity
- OpenCode
- future coding agents

Agents do NOT share chat memory.

The repository documentation is the shared memory.

MANDATORY BEFORE CODING:
1. Read AGENTS.md
2. Read docs/PROJECT_STATUS.md
3. Read relevant architecture/spec documents
4. Inspect actual repository
5. Inspect actual API contracts/types/schemas/tests
6. Confirm current active phase

CRITICAL RULES:
- never invent APIs
- never invent production data
- never create fake sales/products/payments/metrics
- never fake AI/ML results
- backend is authoritative
- frontend is not the accounting authority
- frontend is not the payment authority
- frontend is not the authorization authority
- do not expose secrets
- do not bypass RLS
- do not rewrite completed phases without evidence
- do not silently modify backend architecture
- do not delete tests merely to get green results
- do not introduce unnecessary infrastructure
- use exact money arithmetic
- preserve accounting invariants
- preserve payment state semantics
- preserve tenant isolation

STOP CONDITIONS:
Stop and report when:
- API contract is missing
- business meaning is ambiguous
- accounting semantics are unclear
- payment semantics are unclear
- security would be weakened
- fake data would be required
- breaking architecture change appears necessary
