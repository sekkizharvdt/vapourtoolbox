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
  returnDialogOpen: boolean;
  issueDialogOpen: boolean;
  cancelDialogOpen: boolean;

  // Form fields
  approvalComments: string;
  rejectionReason: string;
  returnComments: string;
  cancellationReason: string;
  // Two approvers, both chosen by the submitter at submit time (review 2.3).
  selectedApproverId: string | null;
  selectedApproverName: string;
  selectedSecondApproverId: string | null;
  selectedSecondApproverName: string;

  // Actions
  setSubmitDialogOpen: (open: boolean) => void;
  setApproveDialogOpen: (open: boolean) => void;
  setRejectDialogOpen: (open: boolean) => void;
  setReturnDialogOpen: (open: boolean) => void;
  setIssueDialogOpen: (open: boolean) => void;
  setCancelDialogOpen: (open: boolean) => void;
  setApprovalComments: (comments: string) => void;
  setRejectionReason: (reason: string) => void;
  setReturnComments: (comments: string) => void;
  setCancellationReason: (reason: string) => void;
  setSelectedApprover: (id: string | null, name: string) => void;
  setSelectedSecondApprover: (id: string | null, name: string) => void;

  // Reset functions
  resetApprovalForm: () => void;
  resetRejectionForm: () => void;
  resetReturnForm: () => void;
  resetCancellationForm: () => void;
  resetSubmitForm: () => void;
}

export function useWorkflowDialogs(): WorkflowDialogState {
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [returnComments, setReturnComments] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [selectedApproverId, setSelectedApproverId] = useState<string | null>(null);
  const [selectedApproverName, setSelectedApproverName] = useState('');
  const [selectedSecondApproverId, setSelectedSecondApproverId] = useState<string | null>(null);
  const [selectedSecondApproverName, setSelectedSecondApproverName] = useState('');

  const setSelectedApprover = (id: string | null, name: string) => {
    setSelectedApproverId(id);
    setSelectedApproverName(name);
  };
  const setSelectedSecondApprover = (id: string | null, name: string) => {
    setSelectedSecondApproverId(id);
    setSelectedSecondApproverName(name);
  };

  const resetApprovalForm = () => {
    setApprovalComments('');
    setApproveDialogOpen(false);
  };

  const resetRejectionForm = () => {
    setRejectionReason('');
    setRejectDialogOpen(false);
  };

  const resetReturnForm = () => {
    setReturnComments('');
    setReturnDialogOpen(false);
  };

  const resetCancellationForm = () => {
    setCancellationReason('');
    setCancelDialogOpen(false);
  };

  const resetSubmitForm = () => {
    setSelectedApprover(null, '');
    setSelectedSecondApprover(null, '');
    setSubmitDialogOpen(false);
  };

  return {
    submitDialogOpen,
    approveDialogOpen,
    rejectDialogOpen,
    returnDialogOpen,
    issueDialogOpen,
    cancelDialogOpen,
    approvalComments,
    rejectionReason,
    returnComments,
    cancellationReason,
    selectedApproverId,
    selectedApproverName,
    selectedSecondApproverId,
    selectedSecondApproverName,
    setSubmitDialogOpen,
    setApproveDialogOpen,
    setRejectDialogOpen,
    setReturnDialogOpen,
    setIssueDialogOpen,
    setCancelDialogOpen,
    setApprovalComments,
    setRejectionReason,
    setReturnComments,
    setCancellationReason,
    setSelectedApprover,
    setSelectedSecondApprover,
    resetApprovalForm,
    resetRejectionForm,
    resetReturnForm,
    resetCancellationForm,
    resetSubmitForm,
  };
}
