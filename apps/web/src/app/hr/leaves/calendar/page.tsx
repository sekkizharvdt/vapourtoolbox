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
  Tooltip,
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Today as TodayIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { getTeamCalendar, getAllHolidaysInRange, type HolidayInfo } from '@/lib/hr';
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
  isHoliday: boolean;
  holidayInfo: HolidayInfo | null;
  leaves: LeaveRequest[];
}

export default function LeaveCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<HolidayInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch leaves and holidays for the current month with some buffer
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);

      const [leaveData, holidayData] = await Promise.all([
        getTeamCalendar(start, end),
        getAllHolidaysInRange(start, end),
      ]);

      setLeaves(leaveData);
      setHolidays(holidayData);
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

    // Create a map for quick holiday lookup
    const holidayMap = new Map<string, HolidayInfo>();
    holidays.forEach((holiday) => {
      const key = holiday.date.toISOString().split('T')[0];
      if (key) holidayMap.set(key, holiday);
    });

    // Get first day of month and find start of calendar (Sunday)
    const firstDay = new Date(year, month, 1);
    const startOfCalendar = new Date(firstDay);
    startOfCalendar.setDate(startOfCalendar.getDate() - firstDay.getDay());

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const date = new Date(startOfCalendar);
      date.setDate(startOfCalendar.getDate() + i);
      date.setHours(0, 0, 0, 0);

      // Check if this day is a holiday
      const dateKey = date.toISOString().split('T')[0] ?? '';
      const holidayInfo = holidayMap.get(dateKey) || null;

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
        isHoliday: !!holidayInfo,
        holidayInfo,
        leaves: dayLeaves,
      });
    }

    return days;
  }, [year, month, leaves, holidays]);

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
              {calendarDays.map((day: CalendarDay, index: number) => {
                // Determine background color
                let bgColor = day.isCurrentMonth ? 'background.paper' : 'grey.50';
                if (day.isToday) {
                  bgColor = 'primary.light';
                } else if (day.isHoliday) {
                  bgColor = day.holidayInfo?.isRecurring ? '#f5f5f5' : '#fff3e0';
                }

                return (
                  <Box
                    key={index}
                    sx={{
                      minHeight: 100,
                      p: 1,
                      borderBottom: 1,
                      borderRight: (index + 1) % 7 !== 0 ? 1 : 0,
                      borderColor: 'divider',
                      backgroundColor: bgColor,
                      opacity: day.isCurrentMonth ? 1 : 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
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
                      {day.isHoliday && day.holidayInfo && (
                        <Tooltip title={day.holidayInfo.name}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: day.holidayInfo.isRecurring ? '#9ca3af' : '#f97316',
                            }}
                          />
                        </Tooltip>
                      )}
                    </Box>
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {/* Show holiday label */}
                      {day.isHoliday && day.holidayInfo && (
                        <Chip
                          label={day.holidayInfo.name}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            backgroundColor: day.holidayInfo.isRecurring ? '#9ca3af' : '#f97316',
                            color: 'white',
                          }}
                        />
                      )}
                      {/* Show leaves */}
                      {day.leaves.slice(0, day.isHoliday ? 2 : 3).map((leave: LeaveRequest) => (
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
                      {day.leaves.length > (day.isHoliday ? 2 : 3) && (
                        <Typography variant="caption" color="text.secondary">
                          +{day.leaves.length - (day.isHoliday ? 2 : 3)} more
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          Legend:
        </Typography>
        <Chip
          size="small"
          label="On Leave"
          sx={{ backgroundColor: 'success.light', color: 'success.contrastText' }}
        />
        <Chip
          size="small"
          label="Weekend (Sun, 1st/3rd Sat)"
          sx={{ backgroundColor: '#9ca3af', color: 'white' }}
        />
        <Chip
          size="small"
          label="Company Holiday"
          sx={{ backgroundColor: '#f97316', color: 'white' }}
        />
      </Box>
    </Box>
  );
}
