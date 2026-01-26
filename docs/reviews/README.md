# Codebase Reviews

This folder contains periodic codebase reviews conducted to assess code quality, identify issues, and track improvements.

## Review Schedule

Reviews are conducted:

- After major feature implementations
- Before major releases
- Quarterly for general health check

## Review Template

When conducting a review, create a new file: `YYYY-MM-DD.md`

```markdown
# Codebase Review - [Date]

## Summary

Brief overview of findings.

## Metrics

- Test coverage: X%
- Type errors: X
- Lint warnings: X
- Bundle size: X MB

## Findings

### Critical Issues

Issues that must be fixed immediately.

### High Priority

Issues that should be fixed soon.

### Medium Priority

Improvements to consider.

### Low Priority

Nice-to-have improvements.

## Recommendations

Actionable next steps.

## Completed Since Last Review

What was fixed from previous review.
```

## Past Reviews

| Date                        | Grade       | Key Findings                                                                                     |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| [2026-01-20](2026-01-20.md) | B+ (8.5/10) | Proposals module complete, Entity ledger opening balance, PR approval buttons, 0 Proposals tests |
| [2026-01-05](2026-01-05.md) | B+ (8.4/10) | Holiday working system, on-duty requests, breadcrumbs, HR test coverage improved                 |
| [2025-12-26](2025-12-26.md) | B+ (8.2/10) | Zero type/lint errors, 17.6% statement coverage, fixed useParams bug, HR module needs tests      |

## How to Conduct a Review

1. Run full test suite: `pnpm test`
2. Check type errors: `pnpm type-check`
3. Check lint: `pnpm lint`
4. Review recent PRs and commits
5. Check error monitoring (Sentry)
6. Document findings in new review file
