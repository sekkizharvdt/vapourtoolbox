/**
 * Period Report PDF Document
 *
 * Full management report: cover, executive summary, P&L (with QoQ), balance
 * sheet, cash flow, AR/AP aging, working capital, GST, project performance,
 * data quality, and trial-balance appendix. Section 12 (LLM-authored critique)
 * is intentionally left for a later iteration.
 */

import React from 'react';
import { Document, Text, View, StyleSheet } from '@react-pdf/renderer';
import {
  ReportPage,
  ReportHeader,
  ReportSection,
  ReportTable,
  KeyValueTable,
  SummaryCards,
  ReportFooter,
  REPORT_THEME,
  type TableColumn,
} from '@/lib/pdf/reportComponents';
import type {
  PeriodReportData,
  AgingBuckets,
  AgingBucketCounts,
  AgingSection,
  PnLSection,
  WorkingCapitalSection,
  ExecutiveSummarySection,
  GSTSection,
  ProjectPerformanceSection,
  DataQualitySection,
  TrialBalanceSection,
  ResolvedPeriod,
} from '@/lib/accounting/reports/periodReportData';
import type { BalanceSheetReport } from '@/lib/accounting/reports/balanceSheet';
import type { CashFlowStatement } from '@/lib/accounting/reports/cashFlow';

/* ─── Formatting helpers ──────────────────────────────────────── */

function formatINR(amount: number): string {
  const rounded = Math.round(amount);
  return '₹' + rounded.toLocaleString('en-IN');
}

