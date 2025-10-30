# VDT Unified Platform - Implementation Roadmap

**Version:** 1.0
**Date:** October 27, 2025
**Timeline:** 28 Weeks (7 Months) with 1 Developer

---

## Executive Summary

This roadmap outlines a **phased approach** to building the VDT Unified Platform from scratch, incorporating the best features from all 4 existing applications while establishing a solid foundation for future growth.

### Key Principles

1. **Build Foundation First** - Core modules before application modules
2. **Deliver Value Early** - Each phase produces working functionality
3. **Incremental Migration** - Run old apps in parallel during transition
4. **Preserve Best Features** - Keep what works well
5. **No Regression** - Match or exceed current functionality

---

## Timeline Overview

```
Phase 1: Foundation (Weeks 1-6)
├── Week 1-2: Setup & Core Infrastructure
├── Week 3-4: User Management Module
├── Week 5-6: Entity Management Module
└── Deliverable: User & Entity management working

Phase 2: Core Modules (Weeks 7-12)
├── Week 7-8: Project Management Module
├── Week 9-10: Company/Department Management
├── Week 11-12: Firebase Security & Cloud Functions
└── Deliverable: Complete core platform

Phase 3: Application Modules - Part 1 (Weeks 13-20)
├── Week 13-14: Time Tracking Module
├── Week 15-16: Leave & On-Duty Management
├── Week 17-18: Accounting Module Foundation
├── Week 19-20: Transaction & Ledger System
└── Deliverable: Time tracking + Basic accounting

Phase 4: Application Modules - Part 2 (Weeks 21-26)
├── Week 21-22: Procurement Module (PRs, RFQs)
├── Week 23-24: Purchase Orders & Approvals
├── Week 25-26: Estimation Module
└── Deliverable: Full procurement + Estimation

Phase 5: Polish & Migration (Weeks 27-28)
├── Week 27: Testing, Bug Fixes, Performance
├── Week 28: Data Migration & Deployment
└── Deliverable: Production-ready platform
```

---

## Phase 1: Foundation (Weeks 1-6)

### Week 1-2: Setup & Core Infrastructure

#### Objectives
- Set up monorepo structure
- Configure development environment
- Establish Firebase project
- Create CI/CD pipeline

#### Tasks

**Week 1: Project Setup**
- [ ] Create GitHub repository
- [ ] Initialize Turborepo monorepo
- [ ] Set up pnpm workspaces
- [ ] Configure ESLint, Prettier, TypeScript
- [ ] Set up Next.js 15 app (apps/web)
- [ ] Configure Material UI v7 theme
- [ ] Set up Firebase project (unified)
- [ ] Configure Firebase emulators

**Week 2: Infrastructure**
- [ ] Create shared packages structure
  - [ ] @vdt/validation
  - [ ] @vdt/firebase-client
  - [ ] @vdt/ui-components
  - [ ] @vdt/constants
- [ ] Set up React Query configuration
- [ ] Create base Firestore security rules
- [ ] Set up GitHub Actions CI/CD
- [ ] Create development documentation

**Deliverables:**
- ✅ Working monorepo with dev environment
- ✅ Firebase emulators running
- ✅ CI/CD pipeline configured
- ✅ Shared packages skeleton

---

### Week 3-4: User Management Module

#### Objectives
- Build unified user management system
- Implement Firebase Custom Claims
- Create role & permission system

#### Tasks

**Week 3: User Model & Services**
- [ ] Define User type (unified model)
- [ ] Create userService.ts
  - [ ] createUser()
  - [ ] updateUser()
  - [ ] getUserById()
  - [ ] getAllUsers()
  - [ ] deleteUser()
- [ ] Create roleService.ts
  - [ ] assignRoles()
  - [ ] removeRoles()
  - [ ] getRolePermissions()
- [ ] Create Cloud Function: onUserCreate
  - [ ] Set default custom claims
  - [ ] Create user profile
- [ ] Create Cloud Function: updateUserRole
  - [ ] Update custom claims
  - [ ] Validate permissions

