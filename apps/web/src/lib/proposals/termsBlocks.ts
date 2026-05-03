/**
 * Default Terms & Conditions clauses for new proposals.
 *
 * Each clause is seeded onto a new proposal as a `ProposalTermsBlock`. The
 * Terms tab renders them as editable cards — the user can toggle each one
 * in/out for the deal, override the body text, reorder, and add bespoke
 * clauses (key='CUSTOM').
 *
 * Bodies are deliberately Indian-engineering-contract-flavoured and
 * derived from the firm's reference proposal P13-24. Edit here to evolve
 * the canonical template; do NOT edit clause bodies in individual
 * components or PDFs.
 */

import type { ProposalTermsBlock, ProposalTermsBlockKey } from '@vapour/types';

interface SeedClause {
  key: ProposalTermsBlockKey;
  title: string;
  body: string;
  /** Whether the clause is included by default on a new proposal. */
  defaultIncluded: boolean;
}

export const DEFAULT_TERMS_CLAUSES: SeedClause[] = [
  {
    key: 'PRICES_BINDING',
    title: 'Prices',
    body: 'All terms and conditions stated in this offer, unless expressly specified as waived and agreed by Vapour Desal Technologies in writing in the contract or purchase order, shall be applicable to the contract or the Purchase Order and shall be binding on both the parties.',
    defaultIncluded: true,
  },
  {
    key: 'RIGHTS_AND_OBLIGATIONS',
    title: 'Rights and Obligations',
    body: 'Service Provider: Service provider reserves the right to engage and/or hire assistants to act as its service providers/sub-contractors to render the services under this contract with due consent from the Purchaser wherever applicable.\n\nPurchaser: Purchaser shall avoid any delay of payment and release the payment according to the pre-decided milestones set out under the Contract.',
    defaultIncluded: true,
  },
  {
    key: 'LIMITATION_OF_LIABILITY',
    title: 'Limitation of Liability',
    body: 'Except for indemnity obligations set forth in the contract/PO, neither party shall be liable to the other for any indirect, incidental, consequential, special, exemplary or punitive damages, loss of business profits, loss of use or loss of goodwill.\n\nEither party’s aggregate monetary liability towards all damages arising out of or in relation to the contract/PO shall be limited to the total price paid by the Purchaser under the contract/PO.',
    defaultIncluded: true,
  },
  {
    key: 'TERMINATION',
    title: 'Termination',
    body: 'Both parties shall be entitled to terminate the contract in whole or in parts immediately if:\n\na. The other party is in material breach of the contract and fails to remedy such breach or failure after sixty (60) days of receipt of notice of breach from the non-defaulting party; or\n\nb. The other party’s filing or institution of bankruptcy, reorganization, liquidation, or receivership proceedings, or upon an assignment of a substantial portion of the assets for the benefit of creditors by the other Party; and/or makes any voluntary arrangement with its creditors or becomes subject to an administration order.\n\nIn the event of suspension/termination, Purchaser shall compensate Seller for any payments accrued prior to effective date of suspension/termination, including but not limited to, payments for works in progress.',
    defaultIncluded: true,
  },
  {
    key: 'INDEMNITY',
    title: 'Indemnity',
    body: 'Either Party shall indemnify and hold harmless the other party, its affiliates, employees, officers, directors, representatives and agents against any and all third-party claims, losses, damages, liabilities, costs and expenses arising from: (a) any negligent act or omission, wilful misconduct, or misrepresentation of the indemnifying party; and/or (b) any breach of confidentiality or infringement of third party intellectual property rights by the indemnifying party.',
    defaultIncluded: true,
  },
  {
    key: 'CONFIDENTIALITY',
    title: 'Confidentiality',
    body: 'Each party shall keep confidential all non-public information disclosed by the other party in connection with this contract, including drawings, specifications, process data, pricing, and commercial terms. Confidential information shall be used solely for the purpose of performing this contract and shall not be disclosed to any third party without the prior written consent of the disclosing party. This obligation shall survive for a period of three (3) years from the date of completion or termination of the contract.',
    defaultIncluded: true,
  },
  {
    key: 'INTELLECTUAL_PROPERTY',
    title: 'Intellectual Property',
    body: 'All pre-existing intellectual property of either party shall remain the exclusive property of that party. Drawings, designs, calculations, process know-how and other technical documents prepared by Vapour Desal Technologies in connection with this contract shall remain the property of Vapour Desal Technologies; the Purchaser is granted a non-exclusive, non-transferable licence to use such documents solely for the operation and maintenance of the supplied plant or equipment.',
    defaultIncluded: true,
  },
  {
    key: 'CHANGE_IN_WORK_ASSIGNMENT',
    title: 'Change in Work Assignment',
    body: 'Any resulting price escalation from a change in scope of works shall be mutually discussed and agreed by the parties.',
    defaultIncluded: true,
  },
  {
    key: 'FORCE_MAJEURE',
    title: 'Force Majeure',
    body: 'Neither party will be liable for failure or delay to perform obligations under this Agreement/PO, which have become practicably impossible because of circumstances beyond the reasonable control of the applicable party. Such circumstances include without limitation natural disasters or acts of God; acts of terrorism; labour disputes or stoppages; war; government acts or orders; epidemics, pandemics, or outbreak of communicable disease; quarantines; national or regional emergencies; or any other cause, whether similar in kind to the foregoing or otherwise, beyond the party’s reasonable control.\n\nWritten notice of a party’s failure or delay in performance due to force majeure must be given to the other party at the earliest following the force majeure event commencing, which notice shall describe the force majeure event and the actions taken to minimize the impact thereof. All delivery dates under this Agreement affected by force majeure shall be tolled for the duration of such force majeure. The parties hereby agree, when feasible, not to cancel but to reschedule the pertinent obligations and deliverables for mutually agreed dates as soon as practicable after the force majeure condition ceases to exist.',
    defaultIncluded: true,
  },
  {
    key: 'NOTICE_AND_AMENDMENTS',
    title: 'Notice and Amendments',
    body: 'If the Purchaser makes changes at any time in drawings or specifications of the service / goods covered by this Purchase Order, price escalation and schedule extension shall be applicable, and no changes/amendment shall be entertained unless and until expressly agreed by Seller. No modification or amendment of any of the terms of this contract shall be valid and binding unless signed by or on behalf of both parties hereto. This Agreement shall not be amended or cancelled except by written instrument signed by both parties. Any notice or other communication in connection with this Agreement shall be in writing and hereunder deemed effective when delivered by mail, courier or fax transmission to the Seller and Purchaser’s address contained in this Agreement.',
    defaultIncluded: true,
  },
  {
    key: 'NO_PARTNERSHIP',
    title: 'No Partnership',
    body: 'This agreement does not create a partnership relationship between the parties; neither party shall have authority to commit the other to any action or enter into contracts on behalf of the other.',
    defaultIncluded: true,
  },
  {
    key: 'GOVERNING_LAW_AND_DISPUTE_RESOLUTION',
    title: 'Governing Law and Dispute Resolution',
    body: 'This contract shall be governed by and construed in accordance with the laws of India. Any dispute, controversy or claim arising out of or in relation to this contract, including the validity, invalidity, breach or termination thereof, shall be resolved by arbitration in accordance with the Arbitration and Conciliation Act, 1996. The arbitration shall be conducted by a sole arbitrator mutually appointed by the parties; the seat of arbitration shall be Trichy (Tiruchirappalli), Tamil Nadu, India; and the language of arbitration shall be English. Subject to the arbitration clause, the courts at Trichy shall have exclusive jurisdiction.',
    defaultIncluded: true,
  },
  // Off by default — only enable when the deal calls for them.
  {
    key: 'WARRANTY',
    title: 'Warranty',
    body: 'The warranty period shall be twelve (12) months from the date of commissioning or eighteen (18) months from the date of supply, whichever is earlier. During the warranty period, Vapour Desal Technologies shall repair or replace, free of cost, any defects arising from faulty design, materials, or workmanship attributable to the Seller. The warranty does not cover wear-and-tear items, consumables, or damage caused by misuse, improper operation, or operating conditions outside the design envelope.',
    defaultIncluded: false,
  },
  {
    key: 'LIQUIDATED_DAMAGES',
    title: 'Liquidated Damages',
    body: 'In the event of delay in delivery / completion attributable solely to the Seller and not on account of any cause beyond the Seller’s reasonable control, liquidated damages at the rate of 0.5% (half of one percent) of the undelivered portion of the contract value per completed week of delay shall apply, capped at a maximum of 5% (five percent) of the undelivered portion of the contract value. Liquidated damages shall be the sole and exclusive remedy of the Purchaser for delays in delivery.',
    defaultIncluded: false,
  },
];

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Build the seeded `termsBlocks` array for a new proposal. Order matches
 * the canonical sequence above; included flags follow defaultIncluded.
 */
export function buildDefaultTermsBlocks(): ProposalTermsBlock[] {
  return DEFAULT_TERMS_CLAUSES.map((c, i) => ({
    id: newId(),
    key: c.key,
    title: c.title,
    body: c.body,
    included: c.defaultIncluded,
    order: i,
  }));
}

/** Build a single user-added clause. */
export function newCustomTermsBlock(order: number): ProposalTermsBlock {
  return {
    id: newId(),
    key: 'CUSTOM',
    title: 'Custom clause',
    body: '',
    included: true,
    order,
  };
}
