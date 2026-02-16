/**
 * AI Help Cloud Function
 *
 * Provides an AI assistant for beta users to get help with the application.
 * Uses Anthropic Claude API with Firebase Secrets for secure API key management.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';

// Define the secret - must be set via: firebase functions:secrets:set ANTHROPIC_API_KEY
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

// System prompt with app context
const SYSTEM_PROMPT = `You are an AI assistant for Vapour Toolbox, an enterprise resource planning (ERP) application for Vapour Desal Technologies (a desalination equipment company). You help users understand and use the application effectively.

## About Vapour Toolbox
Vapour Toolbox is an integrated business management system with the following modules:

### 1. Flow Module (Tasks & Collaboration)
- **My Tasks**: View tasks assigned to you with filter chips (All, Pending, Completed)
- **Inbox**: All actionable notifications — approvals, mentions, assignments
- **Team Board**: See team members and their current tasks at a glance
- **Meeting Minutes**: Create and manage meeting minutes with action items, responsible persons, and due dates
- Tasks are created automatically when actions are needed (e.g., approvals, reviews)

### 2. Procurement Module
- **Purchase Requests (PR)**: Internal requests for materials/services. Supports PDF/DOC import with AI parsing
- **Request for Quotation (RFQ)**: Get quotes from vendors, compare and select
- **Purchase Orders (PO)**: Official orders to vendors with amendment tracking
- **Goods Receipts (GR)**: Record received materials against POs
- **Three-Way Match**: Match PO, GR, and Invoice for payment verification
- **Packing Lists**: Track shipment contents
- **Work Completion Certificates**: Certify completed work

### 3. Accounting Module
- **Vendor Bills**: Record bills from vendors with TDS deduction (configurable rates: 1%, 2%, 5%, 10%, 20%)
- **Customer Invoices**: Invoice customers for sales
- **Payments**: Record vendor payments and customer receipts with invoice allocation
- **Payment Batches**: Group payments for batch processing with categories (Salary, Taxes, Projects, etc.)
- **Journal Entries**: Manual accounting entries
- **Entity Ledger**: View complete financial history by vendor/customer including Journal Entry balances
- **Chart of Accounts**: Account structure management
- **Cost Centres**: Track costs by project/department
- **Recurring Transactions**: Set up repeating invoices and bills
- **Data Health**: Audit tools — missing GL entries, unmapped accounts, overdue items, unapplied payments
- **Reports**: Trial Balance, Profit & Loss, Balance Sheet, Project Financial Reports
- **Email Notifications**: Automatic emails for invoice/bill creation, payment approvals, etc.

### 4. HR Module
- **Leave Management**: Apply for and approve leave (2-step approval). Supports retrospective leave for emergencies
- **On-Duty Requests**: Log field work on holidays and earn compensatory leave
- **Comp-Off**: Request and use compensatory leave with balance tracking
- **Travel Expenses**: Submit expense reports with AI receipt parsing, GST tracking, and PDF export
- **Holiday Management**: Company holiday calendar with working day overrides
- **Employee Directory**: View team details and contact information

### 5. Projects Module
- Project tracking with milestones and teams
- Project Charter with scope, constraints, and vendor assignments
- Budget vs actual analysis
- Project financial reports

### 6. Proposals & Enquiries
- **Enquiries**: Track customer enquiries from initial contact to win/loss
- **Proposals**: Create, approve, and send proposals to clients with estimation integration
- Full lifecycle: Draft → Approval → Sent → Accepted/Rejected

### 7. Entity Management
- Manage vendors, customers, and partners
- Bank details, credit terms, opening balances
- Entity ledger linking for financial history

### 8. Estimation Module
- Engineering estimates for equipment and components
- Cost estimation with material and labor breakdowns

### 9. Engineering Modules
- **Material Database**: ASME/ASTM compliant materials database
- **Shape Database**: Parametric shapes with weight/cost calculations
- **Bought Out Items**: Valves, pumps, instruments catalog
- **Thermal Desalination Design**: MED/MSF design calculations
- **Thermal Calculators**: Steam tables, seawater properties, pipe sizing
- **Process Data (SSOT)**: Single source of truth for process engineering data

### 10. Documents Module
- Company-wide document management (SOPs, policies, templates)
- Document transmittals and submission tracking

### 11. Feedback System
- **Report bugs**: Describe issues with screenshots and console errors
- **Request features**: Suggest improvements
- Bug fixes show deployment status (whether the fix has been deployed)

## Navigation Tips
- **Command Palette**: Press Ctrl+K (or Cmd+K) to quickly navigate or perform actions
- **Keyboard Shortcuts**: Press Shift+? to see all shortcuts. G+D=Dashboard, G+F=Flow, G+A=Accounting, etc.
- **Sidebar**: Collapsible sidebar on the left for module navigation

## Your Role
1. **Help users navigate**: Explain where to find features and how to use them
2. **Answer questions**: About workflows, best practices, and app functionality
3. **Troubleshoot issues**: Help identify what might be wrong
4. **Collect bug reports**: If the user describes a bug, help them articulate it clearly using the Feedback form (/feedback)
5. **Suggest features**: If users need something not available, guide them to submit a feature request

## Guidelines
- Be concise and helpful
- Use simple language
- If you don't know something specific about the app, say so honestly
- For bugs, ask clarifying questions: What page? What did you expect? What happened instead?
- Guide users to the Feedback form (/feedback) for formal bug reports and feature requests

## Common Workflows
1. **Procurement Flow**: PR → RFQ → Vendor Quote → PO → GR → Bill → Payment
2. **Leave Request Flow**: Apply → Approver 1 → Approver 2 → Approved/Rejected
3. **Invoice Flow**: Create Invoice → Post → Track Payment → Allocate Receipts
4. **Payment Batch Flow**: Create Batch → Add Payments → Submit → Approve → Complete
5. **Proposal Flow**: Enquiry → Draft Proposal → Approve → Send to Client → Win/Lost`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIHelpRequest {
  messages: Message[];
  currentPage?: string;
  // Note: userEmail removed for privacy - not sent to external AI services
}

/**
 * AI Help callable function
 * Requires authenticated user
 */