**Week 4: User UI Components**
- [ ] Create useCurrentUser() hook
- [ ] Create useUsers() hook
- [ ] Create usePermissions() hook
- [ ] Build UserForm component
- [ ] Build UserList component
- [ ] Build RoleSelector component
- [ ] Create /users page
- [ ] Create /users/[id] page
- [ ] Add user search & filtering
- [ ] Implement user invitation flow

**Deliverables:**
- ✅ Complete User Management module
- ✅ Firebase Custom Claims working
- ✅ User CRUD operations
- ✅ Role & permission system
- ✅ User invite functionality

---

### Week 5-6: Entity Management Module

#### Objectives
- Build unified entity (vendor/customer) system
- Implement document management
- Create validation schemas

#### Tasks

**Week 5: Entity Model & Services**
- [ ] Define BusinessEntity type (unified model)
- [ ] Create validation schemas (Zod)
  - [ ] Base entity schema
  - [ ] India-specific schema
  - [ ] International schema
- [ ] Create entityService.ts
  - [ ] createEntity()
  - [ ] updateEntity()
  - [ ] getEntityById()
  - [ ] getAllEntities()
  - [ ] deleteEntity() (soft delete)
  - [ ] generateEntityCode() (ENT-001)
- [ ] Create entityDocumentService.ts
  - [ ] uploadDocument()
  - [ ] getDocuments()
  - [ ] deleteDocument()
- [ ] Create Cloud Function: generateEntityCode

**Week 6: Entity UI Components**
- [ ] Create useEntity() hook
- [ ] Create useEntities() hook
- [ ] Create useEntityDocuments() hook
- [ ] Build EntityForm component
  - [ ] Basic info tab
  - [ ] Tax identifiers tab
  - [ ] Banking details tab
  - [ ] Documents tab
- [ ] Build EntityList component
- [ ] Build EntityCard component
- [ ] Create /entities page
- [ ] Create /entities/[id] page
- [ ] Add entity search & filtering
- [ ] Implement multi-role selection

**Deliverables:**
- ✅ Complete Entity Management module
- ✅ Vendor/customer CRUD
- ✅ Document upload/management
- ✅ Multi-country tax support
- ✅ Auto-generated entity codes

---

## Phase 2: Core Modules (Weeks 7-12)

### Week 7-8: Project Management Module

#### Objectives
- Build unified project system
- Implement team management
- Create project-level permissions

#### Tasks

**Week 7: Project Model & Services**
- [ ] Define Project type (unified model)
- [ ] Create validation schemas
- [ ] Create projectService.ts
  - [ ] createProject()
  - [ ] updateProject()
  - [ ] getProjectById()
  - [ ] getAllProjects()
  - [ ] archiveProject()
- [ ] Create teamService.ts
  - [ ] addTeamMember()
  - [ ] removeTeamMember()
  - [ ] updateMemberRole()
  - [ ] getTeamMembers()
- [ ] Create activityService.ts
  - [ ] logActivity()
  - [ ] getProjectActivity()

**Week 8: Project UI Components**
- [ ] Create useProject() hook
- [ ] Create useProjects() hook
- [ ] Create useProjectTeam() hook
- [ ] Build ProjectForm component
- [ ] Build ProjectList component
- [ ] Build ProjectCard component
- [ ] Build TeamManager component
- [ ] Build ActivityLog component
- [ ] Create /projects page
- [ ] Create /projects/[id] page
- [ ] Add project filtering
- [ ] Implement project search

**Deliverables:**
- ✅ Complete Project Management module
- ✅ Project CRUD operations
- ✅ Team member management
- ✅ Project activity logging
- ✅ Multi-department support

---

### Week 9-10: Company/Department Management

#### Objectives
- Build company hierarchy system
- Implement department structure
- Support multi-company operations

#### Tasks

**Week 9: Company & Department Models**
- [ ] Define Company type
- [ ] Define Department type
- [ ] Create companyService.ts
- [ ] Create departmentService.ts
- [ ] Create Firestore security rules
- [ ] Create Cloud Functions for stats

**Week 10: UI Components**
- [ ] Create useCompany() hook
- [ ] Create useDepartments() hook
- [ ] Build CompanyForm component
- [ ] Build DepartmentTree component
- [ ] Create /settings/company page
- [ ] Create /settings/departments page
- [ ] Add department hierarchy visualization

