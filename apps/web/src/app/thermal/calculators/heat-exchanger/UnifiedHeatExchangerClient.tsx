'use client';

/**
 * Unified Heat Exchanger Calculator
 *
 * Consolidates three calculators into one page with tab navigation:
 *   - Quick Calc: Heat duty (sensible/latent) + LMTD + area from assumed U
 *   - HTC Analysis: Detailed heat transfer coefficients for known geometry
 *   - Full Design: Iterative sizing from process conditions to final tube count & shell size
 */

import { useState } from 'react';
import { Container, Typography, Box, Chip, Stack, Tabs, Tab } from '@mui/material';
import {
  Calculate as CalcIcon,
  Thermostat as HTCIcon,
  Engineering as DesignIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { QuickCalcPanel } from './panels/QuickCalcPanel';
import { HTCAnalysisPanel } from './panels/HTCAnalysisPanel';
import { FullDesignPanel } from './panels/FullDesignPanel';

type TabId = 'quick-calc' | 'htc' | 'design';

const TABS: { id: TabId; label: string; icon: React.ReactElement; description: string }[] = [
  {
    id: 'quick-calc',
    label: 'Quick Calc',
    icon: <CalcIcon />,
    description: 'Sensible/latent heat duty, LMTD, and area from assumed U',
  },
  {
    id: 'htc',
    label: 'HTC Analysis',
    icon: <HTCIcon />,
    description: 'Detailed tube-side, shell-side, and overall HTC for known geometry',
  },
  {
    id: 'design',
    label: 'Full Design',
    icon: <DesignIcon />,
    description: 'Iterative sizing — converges on tube count, area, and shell size',
  },
];

export default function UnifiedHeatExchangerClient() {
  const [activeTab, setActiveTab] = useState<TabId>('quick-calc');

  const currentTab = TABS.find((t) => t.id === activeTab)!;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <CalculatorBreadcrumb calculatorName="Heat Exchanger" />

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={0.5}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Heat Exchanger Calculator
          </Typography>
          <Chip label="Unified" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {currentTab.description}
        </Typography>
      </Box>

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="standard">
          {TABS.map((tab) => (
            <Tab
              key={tab.id}
              value={tab.id}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              sx={{ textTransform: 'none', minHeight: 48 }}
            />
          ))}
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <QuickCalcPanel active={activeTab === 'quick-calc'} />
      <HTCAnalysisPanel active={activeTab === 'htc'} />
      <FullDesignPanel active={activeTab === 'design'} />
    </Container>
  );
}
