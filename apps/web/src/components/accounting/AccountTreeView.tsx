import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Stack,
  Collapse,
  Paper,
  Button,
} from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  AccountBalance as AssetIcon,
  TrendingDown as LiabilityIcon,
  AccountBalanceWallet as EquityIcon,
  TrendingUp as IncomeIcon,
  MoneyOff as ExpenseIcon,
  UnfoldMore as ExpandAllIcon,
  UnfoldLess as CollapseAllIcon,
} from '@mui/icons-material';
import type { Account, AccountTreeNode } from '@vapour/types';

interface AccountTreeViewProps {
  accounts: Account[];
}

export function AccountTreeView({ accounts }: AccountTreeViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Build tree structure from flat account list (memoized)
  const tree = useMemo(() => {
    const treeResult: AccountTreeNode[] = [];
    const accountMap = new Map<string, AccountTreeNode>();

    // First pass: create all nodes
    accounts.forEach((account) => {
      accountMap.set(account.id, { ...account, children: [] });
    });

    // Second pass: build hierarchy
    accountMap.forEach((node) => {
      if (node.parentAccountId) {
        const parent = accountMap.get(node.parentAccountId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          // Parent not found, add to root
          treeResult.push(node);
        }
      } else {
        // Root level account
        treeResult.push(node);
      }
    });

    // Sort each level by code
    const sortChildren = (nodes: AccountTreeNode[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code));
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    };

    sortChildren(treeResult);
    return treeResult;
  }, [accounts]);

  // Collect all account IDs that actually have children in the tree
  const accountsWithChildren = useMemo(() => {
    const withChildren = new Set<string>();

    const collectParents = (nodes: AccountTreeNode[]) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          withChildren.add(node.id);
          collectParents(node.children);
        }
      });
    };

    collectParents(tree);
    return withChildren;
  }, [tree]);

  // Expand all accounts with children
  const handleExpandAll = () => {
    setExpanded(new Set(accountsWithChildren));
  };

  // Collapse all accounts
  const handleCollapseAll = () => {
    setExpanded(new Set());
  };

  const toggleExpand = (accountId: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpanded(newExpanded);
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'ASSET':
        return <AssetIcon fontSize="small" sx={{ color: 'success.main' }} />;
      case 'LIABILITY':
        return <LiabilityIcon fontSize="small" sx={{ color: 'error.main' }} />;
      case 'EQUITY':
        return <EquityIcon fontSize="small" sx={{ color: 'info.main' }} />;
      case 'INCOME':
        return <IncomeIcon fontSize="small" sx={{ color: 'primary.main' }} />;
      case 'EXPENSE':
        return <ExpenseIcon fontSize="small" sx={{ color: 'warning.main' }} />;
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const renderAccount = (account: AccountTreeNode, depth: number = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expanded.has(account.id);

    return (
      <Box key={account.id}>
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 0.5,
            ml: depth * 4,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: depth === 0 ? 'action.hover' : 'background.paper',
            '&:hover': {
              backgroundColor: 'action.selected',
            },
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            {/* Expand/Collapse Icon */}
            {hasChildren ? (
              <IconButton
                size="small"
                onClick={() => toggleExpand(account.id)}
                sx={{ p: 0.5 }}
              >
                {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              </IconButton>
            ) : (
              <Box sx={{ width: 28 }} /> // Spacer for alignment
            )}

            {/* Account Type Icon */}
            {getAccountTypeIcon(account.accountType)}

            {/* Account Code */}
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                fontWeight: account.isGroup ? 'bold' : 'normal',
                minWidth: 80,
              }}
            >
              {account.code}
            </Typography>

            {/* Account Name */}
            <Typography
              variant="body2"
              sx={{
                flexGrow: 1,
                fontWeight: account.isGroup ? 'bold' : 'normal',
              }}
            >
              {account.name}
            </Typography>

            {/* Special Account Badges */}
            <Stack direction="row" spacing={0.5}>
              {account.isGSTAccount && account.gstType && account.gstDirection && (
                <Chip
                  label={`${account.gstType} ${account.gstDirection}`}
                  size="small"
                  color="secondary"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
              {account.isTDSAccount && (
                <Chip
                  label="TDS"
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
              {account.isBankAccount && (
                <Chip
                  label="Bank"
                  size="small"
                  color="info"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
              {account.isSystemAccount && (
                <Chip
                  label="System"
                  size="small"
                  color="default"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Stack>

            {/* Current Balance */}
            {!account.isGroup && (
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  minWidth: 120,
                  textAlign: 'right',
                  color: account.currentBalance >= 0 ? 'text.primary' : 'error.main',
                }}
              >
                {formatCurrency(account.currentBalance, account.currency)}
              </Typography>
            )}
          </Stack>

          {/* Description */}
          {account.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: hasChildren ? 5 : 8, display: 'block', mt: 0.5 }}
            >
              {account.description}
            </Typography>
          )}
        </Paper>

        {/* Children */}
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box>
              {account.children!.map((child) => renderAccount(child, depth + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  if (tree.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
        No accounts to display
      </Typography>
    );
  }

  return (
    <Box>
      {/* Header with Expand/Collapse Controls */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        {/* Legend */}
        <Stack direction="row" spacing={3} flexWrap="wrap" sx={{ flexGrow: 1 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <AssetIcon fontSize="small" sx={{ color: 'success.main' }} />
            <Typography variant="caption">Assets</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <LiabilityIcon fontSize="small" sx={{ color: 'error.main' }} />
            <Typography variant="caption">Liabilities</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <EquityIcon fontSize="small" sx={{ color: 'info.main' }} />
            <Typography variant="caption">Equity</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IncomeIcon fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="caption">Income</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <ExpenseIcon fontSize="small" sx={{ color: 'warning.main' }} />
            <Typography variant="caption">Expenses</Typography>
          </Stack>
        </Stack>

        {/* Expand/Collapse Controls */}
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ExpandAllIcon />}
            onClick={handleExpandAll}
          >
            Expand All
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CollapseAllIcon />}
            onClick={handleCollapseAll}
          >
            Collapse All
          </Button>
        </Stack>
      </Stack>

      {/* Tree */}
      <Box>{tree.map((account) => renderAccount(account))}</Box>
    </Box>
  );
}