**Deliverables:**
- ✅ Company management
- ✅ Department hierarchy
- ✅ Multi-company support foundation

---

### Week 11-12: Firebase Security & Cloud Functions

#### Objectives
- Implement comprehensive security rules
- Create all necessary Cloud Functions
- Test permission system end-to-end

#### Tasks

**Week 11: Security Rules**
- [ ] Write complete firestore.rules
  - [ ] Core module rules
  - [ ] Application module rules
  - [ ] Custom Claims integration
- [ ] Create security tests
- [ ] Test all permission scenarios
- [ ] Document security model

**Week 12: Cloud Functions**
- [ ] Auth triggers
  - [ ] onCreate: Set custom claims
  - [ ] onDelete: Cleanup
- [ ] User management functions
  - [ ] updateUserRole
  - [ ] inviteUser
- [ ] Entity functions
  - [ ] generateEntityCode
- [ ] Project functions
  - [ ] calculateProjectStats
- [ ] Audit functions
  - [ ] logUserActivity
- [ ] Deploy and test all functions

**Deliverables:**
- ✅ Complete security rules
- ✅ All Cloud Functions deployed
- ✅ Permission system tested
- ✅ Audit logging working

---

## Phase 3: Application Modules - Part 1 (Weeks 13-20)

### Week 13-14: Time Tracking Module

#### Objectives
- Build task management system
- Implement timer functionality
- Create task acceptance workflow

#### Tasks

**Week 13: Task Model & Services**
- [ ] Define Task type
- [ ] Define TimeEntry type
- [ ] Create validation schemas
- [ ] Create taskService.ts
  - [ ] createTask()
  - [ ] acceptTask()
  - [ ] declineTask()
  - [ ] updateTaskStatus()
  - [ ] completeTask()
  - [ ] deleteTask() (soft delete with reason)
- [ ] Create timeService.ts
  - [ ] startTimer()
  - [ ] pauseTimer()
  - [ ] stopTimer()
  - [ ] createManualEntry()
  - [ ] getTimeEntries()

**Week 14: Time Tracking UI**
- [ ] Create useTasks() hook
- [ ] Create useTimer() hook
- [ ] Build Timer component (main dashboard)
- [ ] Build TaskList component
- [ ] Build TaskForm component
- [ ] Build TaskAcceptanceQueue component
- [ ] Create /time page (timer dashboard)
- [ ] Create /time/tasks page
- [ ] Create /time/entries page
- [ ] Add task filtering by work area

**Deliverables:**
- ✅ Task management system
- ✅ Timer functionality
- ✅ Task acceptance workflow
- ✅ Time entry tracking

---

### Week 15-16: Leave & On-Duty Management

#### Objectives
- Implement leave application system
- Build on-duty tracking
- Create cross-approval workflow

#### Tasks

**Week 15: Leave & On-Duty Models**
- [ ] Define LeaveApplication type
- [ ] Define LeaveBalance type
- [ ] Define OnDutyRecord type
- [ ] Create leaveService.ts
  - [ ] applyLeave()
  - [ ] approveLeave()
  - [ ] rejectLeave()
  - [ ] getLeaveBalance()
  - [ ] updateLeaveBalance()
- [ ] Create onDutyService.ts
  - [ ] submitOnDuty()
  - [ ] approveOnDuty() (auto-create time entry!)
  - [ ] rejectOnDuty()
- [ ] Create Cloud Functions
  - [ ] onLeaveApproval: Update balance
  - [ ] onOnDutyApproval: Create time entry

**Week 16: Leave & On-Duty UI**
- [ ] Create useLeaves() hook
- [ ] Create useLeaveBalance() hook
- [ ] Create useOnDuty() hook
- [ ] Build LeaveForm component
- [ ] Build LeaveList component
- [ ] Build LeaveBalanceCard component
- [ ] Build OnDutyForm component
- [ ] Build OnDutyList component
- [ ] Build ApprovalQueue component
- [ ] Create /time/leaves page
- [ ] Create /time/on-duty page
- [ ] Create /time/approvals page (Director/HR)

**Deliverables:**
- ✅ Leave management system
- ✅ Leave balance tracking
- ✅ On-duty tracking
- ✅ Auto time-entry generation
- ✅ Cross-approval workflow

