/**
 * Proposal PDF Document Template
 *
 * Customer-facing proposal PDF. Uses the shared report components so the
 * format matches RFQ / PO / other modules (logo, header, theme).
 *
 * IMPORTANT: This document is what the client sees. It MUST NOT expose
 * internal markup percentages (overhead / contingency / profit) — those
 * are negotiation-sensitive and live only on the Costing tab. The
 * Commercial Summary collapses the cost basis + markups into a single
 * priced line and shows lump-sum lines, subtotal, tax, total.
 */

import React from 'react';
import { Document, Image, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Proposal, UnifiedScopeItem } from '@vapour/types';
import { MILESTONE_TAX_TYPE_LABELS } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';
import { buildDefaultTermsBlocks } from '@/lib/proposals/termsBlocks';
import { computeCommercialSummary } from '@/lib/proposals/commercialSummary';
import {
  ReportPage,
  ReportHeader,
  ReportSection,
  ReportTable,
  Watermark,
  ReportFooter,
  reportStyles as s,
  REPORT_THEME,
} from '@/lib/pdf/reportComponents';

/**
 * PDF-safe currency formatter. The default react-pdf font (Helvetica)
 * lacks the Indian Rupee glyph (U+20B9), so Intl.NumberFormat output for
 * INR comes through as a superscript ¹ on the rendered page. Workaround:
 * format INR with an "Rs." prefix and the local en-IN digit grouping.
 * Other currencies render correctly via Intl since their symbols
 * ($, €, £, S$, AED) all live in Helvetica.
 */
function formatPdfMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount);
  if (currency === 'INR') {
    return `Rs. ${rounded.toLocaleString('en-IN')}`;
  }
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return `${currency} ${rounded.toLocaleString('en-IN')}`;
  }
}

export interface ProposalPDFCompany {
  name: string;
  address?: string;
  gstin?: string;
  email?: string;
  phone?: string;
  website?: string;
  /** Named individual ("Contact Person" row on the cover page). */
  primaryContactName?: string;
  primaryContactRole?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;
}

/**
 * Live client info read from the entity record at PDF render time.
 * Overrides the denormalised proposal.clientAddress / clientContactPerson
 * so a renamed entity or a fixed address propagates to the PDF without
 * needing a backfill on every proposal.
 */
export interface ProposalPDFClient {
  address?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
}

