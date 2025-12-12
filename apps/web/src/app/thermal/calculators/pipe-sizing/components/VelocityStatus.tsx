'use client';

import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

export function getVelocityStatusIcon(status: 'OK' | 'HIGH' | 'LOW') {
  switch (status) {
    case 'OK':
      return <CheckCircleIcon color="success" fontSize="small" />;
    case 'HIGH':
      return <ErrorIcon color="error" fontSize="small" />;
    case 'LOW':
      return <WarningIcon color="warning" fontSize="small" />;
  }
}

export function getVelocityStatusColor(status: 'OK' | 'HIGH' | 'LOW') {
  switch (status) {
    case 'OK':
      return 'success.main';
    case 'HIGH':
      return 'error.main';
    case 'LOW':
      return 'warning.main';
  }
}