---

### Week 17-18: Accounting Module Foundation

#### Objectives
- Build chart of accounts system
- Implement account hierarchy
- Create currency management

#### Tasks

**Week 17: Account Model & Services**
- [ ] Define Account type
- [ ] Define AccountTree type
- [ ] Define Currency type
- [ ] Create accountService.ts
  - [ ] createAccount()
  - [ ] updateAccount()
  - [ ] getAccounts()
  - [ ] getAccountTree()
  - [ ] deleteAccount()
- [ ] Create currencyService.ts
  - [ ] addCurrency()
  - [ ] updateExchangeRate()
  - [ ] getCurrencies()

**Week 18: Accounting UI - Part 1**
- [ ] Create useAccounts() hook
- [ ] Create useCurrencies() hook
- [ ] Build AccountForm component
- [ ] Build AccountTree component
- [ ] Build CurrencyManager component
- [ ] Create /accounting page
- [ ] Create /accounting/accounts page
- [ ] Create /accounting/settings page

**Deliverables:**
- ✅ Chart of accounts
- ✅ Account hierarchy
- ✅ Currency management

---

### Week 19-20: Transaction & Ledger System

#### Objectives
- Build double-entry transaction system
- Implement GST/TDS support
- Create approval workflow

#### Tasks

**Week 19: Transaction Model & Services**
- [ ] Define Transaction type
- [ ] Define LedgerEntry type
- [ ] Define GSTDetails type
- [ ] Create validation schemas
  - [ ] Double-entry validation (debits = credits)
  - [ ] Ledger entry validation
- [ ] Create transactionService.ts
  - [ ] createTransaction()
  - [ ] updateTransaction()
  - [ ] approveTransaction()
  - [ ] postTransaction()
  - [ ] getTransactions()
  - [ ] getProjectTransactions()

**Week 20: Transaction UI**
- [ ] Create useTransactions() hook
- [ ] Build JournalEntryForm component
- [ ] Build PaymentVoucherForm component
- [ ] Build ReceiptVoucherForm component
- [ ] Build TransactionList component
- [ ] Build LedgerView component
- [ ] Create /accounting/transactions page
- [ ] Create /accounting/transactions/new page
- [ ] Add transaction filtering

**Deliverables:**
- ✅ Transaction system
- ✅ Double-entry accounting
- ✅ GST/TDS support
- ✅ Approval workflow

---

## Phase 4: Application Modules - Part 2 (Weeks 21-26)

### Week 21-22: Procurement Module (PRs & RFQs)

#### Objectives
- Build purchase request system
- Implement RFQ workflow
- Create approval chain

#### Tasks

**Week 21: Requirement & RFQ Models**
- [ ] Define Requirement type
- [ ] Define RFQ type
- [ ] Create validation schemas
- [ ] Create requirementService.ts
  - [ ] createRequirement()
  - [ ] submitForApproval()
  - [ ] approve/reject by Engineering Head
  - [ ] approve/reject by Director
  - [ ] convertToRFQ()
  - [ ] bulkUploadFromExcel()
- [ ] Create rfqService.ts
  - [ ] createRFQ()
  - [ ] issueRFQ()
  - [ ] getRFQs()

**Week 22: Procurement UI - Part 1**
- [ ] Create useRequirements() hook
- [ ] Create useRFQs() hook
- [ ] Build RequirementForm component
- [ ] Build BulkUploadPanel component
- [ ] Build RequirementList component
- [ ] Build RFQForm component
- [ ] Build RFQList component
- [ ] Create /procurement page
- [ ] Create /procurement/requirements page
- [ ] Create /procurement/rfqs page

**Deliverables:**
- ✅ Purchase request system
- ✅ Bulk Excel upload
- ✅ RFQ creation
- ✅ Multi-level approval

---

### Week 23-24: Purchase Orders & Approvals

#### Objectives
- Build PO creation system
- Implement offer comparison
- Create approval workflow

#### Tasks

**Week 23: PO & Offer Models**
- [ ] Define Offer type
- [ ] Define PurchaseOrder type
- [ ] Create offerService.ts
  - [ ] uploadOffer()
  - [ ] parseOffer() (if Document AI)
  - [ ] validateOffer()
