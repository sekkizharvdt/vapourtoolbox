/**
 * Shared Channel Icons Mapping
 *
 * DRY utility for consistent channel icons across flow module components
 */

import {
  Tag as HashIcon,
  ShoppingCart as ShoppingCartIcon,
  Description as DescriptionIcon,
  Calculate as CalculatorIcon,
  CheckCircle as CheckCircleIcon,
  HelpOutline as HelpCircleIcon,
  DriveFileRenameOutline as FileSignatureIcon,
  Assignment as AssignmentIcon,
  AlternateEmail as MentionsIcon,
} from '@mui/icons-material';

/**
 * Channel icon mapping for sidebar (small size)
 */
export const channelIconsSmall: Record<string, React.ReactNode> = {
  Hash: <HashIcon fontSize="small" />,
  ShoppingCart: <ShoppingCartIcon fontSize="small" />,
  FileText: <DescriptionIcon fontSize="small" />,
  Calculator: <CalculatorIcon fontSize="small" />,
  CheckCircle: <CheckCircleIcon fontSize="small" />,
  HelpCircle: <HelpCircleIcon fontSize="small" />,
  FileSignature: <FileSignatureIcon fontSize="small" />,
};

/**
 * Channel icon mapping for headers (default size)
 */
export const channelIcons: Record<string, React.ReactNode> = {
  Hash: <HashIcon />,
  ShoppingCart: <ShoppingCartIcon />,
  FileText: <DescriptionIcon />,
  Calculator: <CalculatorIcon />,
  CheckCircle: <CheckCircleIcon />,
  HelpCircle: <HelpCircleIcon />,
  FileSignature: <FileSignatureIcon />,
};

/**
 * Special icons for global views
 */
export const viewIcons = {
  myTasks: <AssignmentIcon fontSize="small" />,
  myTasksLarge: <AssignmentIcon />,
  mentions: <MentionsIcon fontSize="small" />,
  mentionsLarge: <MentionsIcon />,
};

/**
 * Get channel icon by name with optional size
 */
export function getChannelIcon(
  iconName: string | undefined,
  size: 'small' | 'default' = 'default'
): React.ReactNode {
  if (!iconName) {
    return size === 'small' ? <HashIcon fontSize="small" /> : <HashIcon />;
  }
  const icons = size === 'small' ? channelIconsSmall : channelIcons;
  return icons[iconName] || (size === 'small' ? <HashIcon fontSize="small" /> : <HashIcon />);
}
