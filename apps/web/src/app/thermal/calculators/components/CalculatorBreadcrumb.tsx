'use client';

import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { Home as HomeIcon } from '@mui/icons-material';
interface CalculatorBreadcrumbProps {
  calculatorName: string;
}

export function CalculatorBreadcrumb({ calculatorName }: CalculatorBreadcrumbProps) {
  return (
    <PageBreadcrumbs
      items={[
        { label: 'Calculators', href: '/thermal/calculators', icon: <HomeIcon fontSize="small" /> },
        { label: calculatorName },
      ]}
    />
  );
}