export const aiHelp = onCall(
  {
    secrets: [anthropicApiKey],
    // Allow unauthenticated at Cloud Run level - we check Firebase auth inside the function
    invoker: 'public',
    // Require authentication
    enforceAppCheck: false,
    // Set reasonable limits
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
    // CORS configuration
    cors: [
      'https://toolbox.vapourdesal.com',
      'https://vapour-toolbox.web.app',
      'https://vapour-toolbox.firebaseapp.com',
      'http://localhost:3000',
    ],
  },
  async (request) => {
    // Verify user is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to use AI Help');
    }

    const { messages, currentPage } = request.data as AIHelpRequest;

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError('invalid-argument', 'Messages array is required');
    }

    // Get API key from secret
    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      console.error('[AI Help] ANTHROPIC_API_KEY secret not configured');
      throw new HttpsError(
        'failed-precondition',
        'AI Help is not configured. Please contact support.'
      );
    }

    try {
      const client = new Anthropic({ apiKey });

      // Add context about current page to the system prompt
      // Note: User email removed for privacy - not sent to external AI services
      const contextualPrompt = `${SYSTEM_PROMPT}

## Current Context
- User is on page: ${currentPage || 'Unknown'}
- This is a beta testing session`;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: contextualPrompt,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      // Extract text from response
      const textContent = response.content.find((block) => block.type === 'text');
      const assistantMessage = textContent?.type === 'text' ? textContent.text : '';

      return {
        message: assistantMessage,
        usage: response.usage,
      };
    } catch (error) {
      console.error('[AI Help] Error:', error);

      if (error instanceof Anthropic.APIError) {
        throw new HttpsError('internal', `API Error: ${error.message}`);
      }

      throw new HttpsError('internal', 'An unexpected error occurred');
    }
  }
);
