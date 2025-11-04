# VDT-Unified Documentation Index

**Complete catalog of all documentation in the project.**

Last Updated: 2025-11-03

---

## 📋 Table of Contents

1. [Active Documentation](#active-documentation) - Current, maintained documents
2. [Archived Documentation](#archived-documentation) - Historical reference
3. [Quick Links](#quick-links) - Common tasks
4. [Documentation Organization](#documentation-organization) - File structure

---

## Active Documentation

### 🎯 Getting Started (Start Here!)

| Document | Description | For Who |
|----------|-------------|---------|
| **[Type Safety Quick Reference](./TYPE_SAFETY_QUICKREF.md)** | Quick fixes for common TypeScript issues | All developers |
| **[TypeScript Guidelines](./TYPESCRIPT_GUIDELINES.md)** | Comprehensive TypeScript & Firebase best practices | All developers |
| **[E2E Testing Guide](./E2E_TESTING_GUIDE.md)** | End-to-end testing with Playwright | QA & Developers |

### 🛡️ Code Quality & Standards

| Document | Description | Updated |
|----------|-------------|---------|
| **[TypeScript Guidelines](./TYPESCRIPT_GUIDELINES.md)** | Complete TypeScript & Firebase type safety guide | 2025-11-03 |
| **[Type Safety Quick Reference](./TYPE_SAFETY_QUICKREF.md)** | Quick reference card for type safety | 2025-11-03 |
| **[Enforcement Strategy](./ENFORCEMENT_STRATEGY.md)** | How we enforce code quality automatically | 2025-11-03 |

### 🏗️ Architecture & Setup

| Document | Description | Updated |
|----------|-------------|---------|
| **[GitHub Setup](./GITHUB_SETUP.md)** | GitHub Actions CI/CD configuration | Active |
| **[Git Hooks Setup](./GIT_HOOKS_SETUP.md)** | Pre-commit hooks and automation | Active |
| **[Database Management](./DATABASE_MANAGEMENT.md)** | Firestore database guidelines | Active |
| **[Workflow Analysis](./WORKFLOW_ANALYSIS.md)** | Development workflow patterns | Active |

### 🧪 Testing

| Document | Description | Updated |
|----------|-------------|---------|
| **[E2E Testing Guide](./E2E_TESTING_GUIDE.md)** | Playwright testing guide | Active |
| **[Accounting Testing Guide](./development/ACCOUNTING_TESTING_GUIDE.md)** | Testing accounting module | Active |

### 📚 Reference & Planning

| Document | Description | Updated |
|----------|-------------|---------|
| **[Roadmap](./ROADMAP.md)** | Project roadmap and milestones | Active |
| **[Automation Summary](./AUTOMATION_SUMMARY.md)** | Automation tools and workflows | Active |
| **[Review Summary](./REVIEW_SUMMARY.md)** | Code review guidelines | Active |

---

## Archived Documentation

### 📦 Accounting Module Archive

Historical documents from accounting module development (moved from root):

| Document | Description | Date |
|----------|-------------|------|
| [Accounting Coming Soon](./archive/accounting-module/ACCOUNTING_COMING_SOON.md) | Future features planning | 2025-11-02 |
| [Module Completion Plan](./archive/accounting-module/ACCOUNTING_MODULE_COMPLETION_PLAN.md) | Completion strategy | 2025-11 |
| [Module Focused Plan](./archive/accounting-module/ACCOUNTING_MODULE_FOCUSED_PLAN.md) | Implementation focus | 2025-11 |
| [Implementation Roadmap](./archive/accounting-module/ACCOUNTING_IMPLEMENTATION_ROADMAP.md) | Development roadmap | 2025-11 |
| [Week 2 Progress](./archive/accounting-module/ACCOUNTING_WEEK2_PROGRESS.md) | Weekly progress report | 2025-11 |

**Note:** These documents are archived for historical reference. Current accounting documentation is in `./development/`

### 📝 Planning Archive

Historical planning documents (moved from root):

| Document | Description | Date |
|----------|-------------|------|
| [Sprint Plan Week 1](./archive/planning/SPRINT_PLAN_WEEK_1.md) | Initial sprint planning | 2025-10 |
| [Cross Module Integration](./archive/planning/CROSS_MODULE_INTEGRATION_ANALYSIS.md) | Integration analysis | 2025-10 |
| [Procurement Progress](./archive/planning/PROCUREMENT_MODULE_PROGRESS.md) | Procurement development | 2025-10 |
| [Remaining Modules Plan](./archive/planning/REMAINING_MODULES_IMPLEMENTATION_PLAN.md) | Future modules | 2025-10 |

**Note:** These documents represent historical planning. Current roadmap is in [ROADMAP.md](./ROADMAP.md)

---

## Quick Links

### Common Tasks

**Writing TypeScript Code?**
1. Check: [Type Safety Quick Reference](./TYPE_SAFETY_QUICKREF.md)
2. Reference: [TypeScript Guidelines](./TYPESCRIPT_GUIDELINES.md)
3. Helper functions: `apps/web/src/lib/firebase/typeHelpers.ts`

**Before Committing?**
1. Pre-commit hooks run automatically
2. See: [Enforcement Strategy - Pre-commit](./ENFORCEMENT_STRATEGY.md#2-pre-commit-hooks-git-level)
3. Check: [Git Hooks Setup](./GIT_HOOKS_SETUP.md)

**Setting Up Development?**
1. Start: [GitHub Setup](./GITHUB_SETUP.md)
2. Configure: [Git Hooks Setup](./GIT_HOOKS_SETUP.md)
3. Database: [Database Management](./DATABASE_MANAGEMENT.md)

**Writing Tests?**
1. E2E: [E2E Testing Guide](./E2E_TESTING_GUIDE.md)
2. Accounting: [Accounting Testing Guide](./development/ACCOUNTING_TESTING_GUIDE.md)

**Understanding the Project?**
1. Roadmap: [ROADMAP.md](./ROADMAP.md)
2. Workflow: [Workflow Analysis](./WORKFLOW_ANALYSIS.md)
3. Automation: [Automation Summary](./AUTOMATION_SUMMARY.md)

### By Role

**New Developer:**
1. [Type Safety Quick Reference](./TYPE_SAFETY_QUICKREF.md)
2. [GitHub Setup](./GITHUB_SETUP.md)
3. [E2E Testing Guide](./E2E_TESTING_GUIDE.md)

**Code Reviewer:**
1. [TypeScript Guidelines](./TYPESCRIPT_GUIDELINES.md)
2. [Enforcement Strategy](./ENFORCEMENT_STRATEGY.md)
3. [Review Summary](./REVIEW_SUMMARY.md)

**QA Engineer:**
1. [E2E Testing Guide](./E2E_TESTING_GUIDE.md)
2. [Accounting Testing Guide](./development/ACCOUNTING_TESTING_GUIDE.md)

**DevOps/CI/CD:**
1. [GitHub Setup](./GITHUB_SETUP.md)
2. [Git Hooks Setup](./GIT_HOOKS_SETUP.md)
3. [Enforcement Strategy - CI/CD](./ENFORCEMENT_STRATEGY.md#4-cicd-pipeline-github-actions)

---

## Documentation Organization

### Directory Structure

```
docs/
├── INDEX.md                        # This file - complete documentation catalog
├── README.md                       # Getting started guide
│
├── Type Safety & Code Quality
│   ├── TYPE_SAFETY_QUICKREF.md    # Quick reference card
│   ├── TYPESCRIPT_GUIDELINES.md    # Complete guidelines
│   └── ENFORCEMENT_STRATEGY.md     # Enforcement mechanisms
│
├── Development Guides
│   ├── E2E_TESTING_GUIDE.md       # Playwright testing
│   ├── GITHUB_SETUP.md            # CI/CD setup
│   ├── GIT_HOOKS_SETUP.md         # Git automation
│   ├── DATABASE_MANAGEMENT.md      # Firestore guides
│   └── WORKFLOW_ANALYSIS.md        # Development workflow
│
├── Reference
│   ├── ROADMAP.md                  # Project roadmap
│   ├── AUTOMATION_SUMMARY.md       # Automation tools
│   └── REVIEW_SUMMARY.md           # Code review
│
├── development/                    # Active development docs
│   └── ACCOUNTING_TESTING_GUIDE.md
│
└── archive/                        # Historical documents
    ├── accounting-module/          # Accounting module history
    │   ├── ACCOUNTING_COMING_SOON.md
    │   ├── ACCOUNTING_MODULE_COMPLETION_PLAN.md
    │   ├── ACCOUNTING_MODULE_FOCUSED_PLAN.md
    │   ├── ACCOUNTING_IMPLEMENTATION_ROADMAP.md
    │   └── ACCOUNTING_WEEK2_PROGRESS.md
    │
    └── planning/                   # Planning history
        ├── SPRINT_PLAN_WEEK_1.md
        ├── CROSS_MODULE_INTEGRATION_ANALYSIS.md
        ├── PROCUREMENT_MODULE_PROGRESS.md
        └── REMAINING_MODULES_IMPLEMENTATION_PLAN.md
```

### Root Level (Project Root)

```
VDT-Unified/
├── README.md                       # Project main README
└── docs/                          # All documentation here
```

**Note:** All `.md` files previously in the project root have been moved to `docs/archive/`

---

## Documentation Standards

### File Naming

- **SCREAMING_SNAKE_CASE.md** for documentation files
- **Descriptive names**: `TYPESCRIPT_GUIDELINES.md` not `guidelines.md`
- **Consistent naming**: Match file name to document title

### Content Standards

- Include "Last Updated" date
- Add table of contents for long documents
- Provide code examples
- Link to related documents
- Keep language clear and concise

### When to Archive

Archive documents when:
- ✅ Feature/module is complete
- ✅ Document is superseded by newer version
- ✅ Content is historical reference only
- ✅ Planning phase is complete

Keep documents active when:
- 📚 Referenced frequently
- 🔄 Subject to updates
- 🎯 Part of onboarding
- 🛠️ Used in daily development

---

## Maintenance

### Review Schedule

- **Weekly:** Update active development docs
- **Monthly:** Review quick references and guidelines
- **Quarterly:** Archive completed plans, review index
- **Annual:** Major documentation reorganization if needed

### Who Maintains What

| Category | Maintainer | Review Frequency |
|----------|-----------|------------------|
| Type Safety docs | Development Team | Monthly |
| Testing guides | QA Team | Monthly |
| CI/CD docs | DevOps | Quarterly |
| Architecture | Tech Lead | Quarterly |
| Planning/Archive | Product Team | As needed |

---

## Finding Information

### Search Strategy

1. **Check Index** (this file) first
2. **Use Quick Links** for common tasks
3. **Search by role** for targeted docs
4. **Check archives** for historical context

### Still Can't Find It?

1. Search project with: `git grep "search term" docs/`
2. Check commit history: `git log --all --full-history docs/`
3. Ask team via Slack
4. Create GitHub issue if documentation is missing

---

## Contributing

### Adding New Documentation

1. Create file in appropriate directory
2. Follow naming standards
3. Add to this index
4. Update `docs/README.md` if major addition
5. Create PR with documentation changes

### Updating Existing Documentation

1. Update the document
2. Change "Last Updated" date
3. Update index if title/purpose changed
4. Note changes in commit message

### Archiving Documentation

1. Move file to appropriate `archive/` subdirectory
2. Update this index to reflect new location
3. Add archive date and reason
4. Keep entry in index for reference

---

## Related Resources

### External Documentation
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Playwright Documentation](https://playwright.dev/docs/intro)

### Internal Code
- Type helpers: `apps/web/src/lib/firebase/typeHelpers.ts`
- ESLint config: `.eslintrc.json`
- Pre-commit hooks: `.husky/pre-commit`
- CI/CD: `.github/workflows/ci.yml`
- Type check script: `scripts/check-type-safety.js`

---

**Index Version:** 1.0
**Last Updated:** 2025-11-03
**Maintained by:** Development Team