const local = StyleSheet.create({
  companyMeta: {
    marginTop: -8,
    marginBottom: 8,
  },
  companyMetaText: {
    fontSize: 8,
    color: REPORT_THEME.textSecondary,
    textAlign: 'center',
  },
  proposalTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 6,
    marginBottom: 10,
    textAlign: 'center',
  },
  // Cover page —————————————————————————————————————————————
  coverDocBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  coverDocBandRight: {
    fontSize: 9,
    textAlign: 'right',
    color: REPORT_THEME.textSecondary,
    lineHeight: 1.3,
  },
  coverTitleBlock: {
    marginTop: 60,
    marginBottom: 30,
    alignItems: 'center',
  },
  coverTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 1.4,
    marginBottom: 10,
  },
  coverFor: {
    fontSize: 10,
    color: REPORT_THEME.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  coverClientName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  coverMetaBlock: {
    marginTop: 30,
    marginBottom: 30,
    border: `1pt solid ${REPORT_THEME.border}`,
  },
  coverMetaRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${REPORT_THEME.border}`,
  },
  coverMetaRowLast: {
    flexDirection: 'row',
  },
  coverMetaLabel: {
    width: '32%',
    padding: 6,
    fontSize: 9,
    fontWeight: 'bold',
    backgroundColor: REPORT_THEME.tableHeaderBg,
    borderRight: `0.5pt solid ${REPORT_THEME.border}`,
  },
  coverMetaValue: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    lineHeight: 1.4,
  },
  coverAnnexuresTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 6,
  },
  coverAnnexureItem: {
    fontSize: 9,
    marginLeft: 10,
    marginBottom: 2,
  },
  coverLogo: {
    width: 80,
    height: 40,
    objectFit: 'contain',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
  },
  value: {
    width: '70%',
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
    color: REPORT_THEME.text,
  },
  costSummary: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f9f9f9',
    border: `1pt solid ${REPORT_THEME.border}`,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  costLabel: {
    fontSize: 10,
  },
  costValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  totalCost: {
    fontSize: 14,
    fontWeight: 'bold',
    color: REPORT_THEME.primary,
  },
  bulletList: {
    marginLeft: 15,
    marginTop: 5,
  },
  bulletItem: {
    marginBottom: 4,
  },
});

interface ProposalPDFDocumentProps {
  proposal: Proposal;
  includeTerms: boolean;
  includeDeliverySchedule: boolean;
  watermark?: string;
  company?: ProposalPDFCompany;
  logoDataUri?: string;
  clientProfile?: ProposalPDFClient;
}

const DEFAULT_COMPANY: ProposalPDFCompany = {
  name: 'Vapour Desal Technologies Private Limited',
};

export const ProposalPDFDocument = ({
  proposal,
  includeTerms,
  includeDeliverySchedule,
  watermark,
  company = DEFAULT_COMPANY,
  logoDataUri,
  clientProfile,
}: ProposalPDFDocumentProps) => {
  // Prefer the live entity address over the proposal's denormalised
  // clientAddress so old proposals with a corrupted "null, null" string
  // still render cleanly. Same for clientContactPerson.
  const clientAddress = clientProfile?.address || proposal.clientAddress;
  const clientContactPerson = clientProfile?.contactPerson || proposal.clientContactPerson;
  const clientEmail = clientProfile?.email || proposal.clientEmail;
  const hasUnifiedScopeMatrix = Boolean(
    proposal.unifiedScopeMatrix &&
    proposal.unifiedScopeMatrix.categories.some((c) => c.items.length > 0)
  );

  // Stage 2.5: client-facing pricing. Only clientPricing renders on the
  // customer PDF; the legacy pricingConfig markup-breakdown is no longer
  // shown to clients (internal-only data).
  const hasClientPricing = Boolean(proposal.clientPricing);

  // Single source of truth for the customer rollup — same helper that
  // the Pricing editor uses, so what the user sees on screen and what
  // the customer sees in the PDF are guaranteed to agree.
  const summary = computeCommercialSummary(proposal);
  const quoteCurrency = summary?.currency ?? 'INR';
  const isForeignQuote = summary?.isForeignQuote ?? false;

  const unifiedServices: UnifiedScopeItem[] = hasUnifiedScopeMatrix
    ? proposal.unifiedScopeMatrix!.categories.flatMap((c) =>
        c.items.filter((i) => i.included && i.classification === 'SERVICE')
      )
    : [];
  const unifiedSupply: UnifiedScopeItem[] = hasUnifiedScopeMatrix
    ? proposal.unifiedScopeMatrix!.categories.flatMap((c) =>
        c.items.filter((i) => i.included && i.classification === 'SUPPLY')
      )
    : [];
  const unifiedExclusions: UnifiedScopeItem[] = hasUnifiedScopeMatrix
    ? proposal.unifiedScopeMatrix!.categories.flatMap((c) => c.items.filter((i) => !i.included))
    : [];

  // Cover-page metadata — assembled once so the layout stays declarative.
  const docNumber = `${proposal.proposalNumber}/R${proposal.revision}`;
  // Date of Submission — only stamped once the proposal has actually
  // been sent to the client (status SUBMITTED or later). Pre-submission
  // statuses read as "Not yet submitted" so an internally-shared draft
  // PDF doesn't claim a submission date that isn't real. We gate on
  // status AND submittedAt so any stale submittedAt left over from
  // older code paths is ignored until the formal send-to-client step.
  const POST_SUBMIT_STATUSES = ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'LOST'] as const;
  const isPostSubmit = POST_SUBMIT_STATUSES.includes(
    proposal.status as (typeof POST_SUBMIT_STATUSES)[number]
  );
  const submissionDate =
    isPostSubmit && proposal.submittedAt ? formatDate(proposal.submittedAt) : 'Not yet submitted';
  const contactPersonText = company.primaryContactName
    ? `${company.primaryContactName}${
        company.primaryContactRole ? ', ' + company.primaryContactRole : ''
      }${company.name ? ', ' + company.name : ''}` +
      (company.primaryContactPhone ? `\nPhone: ${company.primaryContactPhone}` : '') +
      (company.primaryContactEmail ? `\nEmail: ${company.primaryContactEmail}` : '')
    : company.name +
      (company.phone ? `\nPhone: ${company.phone}` : '') +
      (company.email ? `\nEmail: ${company.email}` : '');
  const companyDetailsText =
    company.name +
    (company.address ? `\n${company.address}` : '') +
    (company.email ? `\nEmail: ${company.email}` : '') +
    (company.phone ? `\nPhone: ${company.phone}` : '');
  // Annexures listed on the cover. Each attachment's `description`
  // (set at upload time on the Attachments card) is the human-readable
  // label — e.g. "Process Flow Diagram", "Price Breakup". When the
  // description is blank, we fall back to the filename.
  const annexures = (proposal.attachments ?? []).filter((a) => a.fileName);
  const annexureLabel = (a: { description?: string; fileName: string }): string =>
    a.description?.trim() ? a.description.trim() : a.fileName;

  return (
    <Document>
      {/* ─── Page 1: Cover ──────────────────────────────────── */}
      <ReportPage style={{ padding: 40, fontSize: 10 }}>
        {watermark && <Watermark text={watermark} />}

        {/* Doc number band: logo top-left, document number + date top-right */}
        <View style={local.coverDocBand}>
          {logoDataUri ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
            <Image src={logoDataUri} style={local.coverLogo} />
          ) : (
            <View />
          )}
          <View>
            <Text style={local.coverDocBandRight}>Document Number: {docNumber}</Text>
            <Text style={local.coverDocBandRight}>Date: {submissionDate}</Text>
          </View>
        </View>

        {/* Big stacked title + "for" + client */}
        <View style={local.coverTitleBlock}>
          <Text style={local.coverTitle}>{proposal.title || 'Techno-Commercial Proposal'}</Text>
          <Text style={local.coverFor}>for</Text>
          <Text style={local.coverClientName}>{proposal.clientName}</Text>
        </View>

        {/* Metadata table */}
        <View style={local.coverMetaBlock}>
          <View style={local.coverMetaRow}>
            <Text style={local.coverMetaLabel}>End User</Text>
            <Text style={local.coverMetaValue}>{proposal.clientName}</Text>
          </View>
          {proposal.enquiryNumber && (
            <View style={local.coverMetaRow}>
              <Text style={local.coverMetaLabel}>Enquiry Reference</Text>
              <Text style={local.coverMetaValue}>{proposal.enquiryNumber}</Text>
            </View>
          )}
          <View style={local.coverMetaRow}>
            <Text style={local.coverMetaLabel}>Proposal Number</Text>
            <Text style={local.coverMetaValue}>{proposal.proposalNumber}</Text>
          </View>
          <View style={local.coverMetaRow}>
            <Text style={local.coverMetaLabel}>Date of Submission</Text>
            <Text style={local.coverMetaValue}>{submissionDate}</Text>
          </View>
          <View style={local.coverMetaRow}>
            <Text style={local.coverMetaLabel}>Revision Number</Text>
            <Text style={local.coverMetaValue}>R{proposal.revision}</Text>
          </View>
          <View style={local.coverMetaRow}>
            <Text style={local.coverMetaLabel}>Valid Until</Text>
            <Text style={local.coverMetaValue}>{formatDate(proposal.validityDate)}</Text>
          </View>
          <View style={local.coverMetaRow}>
            <Text style={local.coverMetaLabel}>Contact Person</Text>
            <Text style={local.coverMetaValue}>{contactPersonText}</Text>
          </View>
          <View style={local.coverMetaRowLast}>
            <Text style={local.coverMetaLabel}>Company Details</Text>
            <Text style={local.coverMetaValue}>{companyDetailsText}</Text>
          </View>
        </View>

        {/* List of Annexures — labelled by the attachment's description
            field (set on upload) so the cover reads "1. Annexure 1 -
            Process Flow Diagram" rather than a raw filename. */}
        {annexures.length > 0 && (
          <View>
            <Text style={local.coverAnnexuresTitle}>List of Annexures</Text>
            {annexures.map((a, idx) => (
              <Text key={a.id} style={local.coverAnnexureItem}>
                {idx + 1}. Annexure {idx + 1} – {annexureLabel(a)}
              </Text>
            ))}
          </View>
        )}
      </ReportPage>

      {/* ─── Page 2: Covering letter ─────────────────────────── */}
      {proposal.coverLetter && proposal.coverLetter.included !== false && (
        <ReportPage style={{ padding: 40, fontSize: 10 }}>
          {watermark && <Watermark text={watermark} />}

          {/* Same doc-number band as the cover so the page is self-identifying */}
          <View style={local.coverDocBand}>
            {logoDataUri ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image src={logoDataUri} style={local.coverLogo} />
            ) : (
              <View />
            )}
            <View>
              <Text style={local.coverDocBandRight}>Document Number: {docNumber}</Text>
              <Text style={local.coverDocBandRight}>Date: {submissionDate}</Text>
            </View>
          </View>

          {/* Recipient block */}
          <View style={{ marginTop: 10, marginBottom: 16 }}>
            <Text style={{ marginBottom: 2 }}>To,</Text>
            {proposal.coverLetter.recipientName && (
              <Text style={{ fontWeight: 'bold' }}>{proposal.coverLetter.recipientName},</Text>
            )}
            {proposal.coverLetter.recipientTitle && (
              <Text>{proposal.coverLetter.recipientTitle},</Text>
            )}
            {proposal.coverLetter.recipientCompany && (
              <Text>{proposal.coverLetter.recipientCompany}</Text>
            )}
          </View>

          {/* Subject */}
          {proposal.coverLetter.subject && (
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <Text style={{ fontWeight: 'bold', width: 80 }}>Subject</Text>
              <Text style={{ fontWeight: 'bold', marginRight: 6 }}>:</Text>
              <Text style={{ flex: 1, fontWeight: 'bold' }}>{proposal.coverLetter.subject}</Text>
            </View>
          )}

          {/* Salutation + body */}
          {proposal.coverLetter.salutation && (
            <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>
              {proposal.coverLetter.salutation}
            </Text>
          )}
          {proposal.coverLetter.body && (
            <View style={{ marginBottom: 16 }}>
              {proposal.coverLetter.body.split('\n\n').map((para, idx) => (
                <Text key={idx} style={{ marginBottom: 8, lineHeight: 1.5 }}>
                  {para}
                </Text>
              ))}
            </View>
          )}

          {/* Sign-off */}
          <View style={{ marginTop: 30 }}>
            <Text>Yours Sincerely,</Text>
            <Text>For {company.name},</Text>
            {proposal.coverLetter.signOffName ? (
              <Text style={{ marginTop: 30, fontWeight: 'bold' }}>
                {proposal.coverLetter.signOffName}
              </Text>
            ) : company.primaryContactName ? (
              <Text style={{ marginTop: 30, fontWeight: 'bold' }}>
                {company.primaryContactName}
                {company.primaryContactRole ? `\n${company.primaryContactRole}` : ''}
              </Text>
            ) : null}
          </View>
        </ReportPage>
      )}

      {/* ─── Page 3 onwards: technical content ─────────────── */}
      <ReportPage style={{ padding: 40, fontSize: 10 }}>
        {watermark && <Watermark text={watermark} />}

        {/* Compact header band on subsequent pages so the proposal number
            stays visible without repeating the full cover. */}
        <ReportHeader
          title="Techno-Commercial Proposal"
          subtitle={company.name}
          logoDataUri={logoDataUri}
        />
        {(company.address || company.gstin) && (
          <View style={local.companyMeta}>
            {company.address && <Text style={local.companyMetaText}>{company.address}</Text>}
            {company.gstin && <Text style={local.companyMetaText}>GSTIN: {company.gstin}</Text>}
          </View>
        )}
        <Text style={local.proposalTitle}>
          Proposal No: {proposal.proposalNumber} Rev.{proposal.revision}
        </Text>

        {/* Client Information */}
        <ReportSection title="TO">
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>{proposal.clientName}</Text>
          {clientAddress && <Text>{clientAddress}</Text>}
          {clientContactPerson && <Text>Attention: {clientContactPerson}</Text>}
          {clientEmail && <Text>Email: {clientEmail}</Text>}
        </ReportSection>

        {/* Qualifications — capability statement + team + past projects.
            Renders between TO and the project description so the buyer
            sees who we are before reading the technical write-up. Each
            piece is independently optional. */}
        {proposal.qualifications && proposal.qualifications.included !== false && (
          <>
            {(proposal.qualifications.statement?.trim() ||
              proposal.qualifications.experienceHighlights?.trim()) && (
              <ReportSection title="Our Qualifications">
                {proposal.qualifications.statement?.trim() && (
                  <View style={{ marginBottom: 8 }}>
                    {proposal.qualifications.statement.split('\n\n').map((para, idx) => (
                      <Text key={idx} style={{ marginBottom: 6, lineHeight: 1.5 }}>
                        {para}
                      </Text>
                    ))}
                  </View>
                )}
                {proposal.qualifications.experienceHighlights?.trim() && (
                  <View style={{ marginBottom: 4 }}>
                    {proposal.qualifications.experienceHighlights.split('\n\n').map((para, idx) => (
                      <Text key={idx} style={{ marginBottom: 4, fontSize: 9 }}>
                        {para}
                      </Text>
                    ))}
                  </View>
                )}
              </ReportSection>
            )}
            {proposal.qualifications.keyPersonnel &&
              proposal.qualifications.keyPersonnel.filter((p) => p.included && p.name).length >
                0 && (
                <ReportSection title="Key Personnel">
                  <ReportTable
                    columns={[
                      { key: 'name', header: 'Name', width: '24%' },
                      { key: 'role', header: 'Role', width: '24%' },
                      { key: 'qualification', header: 'Qualification', width: '28%' },
                      { key: 'exp', header: 'Exp (yrs)', width: '12%', align: 'center' },
                      { key: 'bio', header: 'Highlights', width: '12%' },
                    ]}
                    rows={proposal.qualifications.keyPersonnel
                      .filter((p) => p.included && p.name)
                      .sort((a, b) => a.order - b.order)
                      .map((p) => ({
                        name: p.name,
                        role: p.role ?? '—',
                        qualification: p.qualification ?? '—',
                        exp: p.experienceYears != null ? `${p.experienceYears}` : '—',
                        bio: p.bio ?? '',
                      }))}
                  />
                </ReportSection>
              )}
            {proposal.qualifications.pastProjects &&
              proposal.qualifications.pastProjects.filter((p) => p.included && p.name).length >
                0 && (
                <ReportSection title="Past Projects">
                  {proposal.qualifications.pastProjects
                    .filter((p) => p.included && p.name)
                    .sort((a, b) => a.order - b.order)
                    .map((p, idx) => (
                      <View key={p.id} style={{ marginBottom: 8 }}>
                        <Text style={{ fontWeight: 'bold' }}>
                          {idx + 1}. {p.name}
                          {p.client ? ` — ${p.client}` : ''}
                        </Text>
                        <Text style={{ fontSize: 9, color: REPORT_THEME.textSecondary }}>
                          {[p.year, p.value, p.role].filter(Boolean).join(' · ')}
                        </Text>
                        {p.scopeSummary && (
                          <Text style={{ marginTop: 2, lineHeight: 1.4 }}>{p.scopeSummary}</Text>
                        )}
                      </View>
                    ))}
                </ReportSection>
              )}
          </>
        )}

        {/* Project Brief — narrative + input data + clarifications. Each
            piece is independently optional and skipped when empty. The
            whole section is hidden when included === false. */}
        {proposal.projectBrief && proposal.projectBrief.included !== false && (
          <>
            {proposal.projectBrief.description && proposal.projectBrief.description.trim() && (
              <ReportSection title="Description of the Project">
                {proposal.projectBrief.description.split('\n\n').map((para, idx) => (
                  <Text key={idx} style={{ marginBottom: 6, lineHeight: 1.5 }}>
                    {para}
                  </Text>
                ))}
              </ReportSection>
            )}
            {proposal.projectBrief.inputData && proposal.projectBrief.inputData.length > 0 && (
              <ReportSection title="Input Data Considered">
                <ReportTable
                  columns={[
                    { key: 'sno', header: 'S No', width: '10%', align: 'center' },
                    { key: 'parameter', header: 'Parameter', width: '55%' },
                    { key: 'value', header: 'Value', width: '35%' },
                  ]}
                  rows={proposal.projectBrief.inputData.map((r, idx) => ({
                    sno: idx + 1,
                    parameter: r.parameter,
                    value: r.value,
                  }))}
                />
              </ReportSection>
            )}
            {proposal.projectBrief.clarifications &&
              proposal.projectBrief.clarifications.trim() && (
                <ReportSection title="Clarifications">
                  {proposal.projectBrief.clarifications.split('\n\n').map((para, idx) => (
                    <Text key={idx} style={{ marginBottom: 6, lineHeight: 1.5 }}>
                      {para}
                    </Text>
                  ))}
                </ReportSection>
              )}
          </>
        )}

        {/* Scope of Services — Unified Scope Matrix */}
        {hasUnifiedScopeMatrix && unifiedServices.length > 0 ? (
          <ReportSection title="Scope of Services">
            {proposal
              .unifiedScopeMatrix!.categories.filter((cat) =>
                cat.items.some((i) => i.included && i.classification === 'SERVICE')
              )
              .map((cat) => (
                <View key={cat.id} style={{ marginBottom: 8 }}>
                  <Text style={local.subsectionTitle}>{cat.label}</Text>
                  <View style={local.bulletList}>
                    {cat.items
                      .filter((i) => i.included && i.classification === 'SERVICE')
                      .map((item) => (
                        <Text key={item.id} style={local.bulletItem}>
                          • {item.name}
                          {item.description ? ` - ${item.description}` : ''}
                        </Text>
                      ))}
                  </View>
                </View>
              ))}
          </ReportSection>
        ) : null}

        {/* Scope of Supply — Unified Scope Matrix */}
        {hasUnifiedScopeMatrix && unifiedSupply.length > 0 ? (
          <ReportSection title="Scope of Supply">
            <ReportTable
              columns={[
                { key: 'num', header: '#', width: '8%' },
                { key: 'description', header: 'Description', width: '47%' },
                { key: 'qty', header: 'Qty', width: '15%' },
                { key: 'unit', header: 'Unit', width: '15%' },
              ]}
              rows={unifiedSupply.map((item, idx) => ({
                num: idx + 1,
                description: item.description ? `${item.name}\n${item.description}` : item.name,
                qty: item.quantity || '—',
                unit: item.unit || '—',
              }))}
            />
          </ReportSection>
        ) : null}

        {/* Exclusions & Clarifications — items the buyer asked for that aren't in this offer */}
        {hasUnifiedScopeMatrix && unifiedExclusions.length > 0 ? (
          <ReportSection title="Exclusions and Clarifications">
            <Text style={{ marginBottom: 6, fontSize: 9, color: REPORT_THEME.textSecondary }}>
              The following items from the enquiry / SOW are not included in this offer:
            </Text>
            <View style={local.bulletList}>
              {unifiedExclusions.map((item, idx) => (
                <View key={item.id} style={{ marginBottom: 6 }}>
                  <Text style={local.bulletItem}>
                    {idx + 1}. {item.name}
                  </Text>
                  {item.exclusionReason && (
                    <Text
                      style={{
                        marginLeft: 14,
                        fontSize: 9,
                        color: REPORT_THEME.textSecondary,
                        fontStyle: 'italic',
                      }}
                    >
                      {item.exclusionReason}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </ReportSection>
        ) : null}

        {/* Technical Compliance Matrix (Stage 2.5s) — optional, prints
            only when included and there are items. Tenders typically
            enumerate 20-100 specs and demand a clause-by-clause response. */}
        {proposal.complianceMatrix &&
          proposal.complianceMatrix.included !== false &&
          proposal.complianceMatrix.items &&
          proposal.complianceMatrix.items.length > 0 && (
            <ReportSection title="Technical Compliance">
              {proposal.complianceMatrix.preamble?.trim() && (
                <View style={{ marginBottom: 8 }}>
                  {proposal.complianceMatrix.preamble.split('\n\n').map((para, idx) => (
                    <Text key={idx} style={{ marginBottom: 4, lineHeight: 1.4 }}>
                      {para}
                    </Text>
                  ))}
                </View>
              )}
              <ReportTable
                fontSize={8}
                columns={[
                  { key: 'clause', header: 'Clause', width: '10%', align: 'center' },
                  { key: 'requirement', header: 'Requirement', width: '34%' },
                  { key: 'offered', header: 'Our Offer', width: '28%' },
                  { key: 'status', header: 'Status', width: '12%', align: 'center' },
                  { key: 'remarks', header: 'Remarks', width: '16%' },
                ]}
                rows={proposal.complianceMatrix.items
                  .filter((it) => it.requirement.trim().length > 0)
                  .sort((a, b) => a.order - b.order)
                  .map((it) => ({
                    clause: it.clauseRef ?? '—',
                    requirement: it.requirement,
                    offered: it.offered ?? '—',
                    status:
                      it.status === 'COMPLIES'
                        ? 'Complies'
                        : it.status === 'DEVIATION'
                          ? 'Deviation'
                          : 'N/A',
                    remarks: it.remarks ?? '',
                  }))}
              />
            </ReportSection>
          )}

        {/* Commercial Summary — customer-facing.
            Sections, subtotal, tax, total all come from the shared
            computeCommercialSummary helper. Amounts are in the quote
            currency. The tax row prints whenever summary.taxRate > 0 —
            the user decides; for an export quote under LUT they set
            rate to 0 to suppress it. */}
        {hasClientPricing && summary ? (
          <View style={local.costSummary}>
            <Text style={[s.sectionTitle, { borderBottom: 'none', marginBottom: 10 }]}>
              Commercial Summary
            </Text>
            {summary.sections.map((sec) => {
              // For foreign-currency export quotes we bake tax into each
              // row so the customer sees one rolled number per section,
              // and the Subtotal/GST rows below are suppressed.
              const displayed = summary.rollTaxIntoSections
                ? sec.amount * (1 + summary.taxRate / 100)
                : sec.amount;
              return (
                <View key={sec.id} style={local.costRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={local.costLabel}>{sec.title}</Text>
                    {sec.description && (
                      <Text
                        style={{ fontSize: 9, color: REPORT_THEME.textSecondary, marginTop: 1 }}
                      >
                        {sec.description}
                      </Text>
                    )}
                  </View>
                  <Text style={local.costValue}>{formatPdfMoney(displayed, quoteCurrency)}</Text>
                </View>
              );
            })}
            {!summary.rollTaxIntoSections && summary.taxRate > 0 && (
              <>
                <View
                  style={{
                    ...local.costRow,
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: '0.5pt solid #ccc',
                  }}
                >
                  <Text style={local.costLabel}>Subtotal:</Text>
                  <Text style={local.costValue}>
                    {formatPdfMoney(summary.sectionsSum, quoteCurrency)}
                  </Text>
                </View>
                <View style={local.costRow}>
                  <Text style={local.costLabel}>
                    {summary.taxLabel || `Tax (${summary.taxRate}%)`}:
                  </Text>
                  <Text style={local.costValue}>
                    {formatPdfMoney(summary.taxAmount, quoteCurrency)}
                  </Text>
                </View>
              </>
            )}
            <View
              style={{
                ...local.costRow,
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1pt solid #ccc',
              }}
            >
              <Text style={local.costLabel}>Total ({quoteCurrency}):</Text>
              <Text style={local.totalCost}>{formatPdfMoney(summary.total, quoteCurrency)}</Text>
            </View>
          </View>
        ) : null}

        {/* Delivery Schedule */}
        {includeDeliverySchedule && proposal.deliveryPeriod && (
          <ReportSection title="Delivery Schedule">
            <Text>{proposal.deliveryPeriod.description}</Text>
            {proposal.deliveryPeriod.milestones &&
              proposal.deliveryPeriod.milestones.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Milestones:</Text>
                  {/* The Tax column only belongs on INR offers — foreign
                      quotes don't carry an "Incl./Excl. Tax" concept since
                      Indian GST is zero-rated on exports. */}
                  <ReportTable
                    columns={
                      isForeignQuote
                        ? [
                            { key: 'num', header: '#', width: '8%' },
                            { key: 'description', header: 'Description', width: '46%' },
                            { key: 'deliverable', header: 'Deliverable', width: '22%' },
                            { key: 'duration', header: 'Duration', width: '12%' },
                            { key: 'payment', header: 'Payment', width: '12%' },
                          ]
                        : [
                            { key: 'num', header: '#', width: '8%' },
                            { key: 'description', header: 'Description', width: '37%' },
                            { key: 'deliverable', header: 'Deliverable', width: '20%' },
                            { key: 'duration', header: 'Duration', width: '12%' },
                            { key: 'payment', header: 'Payment', width: '12%' },
                            { key: 'tax', header: 'Tax', width: '11%' },
                          ]
                    }
                    rows={proposal.deliveryPeriod.milestones.map((milestone, idx) => {
                      const base: Record<string, string | number> = {
                        num: milestone.milestoneNumber || idx + 1,
                        description: milestone.description,
                        deliverable: milestone.deliverable || '—',
                        duration: `${milestone.durationInWeeks} wks`,
                        payment: milestone.paymentPercentage
                          ? `${milestone.paymentPercentage}%`
                          : '—',
                      };
                      if (!isForeignQuote) {
                        base.tax = milestone.taxType
                          ? MILESTONE_TAX_TYPE_LABELS[milestone.taxType]
                          : '—';
                      }
                      return base;
                    })}
                  />
                </View>
              )}
          </ReportSection>
        )}

        {/* Payment Terms */}
        {proposal.pricing?.paymentTerms && (
          <ReportSection title="Payment Terms">
            {/* For foreign quotes, scrub "(Incl. Tax)" / "(Excl. Tax)" suffixes
                that the milestone summariser appends — those tax annotations
                are meaningless on an export quote. */}
            <Text>
              {isForeignQuote
                ? proposal.pricing.paymentTerms.replace(/\s*\((?:Incl|Excl)\.\s*Tax\)/gi, '')
                : proposal.pricing.paymentTerms}
            </Text>
          </ReportSection>
        )}

        {/* Terms & Conditions — structured termsBlocks render first; if a
            proposal predates stage 2.5j (no termsBlocks at all), seed the
            canonical defaults so the customer always sees standard T&Cs.
            The legacy named-slot rendering is only used when there's
            something there to lift. */}
        {includeTerms &&
          (() => {
            const sourceBlocks =
              proposal.termsBlocks && proposal.termsBlocks.length > 0
                ? proposal.termsBlocks
                : buildDefaultTermsBlocks();
            const blocks = sourceBlocks
              .filter((b) => b.included && b.body.trim().length > 0)
              .sort((a, b) => a.order - b.order);
            if (blocks.length > 0) {
              return (
                <ReportSection title="Terms &amp; Conditions">
                  {blocks.map((b, idx) => (
                    <View key={b.id} style={{ marginBottom: 8 }}>
                      <Text style={{ fontWeight: 'bold' }}>
                        {idx + 1}. {b.title}
                      </Text>
                      <Text>{b.body}</Text>
                    </View>
                  ))}
                </ReportSection>
              );
            }
            // Legacy fallback for proposals created before structured terms.
            if (!proposal.terms) return null;
            const t = proposal.terms;
            const hasAny =
              !!t.warranty ||
              !!t.liquidatedDamages ||
              !!t.forceMajeure ||
              !!t.disputeResolution ||
              (t.customTerms && t.customTerms.length > 0);
            if (!hasAny) return null;
            return (
              <ReportSection title="Terms &amp; Conditions">
                {t.warranty && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ fontWeight: 'bold' }}>Warranty:</Text>
                    <Text>{t.warranty}</Text>
                  </View>
                )}
                {t.liquidatedDamages && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ fontWeight: 'bold' }}>Liquidated Damages:</Text>
                    <Text>{t.liquidatedDamages}</Text>
                  </View>
                )}
                {t.forceMajeure && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ fontWeight: 'bold' }}>Force Majeure:</Text>
                    <Text>{t.forceMajeure}</Text>
                  </View>
                )}
                {t.disputeResolution && (
                  <View style={{ marginBottom: 6 }}>
                    <Text style={{ fontWeight: 'bold' }}>Dispute Resolution:</Text>
                    <Text>{t.disputeResolution}</Text>
                  </View>
                )}
                {t.customTerms && t.customTerms.length > 0 && (
                  <View style={local.bulletList}>
                    {t.customTerms.map((term, idx) => (
                      <Text key={idx} style={local.bulletItem}>
                        • {term}
                      </Text>
                    ))}
                  </View>
                )}
              </ReportSection>
            );
          })()}

        <ReportFooter
          lines={[
            `This is a computer-generated document. Generated on ${formatDate(new Date())}`,
            'Vapour Desal Technologies | info@vapourdesal.com | www.vapourdesal.com',
          ]}
        />
      </ReportPage>
    </Document>
  );
};
