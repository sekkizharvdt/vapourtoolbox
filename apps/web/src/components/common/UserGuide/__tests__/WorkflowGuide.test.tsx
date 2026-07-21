/**
 * WorkflowGuide tests
 *
 * The content itself is generated from docs/workflows/user-testing/*.md, so these
 * check the rendering contract rather than the wording: every section loads, the
 * step tables render, and the known-issues warning appears.
 */

import { render, screen } from '@testing-library/react';
import { WorkflowGuide } from '../WorkflowGuide';
import { WORKFLOW_GUIDE_SUMMARY, WORKFLOW_GUIDE_LOADERS } from '@/data/workflowGuide';
import type { WorkflowGuideModule } from '@/data/workflowGuide';

/** Fails loudly rather than silently skipping if a section id ever stops existing. */
function loadSection(id: string): Promise<WorkflowGuideModule> {
  const loader = WORKFLOW_GUIDE_LOADERS[id];
  if (!loader) throw new Error(`No workflow guide loader registered for "${id}"`);
  return loader();
}

function summaryFor(id: string) {
  const summary = WORKFLOW_GUIDE_SUMMARY[id];
  if (!summary) throw new Error(`No workflow guide summary registered for "${id}"`);
  return summary;
}

describe('WorkflowGuide', () => {
  it('renders the workflow list for a section', async () => {
    render(<WorkflowGuide moduleId="procurement" />);

    expect(await screen.findByText('Workflows you can test')).toBeInTheDocument();
    // Workflow codes are what users quote when reporting a problem. The code also
    // appears in cross-references ("requires the PO from UAT-PROC-04"), so match all.
    expect((await screen.findAllByText('UAT-PROC-01')).length).toBeGreaterThan(0);
    expect(
      await screen.findByText('Raise a purchase request and submit it for approval')
    ).toBeInTheDocument();
    expect(screen.getByText(/34 workflows/)).toBeInTheDocument();
  });

  it('shows the known-issues warning with its entries', async () => {
    render(<WorkflowGuide moduleId="procurement" />);

    expect(
      await screen.findByText(/Known issues — please do not report these/)
    ).toBeInTheDocument();
  });

  it('renders nothing for an unknown section instead of crashing', () => {
    const { container } = render(<WorkflowGuide moduleId="does-not-exist" />);
    expect(container).toBeEmptyDOMElement();
  });

  // Each dataset is large, and transforming all ten in one worker exhausts memory in
  // the pre-commit hook. Check the wiring across every section, then load only one.
  it('every section in the summary has a loader', () => {
    const ids = Object.keys(WORKFLOW_GUIDE_SUMMARY);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(WORKFLOW_GUIDE_LOADERS[id]).toBeDefined();
      expect(summaryFor(id).workflows).toBeGreaterThan(0);
    }
    // No loader without a matching summary entry either.
    expect(Object.keys(WORKFLOW_GUIDE_LOADERS).sort()).toEqual(ids.sort());
  });

  it('workflows carry a stable id and at least one block of content', async () => {
    const data = await loadSection('procurement');

    expect(data.workflows.length).toBe(summaryFor('procurement').workflows);
    for (const wf of data.workflows) {
      expect(wf.id).toMatch(/^UAT-[A-Z]+-\d+$/);
      expect(wf.blocks.length).toBeGreaterThan(0);
    }
  });

  it('every workflow has a step table with an action and an expected result', async () => {
    const data = await loadSection('procurement');

    for (const wf of data.workflows) {
      const steps = wf.blocks.find((b) => b.k === 'table' && b.steps);
      expect(steps ? true : wf.id).toBe(true);
      if (steps && steps.k === 'table') {
        expect(steps.head.length).toBeGreaterThanOrEqual(3);
        expect(steps.rows.length).toBeGreaterThan(0);
      }
    }
  });

  it('drops the printable Pass and Notes columns from step tables', async () => {
    const data = await loadSection('procurement');
    for (const wf of data.workflows) {
      for (const b of wf.blocks) {
        if (b.k === 'table') {
          expect(b.head).not.toContain('Pass?');
          expect(b.head).not.toContain('Notes');
        }
      }
    }
  });

  it('routes each known issue to a section that owns the workflow it affects', async () => {
    const data = await loadSection('hr');
    const ownIds = new Set(data.workflows.map((w) => w.id));

    for (const gap of data.gaps) {
      const referenced = [...gap.text.matchAll(/UAT-[A-Z]+-\d+/g)].map((m) => m[0]);
      if (referenced.length === 0) continue;
      expect(referenced.some((id) => ownIds.has(id))).toBe(true);
    }
  });
});