- [ ] Create poService.ts
  - [ ] createPO()
  - [ ] submitForApproval()
  - [ ] approvePO()
  - [ ] issuePO()
  - [ ] generatePDF()

**Week 24: PO UI**
- [ ] Create useOffers() hook
- [ ] Create usePOs() hook
- [ ] Build OfferUpload component
- [ ] Build PriceComparison component
- [ ] Build POForm component
- [ ] Build POList component
- [ ] Build POPreview component
- [ ] Create /procurement/offers page
- [ ] Create /procurement/pos page
- [ ] Create /procurement/pos/[id] page

**Deliverables:**
- ✅ Offer management
- ✅ Price comparison
- ✅ PO generation
- ✅ Approval workflow
- ✅ PDF export

---

### Week 25-26: Estimation Module

#### Objectives
- Build equipment estimation system
- Implement weight calculations
- Create component library

#### Tasks

**Week 25: Estimation Models**
- [ ] Define Equipment type
- [ ] Define Component type
- [ ] Define Estimate type
- [ ] Create estimateService.ts
  - [ ] createEstimate()
  - [ ] addEquipment()
  - [ ] calculateWeights()
  - [ ] calculateCosts()
- [ ] Create equipmentService.ts
- [ ] Create componentService.ts
- [ ] Create calculationService.ts

**Week 26: Estimation UI**
- [ ] Create useEstimate() hook
- [ ] Create useEquipment() hook
- [ ] Build EstimateEditor component
- [ ] Build EquipmentList component
- [ ] Build ComponentEditor component
- [ ] Build WeightCalculator component
- [ ] Build CostCalculator component
- [ ] Create /estimation page
- [ ] Create /estimation/[id] page
- [ ] Add component library

**Deliverables:**
- ✅ Estimation module
- ✅ Equipment management
- ✅ Weight/cost calculations
- ✅ Component library

---

## Phase 5: Polish & Migration (Weeks 27-28)

### Week 27: Testing, Bug Fixes, Performance

#### Objectives
- Comprehensive testing
- Bug fixes
- Performance optimization
- Documentation

#### Tasks

- [ ] End-to-end testing
  - [ ] User workflows
  - [ ] Permission scenarios
  - [ ] Module integrations
- [ ] Performance optimization
  - [ ] Bundle size analysis
  - [ ] Code splitting
  - [ ] Image optimization
  - [ ] Database query optimization
- [ ] Bug fixes
  - [ ] Fix all critical bugs
  - [ ] Fix high-priority bugs
  - [ ] Address UI/UX issues
- [ ] Documentation
  - [ ] User guide
  - [ ] Admin guide
  - [ ] Developer docs
  - [ ] API documentation

**Deliverables:**
- ✅ Tested system
- ✅ Optimized performance
- ✅ Complete documentation

---

### Week 28: Data Migration & Deployment

#### Objectives
- Migrate data from old apps
- Deploy to production
- Train users

#### Tasks

**Data Migration:**
- [ ] Export data from old Firebase projects
  - [ ] Users (de-duplicate, merge roles)
  - [ ] Entities (already unified)
  - [ ] Projects (merge different structures)
  - [ ] Transactions
  - [ ] Tasks & time entries
  - [ ] Estimates
- [ ] Transform data to unified schemas
- [ ] Import to new Firebase project
- [ ] Verify data integrity
- [ ] Test with migrated data

**Deployment:**
- [ ] Deploy to staging environment
- [ ] Final testing on staging
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Set up error tracking (Sentry)
- [ ] Set up analytics

**User Training:**
- [ ] Create training videos
- [ ] Conduct user training sessions
- [ ] Provide user support
- [ ] Gather feedback

**Deliverables:**
- ✅ Data migrated
- ✅ Production deployed
- ✅ Users trained
- ✅ Platform live!

---

## Migration Strategy

### Parallel Operation Period

Run old and new systems in parallel for 2-4 weeks:

```
Week 28: Deploy unified platform
Week 29-30: Parallel operation
  - New platform for daily work
  - Old platforms read-only (reference)
  - Monitor issues, gather feedback

Week 31-32: Full transition
  - Deprecate old platforms
  - Archive old Firebase projects
  - Full support on new platform
```

