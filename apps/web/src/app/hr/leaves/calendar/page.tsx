'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  IconButton,
  Alert,
  Chip,
  Stack,
  Skeleton,
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Today as TodayIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { getTeamCalendar } from '@/lib/hr';
import type { LeaveRequest } from '@vapour/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  leaves: LeaveRequest[];
}

export default function LeaveCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch leaves for the current month with some buffer
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      const data = await getTeamCalendar(start, end);
      setLeaves(data);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
      setError('Failed to load calendar data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const calendarDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get first day of month and find start of calendar (Sunday)
    const firstDay = new Date(year, month, 1);
    const startOfCalendar = new Date(firstDay);
    startOfCalendar.setDate(startOfCalendar.getDate() - firstDay.getDay());

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const date = new Date(startOfCalendar);
      date.setDate(startOfCalendar.getDate() + i);
      date.setHours(0, 0, 0, 0);

      // Find leaves that overlap with this day
      const dayLeaves = leaves.filter((leave) => {
        const leaveStart = leave.startDate.toDate();
        const leaveEnd = leave.endDate.toDate();
        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(0, 0, 0, 0);
        return date >= leaveStart && date <= leaveEnd;
      });

      days.push({
        date,
        isCurrentMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime(),
        leaves: dayLeaves,
      });
    }

    return days;
  }, [year, month, leaves]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Team Leave Calendar
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View approved team leaves
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <IconButton onClick={loadData} title="Refresh">
            <RefreshIcon />
          </IconButton>
          <IconButton onClick={handleToday} title="Go to Today">
            <TodayIcon />
          </IconButton>
          <IconButton onClick={handlePrevMonth} title="Previous Month">
            <PrevIcon />
          </IconButton>
          <Typography variant="h6" sx={{ minWidth: 180, textAlign: 'center' }}>
            {MONTHS[month]} {year}
          </Typography>
          <IconButton onClick={handleNextMonth} title="Next Month">
            <NextIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Skeleton variant="rectangular" height={600} />
      ) : (
        <Card>
          <CardContent sx={{ p: 0 }}>
            {/* Weekday headers */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              {WEEKDAYS.map((day) => (
                <Box
                  key={day}
                  sx={{
                    p: 1,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    backgroundColor: 'grey.100',
                  }}
                >
                  <Typography variant="body2">{day}</Typography>
                </Box>
              ))}
            </Box>

            {/* Calendar grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
              }}
            >
              {calendarDays.map((day: CalendarDay, index: number) => (
                <Box
                  key={index}
                  sx={{
                    minHeight: 100,
                    p: 1,
                    borderBottom: 1,
                    borderRight: (index + 1) % 7 !== 0 ? 1 : 0,
                    borderColor: 'divider',
                    backgroundColor: day.isToday
                      ? 'primary.light'
                      : day.isCurrentMonth
                        ? 'background.paper'
                        : 'grey.50',
                    opacity: day.isCurrentMonth ? 1 : 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: day.isToday ? 'bold' : 'normal',
                      color: day.isToday ? 'primary.contrastText' : 'text.primary',
                    }}
                  >
                    {day.date.getDate()}
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    {day.leaves.slice(0, 3).map((leave: LeaveRequest) => (
                      <Chip
                        key={leave.id}
                        label={leave.userName.split(' ')[0]}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          backgroundColor: 'success.light',
                          color: 'success.contrastText',
                        }}
                        title={`${leave.userName} - ${leave.leaveTypeName}`}
                      />
                    ))}
                    {day.leaves.length > 3 && (
                      <Typography variant="caption" color="text.secondary">
                        +{day.leaves.length - 3} more
                      </Typography>
                    )}
                  </Stack>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Legend:
        </Typography>
        <Chip
          size="small"
          label="On Leave"
          sx={{ backgroundColor: 'success.light', color: 'success.contrastText' }}
        />
      </Box>
    </Box>
  );
}
