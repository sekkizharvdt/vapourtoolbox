# Codebase Reviews

Periodic codebase reviews to assess code quality, identify issues, and track improvements.

## Past Reviews

| Date                        | Grade  | Key Findings                                                                              |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| [2026-03-15](2026-03-15.md) | 9.0/10 | 328 commits, MED design platform, fixed assets, Flow redesign, 190-finding audit complete |
| [2026-01-20](2026-01-20.md) | 8.5/10 | Proposals module complete, entity ledger opening balance, PR approval buttons             |
| [2026-01-05](2026-01-05.md) | 8.4/10 | Holiday working system, on-duty requests, breadcrumbs, HR test coverage                   |
| [2025-12-26](2025-12-26.md) | 8.2/10 | First formal review. Zero type/lint errors, fixed useParams bug                           |

## Security Reviews

| Date                                          | Scope            | Document                                                       |
| --------------------------------------------- | ---------------- | -------------------------------------------------------------- |
| [2026-03-15](2026-03-15-security-findings.md) | Full application | Auth, rules, storage, headers, integrations, external services |

## How to Conduct a Review

1. Run full test suite: `pnpm test`
2. Check type errors: `pnpm type-check`
3. Check lint: `pnpm lint`
4. Review recent commits: `git log --oneline --since="LAST_REVIEW_DATE"`
5. Check error monitoring (Sentry)
6. Use [TEMPLATE.md](TEMPLATE.md) for structure
7. Document findings in new file: `YYYY-MM-DD.md`
