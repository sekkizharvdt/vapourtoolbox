import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// System prompt with app context
const SYSTEM_PROMPT = `You are an AI assistant for Vapour Toolbox, an enterprise resource planning (ERP) application for Vapour Desal (a desalination equipment company). You help beta users understand and use the application effectively.

## About Vapour Toolbox
Vapour Toolbox is an integrated business management system with the following modules:

### 1. Procurement Module
- **Purchase Requests (PR)**: Internal requests for materials/services
- **Request for Quotation (RFQ)**: Get quotes from vendors
- **Purchase Orders (PO)**: Official orders to vendors
- **Goods Receipts (GR)**: Record received materials
- **Three-Way Match**: Match PO, GR, and Invoice for payment

### 2. Accounting Module
- **Vendor Bills**: Record bills from vendors, auto-generated from GR
- **Customer Invoices**: Invoice customers for sales
- **Journal Entries**: Manual accounting entries
- **Entity Ledger**: View transaction history by vendor/customer
- **Chart of Accounts**: Account structure management
- **Cost Centres**: Track costs by project/department

### 3. HR Module
- **Leave Management**: Apply for and approve leave requests
- **On-Duty Requests**: Log field work and client visits
- **Comp-Off**: Request compensatory leave for extra work
- **Travel Expenses**: Submit and approve travel reimbursements
- **Holiday Management**: Company holiday calendar

### 4. Projects Module
- **Project tracking and cost management
- **Budget vs actual analysis

### 5. Proposals/Estimation
- **Create and track sales proposals
- **Equipment estimation

### 6. Flow Module
- **Task notifications and workflow management
- **Action required items dashboard

### 7. Documents Module
- **File storage and document management

## Your Role
1. **Help users navigate**: Explain where to find features and how to use them
2. **Answer questions**: About workflows, best practices, and app functionality
3. **Troubleshoot issues**: Help identify what might be wrong
4. **Collect bug reports**: If the user describes a bug, help them articulate it clearly
5. **Suggest features**: If users need something not available, note it as a feature request

## Guidelines
- Be concise and helpful
- Use simple language
- If you don't know something specific about the app, say so
- For bugs, ask clarifying questions: What page? What did you expect? What happened instead?
- Always be encouraging - this is a beta and feedback is valuable!

## Common Workflows to Know
1. **Procurement Flow**: PR → RFQ → Vendor Quote → PO → GR → Bill → Payment
2. **Leave Request Flow**: Apply → Manager Approval → (Senior Approval if needed) → Approved/Rejected
3. **Invoice Flow**: Create Invoice → Submit for Approval → Approved → Track Payment

Remember: You're helping beta testers who may not be fully familiar with all features. Be patient and thorough in your explanations.`;

export async function POST(request: NextRequest) {
  try {
    const { messages, currentPage, userEmail } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[AI Help] ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { error: 'AI Help is not configured. Please contact support.' },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    // Add context about current page to the system prompt
    const contextualPrompt = `${SYSTEM_PROMPT}

## Current Context
- User is on page: ${currentPage || 'Unknown'}
- User email: ${userEmail || 'Unknown'}
- This is a beta testing session`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: contextualPrompt,
      messages: messages.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    });

    // Extract text from response
    const textContent = response.content.find((block) => block.type === 'text');
    const assistantMessage = textContent?.type === 'text' ? textContent.text : '';

    return NextResponse.json({
      message: assistantMessage,
      usage: response.usage,
    });
  } catch (error) {
    console.error('[AI Help] Error:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `API Error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