function formatINRSigned(amount: number): string {
  if (Math.abs(amount) < 0.5) return '₹0';
  return (amount < 0 ? '-' : '') + '₹' + Math.round(Math.abs(amount)).toLocaleString('en-IN');
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPct(n: number): string {
  return n.toFixed(1) + '%';
}

function formatDelta(amount: number, pct: number): string {
  const sign = amount >= 0 ? '+' : '−';
  return `${sign}${formatINR(Math.abs(amount))} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
}

/* ─── Shared styles ───────────────────────────────────────────── */

const localStyles = StyleSheet.create({
  deltaText: { fontSize: 8, marginTop: 2 },
  inlineCaveat: {
    fontSize: 8,
    color: REPORT_THEME.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Stacked bar (re-used by AR + AP)
  barContainer: {
    flexDirection: 'row',
    width: '100%',
    height: 26,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 8,
  },
  barSegment: { justifyContent: 'center', alignItems: 'center' },
  barSegmentLabel: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  legendRow: { flexDirection: 'row', gap: 12, marginBottom: 8, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 8, color: REPORT_THEME.textSecondary },
  // Severity chip
  severityChip: {
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
    fontSize: 7,
    fontWeight: 'bold',
    color: '#fff',
    alignSelf: 'flex-start',
  },
});

const BUCKET_COLORS = {
  current: '#2e7d32',
  days31to60: '#ff9800',
  days61to90: '#ef6c00',
  over90days: '#d32f2f',
} as const;

const BUCKET_LABELS = {
  current: '0-30 days',
  days31to60: '31-60 days',
  days61to90: '61-90 days',
  over90days: '90+ days',
} as const;

/* ─── Sub-components ──────────────────────────────────────────── */

function StackedBar({ buckets, total }: { buckets: AgingBuckets; total: number }) {
  if (total <= 0) {
    return (
      <View style={{ padding: 8, backgroundColor: REPORT_THEME.tableHeaderBg }}>
        <Text style={{ fontSize: 9, color: REPORT_THEME.textSecondary }}>No open items.</Text>
      </View>
    );
  }
  const order: (keyof AgingBuckets)[] = ['current', 'days31to60', 'days61to90', 'over90days'];
  return (
    <View>
      <View style={localStyles.barContainer}>
        {order.map((key) => {
          const pct = (buckets[key] / total) * 100;
          if (pct <= 0) return null;
          return (
            <View
              key={key}
              style={[
                localStyles.barSegment,
                { width: `${pct}%`, backgroundColor: BUCKET_COLORS[key] },
              ]}
            >
              {pct >= 8 && <Text style={localStyles.barSegmentLabel}>{pct.toFixed(0)}%</Text>}
            </View>
          );
        })}
      </View>
      <View style={localStyles.legendRow}>
        {order.map((key) => (
          <View key={key} style={localStyles.legendItem}>
            <View style={[localStyles.legendSwatch, { backgroundColor: BUCKET_COLORS[key] }]} />
            <Text style={localStyles.legendText}>
              {BUCKET_LABELS[key]} — {formatINR(buckets[key])}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function buildBucketRows(
  buckets: AgingBuckets,
  counts: AgingBucketCounts,
  total: number
): Record<string, string | number>[] {
  const order: (keyof AgingBuckets)[] = ['current', 'days31to60', 'days61to90', 'over90days'];
  return order.map((key) => ({
    bucket: BUCKET_LABELS[key],
    amount: formatINR(buckets[key]),
    pct: total > 0 ? formatPct((buckets[key] / total) * 100) : '—',
    count: String(counts[key]),
  }));
}

/* ─── Page: Cover ─────────────────────────────────────────────── */

function CoverPage({
  period,
  generatedAt,
  logoDataUri,
}: {
  period: ResolvedPeriod;
  generatedAt: Date;
  logoDataUri?: string;
}) {
  return (
    <ReportPage>
      <ReportHeader
        title="Accounting Management Report"
        subtitle={period.label}
        date={formatDate(generatedAt)}
        logoDataUri={logoDataUri}
      />
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>
          Period at a glance
        </Text>
        <KeyValueTable
          rows={[
            { label: 'Period', value: period.label },
            { label: 'Period start', value: formatDate(period.startDate) },
            {
              label: 'Period end',
              value: formatDate(new Date(period.endDate.getTime() - 24 * 60 * 60 * 1000)),
            },
            { label: 'Generated on', value: formatDate(generatedAt) },
            { label: 'Basis', value: 'Accrual' },
            { label: 'Currency', value: 'INR (base)' },
            { label: 'Audience', value: 'Internal management' },
          ]}
          labelWidth="40%"
          valueWidth="60%"
        />
      </View>
      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 6 }}>Contents</Text>
        <Text style={{ fontSize: 9, marginBottom: 2 }}>
          1. Executive summary · 2. Profit &amp; Loss · 3. Balance Sheet · 4. Cash Flow
        </Text>
        <Text style={{ fontSize: 9, marginBottom: 2 }}>
          5. Receivables (AR) · 6. Payables (AP) · 7. Working Capital · 8. GST &amp; Statutory
        </Text>
        <Text style={{ fontSize: 9, marginBottom: 2 }}>
          9. Project Performance · 10. Data Quality · 11. Appendix (Trial Balance)
        </Text>
      </View>
      <ReportFooter
        lines={[
          'Vapour Toolbox — Accounting Management Report',
          'Accrual basis. INR base currency. Soft-deleted transactions excluded.',
        ]}
      />
    </ReportPage>
  );
}

/* ─── Page: Executive Summary ─────────────────────────────────── */

function ExecutiveSummaryPage({
  period,
  summary,
  pnl,
  logoDataUri,
}: {
  period: ResolvedPeriod;
  summary: ExecutiveSummarySection;
  pnl: PnLSection;
  logoDataUri?: string;
}) {
  const rows: Record<string, string | number>[] = [
    {
      metric: 'Revenue',
      current: formatINR(summary.revenue),
      prior: pnl.previous ? formatINR(pnl.previous.revenue.total) : '—',
      delta: pnl.changes
        ? formatDelta(pnl.changes.revenue.amount, pnl.changes.revenue.percentage)
        : '—',
    },
    {
      metric: 'Expenses',
      current: formatINR(summary.expenses),
      prior: pnl.previous ? formatINR(pnl.previous.expenses.total) : '—',
      delta: pnl.changes
        ? formatDelta(pnl.changes.expenses.amount, pnl.changes.expenses.percentage)
        : '—',
    },
    {
      metric: 'Net profit',
      current: formatINRSigned(summary.netProfit),
      prior: pnl.previous ? formatINRSigned(pnl.previous.netProfit) : '—',
      delta: pnl.changes
        ? formatDelta(pnl.changes.netProfit.amount, pnl.changes.netProfit.percentage)
        : '—',
    },
    {
      metric: 'Profit margin',
      current: formatPct(summary.profitMarginPct),
      prior: pnl.previous ? formatPct(pnl.previous.profitMargin) : '—',
      delta: '',
    },
  ];

  return (
    <ReportPage>
      <ReportHeader title="Executive Summary" subtitle={period.label} logoDataUri={logoDataUri} />
      <SummaryCards
        items={[
          { label: 'Revenue', value: formatINR(summary.revenue) },
          {
            label: 'Net profit',
            value: formatINRSigned(summary.netProfit),
            color: summary.netProfit >= 0 ? REPORT_THEME.successText : REPORT_THEME.errorText,
          },
          { label: 'Net cash flow', value: formatINRSigned(summary.netCashFlow) },
          { label: 'Closing cash', value: formatINR(summary.closingCash) },
        ]}
      />
      <SummaryCards
        items={[
          { label: 'AR outstanding', value: formatINR(summary.arOutstanding) },
          { label: 'AP outstanding', value: formatINR(summary.apOutstanding) },
          { label: 'Working capital', value: formatINRSigned(summary.workingCapital) },
          {
            label: 'Data quality issues',
            value: String(summary.dataQualityIssues),
            color:
              summary.dataQualityIssues === 0
                ? REPORT_THEME.successText
                : summary.dataQualityIssues <= 5
                  ? REPORT_THEME.warningText
                  : REPORT_THEME.errorText,
          },
        ]}
      />
      <ReportSection title="Period-over-period (current vs prior equal-length period)">
        <ReportTable
          columns={[
            { key: 'metric', header: 'Metric', width: '34%' },
            { key: 'current', header: 'Current', width: '22%', align: 'right' },
            { key: 'prior', header: 'Prior period', width: '22%', align: 'right' },
            { key: 'delta', header: 'Δ', width: '22%', align: 'right' },
          ]}
          rows={rows}
          striped
        />
        {!pnl.previous && (
          <Text style={localStyles.inlineCaveat}>
            Prior-period figures unavailable (no activity in prior window). YoY becomes meaningful
            once FY 2026-27 closes.
          </Text>
        )}
      </ReportSection>
      <ReportFooter lines={['Executive Summary']} />
    </ReportPage>
  );
}

/* ─── Page: P&L ───────────────────────────────────────────────── */

function PnLPage({
  period,
  pnl,
  logoDataUri,
}: {
  period: ResolvedPeriod;
  pnl: PnLSection;
  logoDataUri?: string;
}) {
  const { current, previous, changes } = pnl;
  const topAccounts = (limit: number, from: 'revenue' | 'expense') => {
    const all =
      from === 'revenue'
        ? [...current.revenue.salesAccounts, ...current.revenue.otherIncomeAccounts]
        : [
            ...current.expenses.cogsAccounts,
            ...current.expenses.operatingAccounts,
            ...current.expenses.otherAccounts,
          ];
    return all
      .slice()
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, limit);
  };

  const topRevenue = topAccounts(6, 'revenue');
  const topExpenses = topAccounts(8, 'expense');

  return (
    <ReportPage>
      <ReportHeader title="Profit & Loss" subtitle={period.label} logoDataUri={logoDataUri} />
      <ReportSection title="Summary">
        <ReportTable
          columns={[
            { key: 'line', header: 'Line', width: '40%' },
            { key: 'amount', header: 'Current', width: '20%', align: 'right' },
            { key: 'prior', header: 'Prior', width: '20%', align: 'right' },
            { key: 'delta', header: 'Δ %', width: '20%', align: 'right' },
          ]}
          rows={[
            {
              line: 'Revenue',
              amount: formatINR(current.revenue.total),
              prior: previous ? formatINR(previous.revenue.total) : '—',
              delta: changes ? formatPct(changes.revenue.percentage) : '—',
            },
            {
              line: '  Sales',
              amount: formatINR(current.revenue.sales),
              prior: previous ? formatINR(previous.revenue.sales) : '—',
              delta: '',
            },
            {
              line: '  Other income',
              amount: formatINR(current.revenue.otherIncome),
              prior: previous ? formatINR(previous.revenue.otherIncome) : '—',
              delta: '',
            },
            {
              line: 'Expenses',
              amount: formatINR(current.expenses.total),
              prior: previous ? formatINR(previous.expenses.total) : '—',
              delta: changes ? formatPct(changes.expenses.percentage) : '—',
            },
            {
              line: '  Cost of goods sold',
              amount: formatINR(current.expenses.costOfGoodsSold),
              prior: previous ? formatINR(previous.expenses.costOfGoodsSold) : '—',
              delta: '',
            },
            {
              line: '  Operating expenses',
              amount: formatINR(current.expenses.operatingExpenses),
              prior: previous ? formatINR(previous.expenses.operatingExpenses) : '—',
              delta: '',
            },
            {
              line: '  Other expenses',
              amount: formatINR(current.expenses.otherExpenses),
              prior: previous ? formatINR(previous.expenses.otherExpenses) : '—',
              delta: '',
            },
          ]}
          totalRow={{
            line: 'Net profit',
            amount: formatINRSigned(current.netProfit),
            prior: previous ? formatINRSigned(previous.netProfit) : '—',
            delta: changes ? formatPct(changes.netProfit.percentage) : '—',
          }}
          striped
        />
      </ReportSection>

      <ReportSection title="Top revenue accounts">
        {topRevenue.length === 0 ? (
          <Text style={{ fontSize: 9, color: REPORT_THEME.textSecondary }}>
            No revenue in this period.
          </Text>
        ) : (
          <ReportTable
            columns={[
              { key: 'code', header: 'Code', width: '12%' },
              { key: 'name', header: 'Account', width: '58%' },
              { key: 'amount', header: 'Amount', width: '30%', align: 'right' },
            ]}
            rows={topRevenue.map((a) => ({
              code: a.code,
              name: a.name,
              amount: formatINR(a.amount),
            }))}
            striped
          />
        )}
      </ReportSection>

      <ReportSection title="Top expense accounts">
        {topExpenses.length === 0 ? (
          <Text style={{ fontSize: 9, color: REPORT_THEME.textSecondary }}>
            No expenses in this period.
          </Text>
        ) : (
          <ReportTable
            columns={[
              { key: 'code', header: 'Code', width: '12%' },
              { key: 'name', header: 'Account', width: '58%' },
              { key: 'amount', header: 'Amount', width: '30%', align: 'right' },
            ]}
            rows={topExpenses.map((a) => ({
              code: a.code,
              name: a.name,
              amount: formatINR(Math.abs(a.amount)),
            }))}
            striped
          />
        )}
      </ReportSection>

      <ReportFooter lines={['Profit & Loss — accrual basis']} />
    </ReportPage>
  );
}

/* ─── Page: Balance Sheet ─────────────────────────────────────── */

function BalanceSheetPage({
  period,
  bs,
  logoDataUri,
}: {
  period: ResolvedPeriod;
  bs: BalanceSheetReport;
  logoDataUri?: string;
}) {
  return (
    <ReportPage>
      <ReportHeader
        title="Balance Sheet"
        subtitle={`${period.label} — as of ${formatDate(bs.asOfDate)}`}
        logoDataUri={logoDataUri}
      />
      <ReportSection title="Assets">
        <ReportTable
          columns={[
            { key: 'group', header: 'Group', width: '50%' },
            { key: 'amount', header: 'Amount', width: '50%', align: 'right' },
          ]}
          rows={[
            { group: 'Current assets', amount: formatINR(bs.assets.totalCurrentAssets) },
            { group: 'Fixed assets', amount: formatINR(bs.assets.totalFixedAssets) },
            { group: 'Other assets', amount: formatINR(bs.assets.totalOtherAssets) },
          ]}
          totalRow={{ group: 'Total assets', amount: formatINR(bs.assets.totalAssets) }}
          striped
        />
      </ReportSection>
      <ReportSection title="Liabilities">
        <ReportTable
          columns={[
            { key: 'group', header: 'Group', width: '50%' },
            { key: 'amount', header: 'Amount', width: '50%', align: 'right' },
          ]}
          rows={[
            {
              group: 'Current liabilities',
              amount: formatINR(bs.liabilities.totalCurrentLiabilities),
            },
            {
              group: 'Long-term liabilities',
              amount: formatINR(bs.liabilities.totalLongTermLiabilities),
            },
          ]}
          totalRow={{
            group: 'Total liabilities',
            amount: formatINR(bs.liabilities.totalLiabilities),
          }}
          striped
        />
      </ReportSection>
      <ReportSection title="Equity">
        <ReportTable
          columns={[
            { key: 'line', header: 'Line', width: '50%' },
            { key: 'amount', header: 'Amount', width: '50%', align: 'right' },
          ]}
          rows={[
            { line: 'Capital', amount: formatINRSigned(bs.equity.capital) },
            { line: 'Retained earnings', amount: formatINRSigned(bs.equity.retainedEarnings) },
            {
              line: 'Current year profit',
              amount: formatINRSigned(bs.equity.currentYearProfit),
            },
          ]}
          totalRow={{ line: 'Total equity', amount: formatINRSigned(bs.equity.totalEquity) }}
          striped
        />
      </ReportSection>
      <ReportSection title="Accounting equation check">
        <KeyValueTable
          rows={[
            { label: 'Assets', value: formatINR(bs.assets.totalAssets) },
            {
              label: 'Liabilities + Equity',
              value: formatINR(bs.liabilities.totalLiabilities + bs.equity.totalEquity),
            },
            { label: 'Difference', value: formatINRSigned(bs.difference) },
            { label: 'Balanced', value: bs.balanced ? 'Yes' : 'No — investigate' },
          ]}
        />
      </ReportSection>
      <ReportFooter lines={['Balance Sheet — accrual basis']} />
    </ReportPage>
  );
}

/* ─── Page: Cash Flow ─────────────────────────────────────────── */

function CashFlowPage({
  period,
  cf,
  logoDataUri,
}: {
  period: ResolvedPeriod;
  cf: CashFlowStatement;
  logoDataUri?: string;
}) {
  return (
    <ReportPage>
      <ReportHeader title="Cash Flow" subtitle={period.label} logoDataUri={logoDataUri} />
      <SummaryCards
        items={[
          { label: 'Opening cash', value: formatINR(cf.openingCash) },
          {
            label: 'Net cash flow',
            value: formatINRSigned(cf.netCashFlow),
            color: cf.netCashFlow >= 0 ? REPORT_THEME.successText : REPORT_THEME.errorText,
          },
          { label: 'Closing cash', value: formatINR(cf.closingCash) },
        ]}
      />
      {([cf.operating, cf.investing, cf.financing] as const).map((section, i) => (
        <ReportSection key={i} title={section.title}>
          {section.lines.length === 0 ? (
            <Text style={{ fontSize: 9, color: REPORT_THEME.textSecondary }}>
              No activity in this period.
            </Text>
          ) : (
            <ReportTable
              columns={[
                { key: 'description', header: 'Description', width: '70%' },
                { key: 'amount', header: 'Amount', width: '30%', align: 'right' },
              ]}
              rows={section.lines.map((l) => ({
                description: '  '.repeat(l.indent ?? 0) + l.description,
                amount: formatINRSigned(l.amount),
              }))}
              totalRow={{
                description: `Total ${section.title}`,
                amount: formatINRSigned(section.total),
              }}
              striped
            />
          )}
        </ReportSection>
      ))}
      <ReportFooter lines={['Cash Flow — accrual basis, bank + cash account entries']} />
    </ReportPage>
  );
}

/* ─── Page: Aging (shared for AR + AP) ────────────────────────── */

function AgingPage({
  period,
  aging,
  logoDataUri,
}: {
  period: ResolvedPeriod;
  aging: AgingSection;
  logoDataUri?: string;
}) {
  const kindLabel = aging.kind === 'AR' ? 'Receivables (AR) Aging' : 'Payables (AP) Aging';
  const counterparty = aging.kind === 'AR' ? 'Customer' : 'Vendor';
  return (
    <ReportPage>
      <ReportHeader
        title={kindLabel}
        subtitle={`${period.label} — aging as of ${formatDate(aging.asOf)}`}
        logoDataUri={logoDataUri}
      />
      <SummaryCards
        items={[
          { label: 'Total outstanding', value: formatINR(aging.totalOutstanding) },
          { label: 'Open items', value: String(aging.invoiceCount) },
          { label: `${counterparty}s`, value: String(aging.entityCount) },
          {
            label: 'Top-5 concentration',
            value: formatPct(aging.top5ConcentrationPct),
            color:
              aging.top5ConcentrationPct >= 70
                ? REPORT_THEME.errorText
                : aging.top5ConcentrationPct >= 50
                  ? REPORT_THEME.warningText
                  : REPORT_THEME.successText,
          },
        ]}
      />
      <ReportSection title="Aging buckets">
        <StackedBar buckets={aging.buckets} total={aging.totalOutstanding} />
        <ReportTable
          columns={[
            { key: 'bucket', header: 'Bucket', width: '30%' },
            { key: 'amount', header: 'Outstanding', width: '30%', align: 'right' },
            { key: 'pct', header: 'Share', width: '20%', align: 'right' },
            { key: 'count', header: 'Items', width: '20%', align: 'right' },
          ]}
          rows={buildBucketRows(aging.buckets, aging.bucketCounts, aging.totalOutstanding)}
          totalRow={{
            bucket: 'Total',
            amount: formatINR(aging.totalOutstanding),
            pct: '100.0%',
            count: String(aging.invoiceCount),
          }}
          striped
        />
      </ReportSection>
      <ReportSection title={`Top ${aging.topEntities.length} ${counterparty.toLowerCase()}s`}>
        {aging.topEntities.length > 0 ? (
          <ReportTable
            columns={TOP_ENTITY_COLUMNS(counterparty)}
            rows={aging.topEntities.map((e, i) => ({
              rank: String(i + 1),
              entity: e.entityName,
              invoices: String(e.invoiceCount),
              worstAge:
                e.daysPastDue <= 0
                  ? 'current'
                  : `${e.daysPastDue} day${e.daysPastDue === 1 ? '' : 's'}`,
              outstanding: formatINR(e.outstanding),
              share: formatPct(
                aging.totalOutstanding > 0 ? (e.outstanding / aging.totalOutstanding) * 100 : 0
              ),
            }))}
            striped
          />
        ) : (
          <Text style={{ fontSize: 9, color: REPORT_THEME.textSecondary }}>
            No outstanding items.
          </Text>
        )}
      </ReportSection>
      <ReportFooter lines={[`${kindLabel} — accrual basis, INR`]} />
    </ReportPage>
  );
}

const TOP_ENTITY_COLUMNS = (counterparty: string): TableColumn[] => [
  { key: 'rank', header: '#', width: '6%', align: 'center' },
  { key: 'entity', header: counterparty, width: '40%' },
  { key: 'invoices', header: 'Items', width: '10%', align: 'right' },
  { key: 'worstAge', header: 'Worst age', width: '16%', align: 'right' },
  { key: 'outstanding', header: 'Outstanding', width: '18%', align: 'right' },
  { key: 'share', header: 'Share', width: '10%', align: 'right' },
];

/* ─── Page: Working Capital + GST ─────────────────────────────── */

function WorkingCapitalGSTPage({
  period,
  wc,
  gst,
  logoDataUri,
}: {
  period: ResolvedPeriod;
  wc: WorkingCapitalSection;
  gst: GSTSection;
  logoDataUri?: string;
}) {
  return (
    <ReportPage>
      <ReportHeader
        title="Working Capital & GST"
        subtitle={period.label}
        logoDataUri={logoDataUri}
      />
      <ReportSection title="Working capital (from Balance Sheet)">
        <SummaryCards
          items={[
            {
              label: 'Working capital',
              value: formatINRSigned(wc.workingCapital),
              color: wc.workingCapital >= 0 ? REPORT_THEME.successText : REPORT_THEME.errorText,
            },
            {
              label: 'Current ratio',
              value: wc.currentRatio != null ? wc.currentRatio.toFixed(2) : '—',
            },
            {
              label: 'Quick ratio',
              value: wc.quickRatio != null ? wc.quickRatio.toFixed(2) : '—',
            },
          ]}
        />
        <KeyValueTable
          rows={[
            { label: 'Current assets', value: formatINR(wc.currentAssets) },
            { label: 'Quick assets (current − inventory)', value: formatINR(wc.quickAssets) },
            { label: 'Current liabilities', value: formatINR(wc.currentLiabilities) },
          ]}
        />
      </ReportSection>
      <ReportSection title="GST & Statutory">
        {!gst.configured ? (
          <Text style={{ fontSize: 9, color: REPORT_THEME.warningText }}>
            GST accounts not found in Chart of Accounts. Expected codes{' '}
            {gst.missingAccountCodes.join(', ')}. Configure these before this section is meaningful.
          </Text>
        ) : (
          <>
            <ReportTable
              columns={[
                { key: 'type', header: 'GST', width: '25%' },
                { key: 'input', header: 'Input (ITC)', width: '25%', align: 'right' },
                { key: 'output', header: 'Output', width: '25%', align: 'right' },
                { key: 'net', header: 'Net', width: '25%', align: 'right' },
              ]}
              rows={[
                {
                  type: 'CGST',
                  input: formatINR(gst.cgstInput),
                  output: formatINR(gst.cgstOutput),
                  net: formatINRSigned(gst.cgstOutput - gst.cgstInput),
                },
                {
                  type: 'SGST',
                  input: formatINR(gst.sgstInput),
                  output: formatINR(gst.sgstOutput),
                  net: formatINRSigned(gst.sgstOutput - gst.sgstInput),
                },
                {
                  type: 'IGST',
                  input: formatINR(gst.igstInput),
                  output: formatINR(gst.igstOutput),
                  net: formatINRSigned(gst.igstOutput - gst.igstInput),
                },
              ]}
              totalRow={{
                type: 'Total',
                input: formatINR(gst.totalInput),
                output: formatINR(gst.totalOutput),
                net: formatINRSigned(gst.netPayable),
              }}
              striped
            />
            <Text style={localStyles.inlineCaveat}>
              Net payable = Output − Input (cumulative balance; not period-filtered in v1).
            </Text>
          </>
        )}
      </ReportSection>
      <ReportFooter lines={['Working Capital & GST']} />
    </ReportPage>
  );
}

/* ─── Page: Project Performance ───────────────────────────────── */

function ProjectPerformancePage({
  period,
  proj,
  logoDataUri,
}: {
  period: ResolvedPeriod;
  proj: ProjectPerformanceSection;
  logoDataUri?: string;
}) {
  const rows = proj.rows.slice(0, 15).map((r, i) => ({
    rank: String(i + 1),
    project: r.projectName,
    revenue: formatINR(r.revenue),
    expense: formatINR(r.expense),
    margin: formatINRSigned(r.margin),
    marginPct: r.revenue > 0 ? formatPct(r.marginPct) : '—',
  }));
  const overheadRow = {
    rank: '',
    project: '(Corporate overhead — untagged)',
    revenue: '—',
    expense: formatINR(proj.corporateOverhead.amount),
    margin: '',
    marginPct: '',
  };

  return (
    <ReportPage>
      <ReportHeader title="Project Performance" subtitle={period.label} logoDataUri={logoDataUri} />
      <SummaryCards
        items={[
          { label: 'Revenue (tagged)', value: formatINR(proj.totals.revenue) },
          { label: 'Spend (tagged)', value: formatINR(proj.totals.expense) },
          {
            label: 'Margin',
            value: formatINRSigned(proj.totals.margin),
            color: proj.totals.margin >= 0 ? REPORT_THEME.successText : REPORT_THEME.errorText,
          },
          { label: 'Spend coverage', value: formatPct(proj.totals.taggedSpendPct) },
        ]}
      />
      <ReportSection title={`Top ${Math.min(15, proj.rows.length)} projects in period`}>
        {proj.rows.length === 0 ? (
          <Text style={{ fontSize: 9, color: REPORT_THEME.textSecondary }}>
            No project activity in this period.
          </Text>
        ) : (
          <ReportTable
            columns={[
              { key: 'rank', header: '#', width: '6%', align: 'center' },
              { key: 'project', header: 'Project', width: '34%' },
              { key: 'revenue', header: 'Revenue', width: '16%', align: 'right' },
              { key: 'expense', header: 'Expense', width: '16%', align: 'right' },
              { key: 'margin', header: 'Margin', width: '14%', align: 'right' },
              { key: 'marginPct', header: 'Margin %', width: '14%', align: 'right' },
            ]}
            rows={[...rows, overheadRow]}
            striped
          />
        )}
      </ReportSection>
      <Text style={localStyles.inlineCaveat}>
        Corporate overhead is the sum of vendor bills not tagged to any project. Multi-project
        invoices/bills split amounts equally across their tagged projects.
      </Text>
      <ReportFooter lines={['Project Performance']} />
    </ReportPage>
  );
}

/* ─── Page: Data Quality ──────────────────────────────────────── */

function SeverityChip({ severity }: { severity: DataQualityFindingSeverity }) {
  const bg =
    severity === 'high'
      ? REPORT_THEME.errorText
      : severity === 'medium'
        ? REPORT_THEME.warningText
        : REPORT_THEME.textSecondary;
  return (
    <Text style={[localStyles.severityChip, { backgroundColor: bg }]}>
      {severity.toUpperCase()}
    </Text>
  );
}

type DataQualityFindingSeverity = 'high' | 'medium' | 'low';

function DataQualityPage({
  period,
  dq,
  logoDataUri,
}: {
  period: ResolvedPeriod;
  dq: DataQualitySection;
  logoDataUri?: string;
}) {
  return (
    <ReportPage>
      <ReportHeader title="Data Quality" subtitle={period.label} logoDataUri={logoDataUri} />
      {dq.findings.length === 0 ? (
        <View style={{ padding: 12, backgroundColor: '#e8f5e9', marginTop: 12 }}>
          <Text style={{ fontSize: 10, color: REPORT_THEME.successText, fontWeight: 'bold' }}>
            No data-quality issues detected.
          </Text>
        </View>
      ) : (
        <ReportSection title={`${dq.totalIssues} issue${dq.totalIssues === 1 ? '' : 's'} detected`}>
          <View style={{ gap: 8 }}>
            {dq.findings.map((f, i) => (
              <View
                key={i}
                style={{
                  padding: 8,
                  borderLeft: `3pt solid ${
                    f.severity === 'high'
                      ? REPORT_THEME.errorText
                      : f.severity === 'medium'
                        ? REPORT_THEME.warningText
                        : REPORT_THEME.textSecondary
                  }`,
                  backgroundColor: REPORT_THEME.notesBg,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <SeverityChip severity={f.severity} />
                  <Text style={{ fontSize: 9, fontWeight: 'bold' }}>
                    {f.count} item{f.count === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>{f.label}</Text>
                {f.detail && (
                  <Text style={{ fontSize: 8, color: REPORT_THEME.textSecondary, marginTop: 2 }}>
                    {f.detail}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </ReportSection>
      )}
      <Text style={localStyles.inlineCaveat}>
        Full diagnostics (including stale payment statuses and unmapped accounts per transaction)
        live on the Data Health page in the app.
      </Text>
      <ReportFooter lines={['Data Quality']} />
    </ReportPage>
  );
}

/* ─── Page: Appendix (Trial Balance) ──────────────────────────── */

function TrialBalanceAppendixPage({
  period,
  tb,
  logoDataUri,
}: {
  period: ResolvedPeriod;
  tb: TrialBalanceSection;
  logoDataUri?: string;
}) {
  // Only include rows with non-zero activity for readability.
  const rows = tb.rows.filter((r) => r.debit > 0.01 || r.credit > 0.01);
  return (
    <ReportPage>
      <ReportHeader
        title="Appendix: Trial Balance"
        subtitle={`${period.label} — point-in-time cumulative balances`}
        logoDataUri={logoDataUri}
      />
      <ReportTable
        columns={[
          { key: 'code', header: 'Code', width: '12%' },
          { key: 'name', header: 'Account', width: '44%' },
          { key: 'debit', header: 'Debit', width: '14%', align: 'right' },
          { key: 'credit', header: 'Credit', width: '14%', align: 'right' },
          { key: 'balance', header: 'Balance', width: '16%', align: 'right' },
        ]}
        rows={rows.map((r) => ({
          code: r.code,
          name: r.name,
          debit: formatINR(r.debit),
          credit: formatINR(r.credit),
          balance: formatINRSigned(r.balance),
        }))}
        totalRow={{
          code: '',
          name: 'Total',
          debit: formatINR(tb.totals.debit),
          credit: formatINR(tb.totals.credit),
          balance: tb.balanced ? 'Balanced' : formatINRSigned(tb.totals.debit - tb.totals.credit),
        }}
        striped
        fontSize={8}
      />
      <ReportFooter
        lines={['Trial Balance — cumulative, all-time. Accounts with zero activity are omitted.']}
      />
    </ReportPage>
  );
}

/* ─── Main document ───────────────────────────────────────────── */

interface PeriodReportPDFDocumentProps {
  data: PeriodReportData;
  logoDataUri?: string;
}

export function PeriodReportPDFDocument({ data, logoDataUri }: PeriodReportPDFDocumentProps) {
  const {
    period,
    generatedAt,
    executiveSummary,
    pnl,
    balanceSheet,
    cashFlow,
    arAging,
    apAging,
    workingCapital,
    gst,
    projectPerformance,
    dataQuality,
    trialBalance,
  } = data;

  return (
    <Document>
      <CoverPage period={period} generatedAt={generatedAt} logoDataUri={logoDataUri} />
      <ExecutiveSummaryPage
        period={period}
        summary={executiveSummary}
        pnl={pnl}
        logoDataUri={logoDataUri}
      />
      <PnLPage period={period} pnl={pnl} logoDataUri={logoDataUri} />
      <BalanceSheetPage period={period} bs={balanceSheet} logoDataUri={logoDataUri} />
      <CashFlowPage period={period} cf={cashFlow} logoDataUri={logoDataUri} />
      <AgingPage period={period} aging={arAging} logoDataUri={logoDataUri} />
      <AgingPage period={period} aging={apAging} logoDataUri={logoDataUri} />
      <WorkingCapitalGSTPage
        period={period}
        wc={workingCapital}
        gst={gst}
        logoDataUri={logoDataUri}
      />
      <ProjectPerformancePage period={period} proj={projectPerformance} logoDataUri={logoDataUri} />
      <DataQualityPage period={period} dq={dataQuality} logoDataUri={logoDataUri} />
      <TrialBalanceAppendixPage period={period} tb={trialBalance} logoDataUri={logoDataUri} />
    </Document>
  );
}
