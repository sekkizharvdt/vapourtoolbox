'use client';

import { Breadcrumbs, Link, Typography } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

interface CalculatorBreadcrumbProps {
  calculatorName: string;
}

export function CalculatorBreadcrumb({ calculatorName }: CalculatorBreadcrumbProps) {
  const router = useRouter();

  return (
    <Breadcrumbs sx={{ mb: 2 }}>
      <Link
        color="inherit"
        href="/thermal/calculators"
        onClick={(e: React.MouseEvent) => {
          e.preventDefault();
          router.push('/thermal/calculators');
        }}
        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
      >
        <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
        Calculators
      </Link>
      <Typography color="text.primary">{calculatorName}</Typography>
    </Breadcrumbs>
  );
}
