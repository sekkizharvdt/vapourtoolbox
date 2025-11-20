import React from 'react';
import { Card, CardContent, Typography, Box, SvgIconProps } from '@mui/material';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactElement<SvgIconProps>;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
}

export function StatCard({ label, value, icon, color = 'primary', trend }: StatCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography color="text.secondary" gutterBottom variant="body2">
              {label}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
              {value}
            </Typography>
            {trend && (
              <Typography
                variant="caption"
                sx={{
                  color:
                    trend.direction === 'up'
                      ? 'success.main'
                      : trend.direction === 'down'
                        ? 'error.main'
                        : 'text.secondary',
                  display: 'flex',
                  alignItems: 'center',
                  mt: 1,
                }}
              >
                {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '•'}{' '}
                {Math.abs(trend.value)}% {trend.label}
              </Typography>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: `${color}.light`,
                color: `${color}.main`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8,
              }}
            >
              {React.cloneElement(icon, { fontSize: 'medium' })}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
