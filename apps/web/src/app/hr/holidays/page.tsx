'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  Skeleton,
  Chip,
  Card,
  CardContent,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getHolidaysForYear, DEFAULT_RECURRING_CONFIG } from '@/lib/hr/holidays';
import type { Holiday, HolidayType } from '@vapour/types';
import { format } from 'date-fns';

const HOLIDAY_TYPE_OPTIONS: { value: HolidayType; label: string; color: string }[] = [
  { value: 'COMPANY', label: 'Company Holiday', color: '#f97316' },
  { value: 'NATIONAL', label: 'National Holiday', color: '#ef4444' },
  { value: 'OPTIONAL', label: 'Optional Holiday', color: '#8b5cf6' },
];

export default function HolidaysPage() {
  const router = useRouter();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getHolidaysForYear(currentYear);
      setHolidays(data);
    } catch (err) {
      console.error('Failed to load holidays:', err);
      setError('Failed to load holidays. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/hr"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/hr');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          HR
        </Link>
        <Typography color="text.primary">Holidays</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Company Holidays {currentYear}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View company holidays and recurring weekly offs
          </Typography>
        </Box>
        <IconButton onClick={loadData} title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Recurring Holidays Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Recurring Holidays (Auto-calculated)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The following days are automatically treated as holidays:
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
            {DEFAULT_RECURRING_CONFIG.sundays && (
              <Chip
                label="All Sundays"
                size="small"
                sx={{ backgroundColor: '#9ca3af', color: 'white' }}
              />
            )}
            {DEFAULT_RECURRING_CONFIG.firstSaturday && (
              <Chip
                label="1st Saturday of each month"
                size="small"
                sx={{ backgroundColor: '#9ca3af', color: 'white' }}
              />
            )}
            {DEFAULT_RECURRING_CONFIG.thirdSaturday && (
              <Chip
                label="3rd Saturday of each month"
                size="small"
                sx={{ backgroundColor: '#9ca3af', color: 'white' }}
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Typography variant="h6" gutterBottom>
        Company-Defined Holidays
      </Typography>

      {loading ? (
        <Skeleton variant="rectangular" height={400} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {holidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No company-defined holidays configured for {currentYear}.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map((holiday) => {
                  const typeInfo = HOLIDAY_TYPE_OPTIONS.find((t) => t.value === holiday.type);
                  return (
                    <TableRow key={holiday.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: holiday.color || typeInfo?.color || '#f97316',
                            }}
                          />
                          <Typography variant="body2">
                            {format(holiday.date.toDate(), 'EEE, dd MMM yyyy')}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {holiday.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={typeInfo?.label || holiday.type}
                          size="small"
                          sx={{
                            backgroundColor: holiday.color || typeInfo?.color || '#f97316',
                            color: 'white',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {holiday.description || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
