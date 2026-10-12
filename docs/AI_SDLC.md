# AI across the software lifecycle

AI multiplies whatever it lands on. Clean code, clear standards and fast feedback come first; otherwise it just
produces more of the wrong thing faster.

## How this repo was built

This project was built with an AI coding assistant (Claude Code) and a human in the loop. The assistant wrote and
refactored code, tests and docs. Every change was checked by running lint, typecheck, unit tests, a production
build and black-box smoke tests. That process caught real defects that the assistant's first version had:

- Unknown URLs returned HTTP 200 (soft 404s). Root cause was `partialPrefetching` streaming an app shell first.
- A page assumed its layout had already rejected a bad brand, but layouts and pages render in parallel (a 500).
- Canonical URLs fell back to `localhost`.

The lesson is the practice, not the tool: **AI output is a draft, and the pipeline decides whether it ships.**

## Where AI helps, by phase

| Phase | Use | Human check |
|---|---|---|
| Requirements | Draft acceptance criteria and edge cases from a ticket | Product owner confirms intent |
| Design | Compare options, draft ADRs, review an approach for failure modes | Tech lead owns the decision |
| Coding | Assistants and agents for implementation, refactors, migrations | Author reads every line; PR review required |
| Code review | First-pass review for bugs, security and style | Human reviewer approves |
| Testing | Generate unit tests and regression cases; propose edge cases | Tests must fail when the code is wrong |
| Docs and runbooks | Draft from code and incidents | Owner verifies accuracy |
| Release and operations | Summarize changes, triage alerts, draft post-mortems | On-call decides |

## Guardrails

- AI-written code goes through the same CI and review as any other code. No exceptions.
- No secrets, customer data or proprietary code in prompts without an approved tool and policy.
- Prompts and standards live in the repo (`AGENTS.md`), so behavior is consistent and reviewable.
- Generated tests are checked by breaking the code on purpose and confirming they fail.
- Humans own decisions about architecture, security and anything touching checkout.

## Measuring impact

Adoption is not impact. Baseline first, then track weekly:

| Metric | Why |
|---|---|
| PR cycle time (open to merge) | Speed without skipping review |
| Change failure rate and rollbacks | Quality, not just throughput |
| Escaped defects, by source | Whether AI-assisted changes cause more or fewer |
| Test coverage and flake rate | Safety net health |
| Time to onboard a new engineer | Whether docs and tooling are working |
| Developer survey (monthly) | Where it helps and where it gets in the way |

Share results, including what did not work, with the wider team.