### Data Synchronization

During parallel operation:
- ✅ New platform is source of truth
- ✅ Old platforms available for reference only
- ❌ Do NOT write to old platforms
- ✅ Daily backups of new platform

---

## Resource Requirements

### Development Team

**Minimum (Budget Option):**
- 1 Full-stack Developer (you!)
- Timeline: 28 weeks (7 months)

**Recommended (Faster):**
- 1 Senior Full-stack Developer (you)
- 1 Junior Developer (for UI components, testing)
- Timeline: 16-20 weeks (4-5 months)

**Optimal (Fastest):**
- 1 Senior Full-stack Developer (backend, architecture)
- 1 Frontend Developer (UI components, forms)
- 1 QA Engineer (testing, documentation)
- Timeline: 12-14 weeks (3-3.5 months)

### Infrastructure Costs

**Firebase (Production):**
- Blaze plan (pay-as-you-go)
- Estimated: $50-150/month for 50 users
  - Firestore: $30-70/month
  - Storage: $10-30/month
  - Functions: $10-30/month
  - Hosting: $5-20/month

**Development Tools:**
- GitHub (free for private repos)
- Figma (free tier)
- Sentry ($0-26/month)
- Total: ~$0-50/month

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|------------|
| **Data loss during migration** | Multiple backups, test migrations, staged rollout |
| **Performance issues** | Load testing, Firebase emulator testing, monitoring |
| **Security vulnerabilities** | Comprehensive security rules, penetration testing |
| **Integration failures** | Extensive integration testing, rollback plan |

### Business Risks

| Risk | Mitigation |
|------|------------|
| **User resistance** | Training, gradual rollout, gather feedback early |
| **Feature parity** | Detailed feature checklist, user acceptance testing |
| **Timeline delays** | Buffer time, prioritize critical features, parallel work |
| **Budget overrun** | Clear scope, regular reviews, Firebase cost monitoring |

---

## Success Criteria

### Phase 1 Success Metrics
- ✅ User management working
- ✅ Entity management working
- ✅ Firebase Custom Claims implemented
- ✅ Security rules tested

### Phase 2 Success Metrics
- ✅ Project management working
- ✅ All core modules integrated
- ✅ Cloud Functions deployed
- ✅ Permission system validated

### Phase 3 Success Metrics
- ✅ Time tracking functional
- ✅ Leave management working
- ✅ Basic accounting operational
- ✅ Users can track time daily

### Phase 4 Success Metrics
- ✅ Procurement workflow complete
- ✅ Estimation module working
- ✅ All current features replicated
- ✅ No functionality regression

### Phase 5 Success Metrics
- ✅ Data migration successful
- ✅ Production deployment stable
- ✅ Users trained and onboarded
- ✅ Old apps deprecated

---

## Post-Launch Roadmap

### Month 1-2 Post-Launch
- Monitor performance and errors
- Gather user feedback
- Fix bugs quickly
- Optimize based on usage patterns

### Month 3-6 Post-Launch
- Advanced features
  - Mobile responsive improvements
  - PWA capabilities
  - Offline support
  - Advanced reporting
- Module enhancements based on user feedback
- Performance tuning

### Month 6-12 Post-Launch
- Multi-tenancy (if commercializing)
- API for third-party integrations
- Mobile apps (React Native)
- Advanced analytics
- AI/ML features

---

## Summary

### Total Timeline
- **28 weeks (7 months)** with 1 developer
- **16-20 weeks (4-5 months)** with 2 developers
- **12-14 weeks (3-3.5 months)** with 3 developers

### Estimated Cost
- **Development:** $0 (in-house) or $50-100K (contractors)
- **Infrastructure:** $50-150/month
- **Tools:** $0-50/month
- **Total first year:** ~$600-2,000 + development

### Key Benefits
1. ✅ Single unified platform
2. ✅ No data fragmentation
3. ✅ Consistent user experience
4. ✅ Easier to maintain
5. ✅ Foundation for growth
6. ✅ Better security
7. ✅ Lower costs long-term

---

**Status:** Implementation Roadmap Complete
**Ready to:** Begin Development!
