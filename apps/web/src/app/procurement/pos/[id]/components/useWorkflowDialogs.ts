/**
 * Workflow Dialogs Hook
 *
 * Manages state for all PO workflow action dialogs
 */

import { useState } from 'react';

export interface WorkflowDialogState {
  // Dialog visibility
  submitDialogOpen: boolean;
  approveDialogOpen: boolean;
  rejectDialogOpen: boolean;
  issueDialogOpen: boolean;
  cancelDialogOpen: boolean;

  // Form fields
  approvalComments: string;
  rejectionReason: string;
  cancellationReason: string;

  // Actions
  setSubmitDialogOpen: (open: boolean) => void;
  setApproveDialogOpen: (open: boolean) => void;
  setRejectDialogOpen: (open: boolean) => void;
  setIssueDialogOpen: (open: boolean) => void;
  setCancelDialogOpen: (open: boolean) => void;
  setApprovalComments: (comments: string) => void;
  setRejectionReason: (reason: string) => void;
  setCancellationReason: (reason: string) => void;

  // Reset functions
  resetApprovalForm: () => void;
  resetRejectionForm: () => void;
  resetCancellationForm: () => void;
}

export function useWorkflowDialogs(): WorkflowDialogState {
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  const resetApprovalForm = () => {
    setApprovalComments('');
    setApproveDialogOpen(false);
  };

  const resetRejectionForm = () => {
    setRejectionReason('');
    setRejectDialogOpen(false);
  };

  const resetCancellationForm = () => {
    setCancellationReason('');
    setCancelDialogOpen(false);
  };

  return {
    submitDialogOpen,
    approveDialogOpen,
    rejectDialogOpen,
    issueDialogOpen,
    cancelDialogOpen,
    approvalComments,
    rejectionReason,
    cancellationReason,
    setSubmitDialogOpen,
    setApproveDialogOpen,
    setRejectDialogOpen,
    setIssueDialogOpen,
    setCancelDialogOpen,
    setApprovalComments,
    setRejectionReason,
    setCancellationReason,
    resetApprovalForm,
    resetRejectionForm,
    resetCancellationForm,
  };
}
