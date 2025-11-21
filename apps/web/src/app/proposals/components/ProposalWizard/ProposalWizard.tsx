'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProposalSchema } from '@vapour/validation';
import { Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { createProposal, getProposalById } from '@/lib/proposal/proposalService';
import type { CreateProposalInput, ProposalMilestone } from '@vapour/types';

// Steps
import { BasicInfoStep } from './steps/BasicInfoStep';
import { ScopeOfWorkStep } from './steps/ScopeOfWorkStep';
import { ScopeOfSupplyStep } from './steps/ScopeOfSupplyStep';
// import { DeliveryPeriodStep } from './steps/DeliveryPeriodStep';
// import { PricingStep } from './steps/PricingStep';
// import { TermsStep } from './steps/TermsStep';

const STEPS = [
  'Basic Info',
  'Scope of Work',
  'Scope of Supply',
  'Delivery & Timeline',
  'Pricing',
  'Terms & Conditions',
];

interface ProposalWizardProps {
  proposalId?: string; // If present, we are editing
  initialEnquiryId?: string; // If present, we are creating from an enquiry
}

export function ProposalWizard({ proposalId, initialEnquiryId }: ProposalWizardProps) {
  const router = useRouter();
  const db = useFirestore();
  const { user, claims } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(!!proposalId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methods = useForm({
    resolver: zodResolver(createProposalSchema),
    defaultValues: {
      enquiryId: initialEnquiryId || '',
      title: '',
      clientId: '',
      validityDate: new Date(),
      scopeOfWork: {
        summary: '',
        objectives: [],
        deliverables: [],
        inclusions: [],
        exclusions: [],
        assumptions: [],
      },
      deliveryPeriod: {
        durationInWeeks: 4,
        description: '',
        milestones: [],
      },
      paymentTerms: '50% Advance, 50% on Delivery',
    },
  });

  useEffect(() => {
    if (proposalId && db) {
      const loadProposal = async () => {
        try {
          const data = await getProposalById(db, proposalId);
          if (data) {
            methods.reset({
              enquiryId: data.enquiryId,
              title: data.title,
              clientId: data.clientId,
              validityDate: data.validityDate.toDate(),
              scopeOfWork: data.scopeOfWork,
              deliveryPeriod: data.deliveryPeriod,
              paymentTerms: data.pricing.paymentTerms,
            });
          } else {
            setError('Proposal not found');
          }
        } catch (err) {
          console.error('Error loading proposal:', err);
          setError('Failed to load proposal');
        } finally {
          setLoading(false);
        }
      };
      loadProposal();
    }
  }, [proposalId, db, methods]);

  const handleNext = async () => {
    const isValid = await methods.trigger(); // Validate current step
    if (isValid) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSave = async () => {
    if (!db || !user || !claims?.entityId) return;

    try {
      setSubmitting(true);
      const data = methods.getValues();

      // Construct input object
      const createInput: CreateProposalInput = {
        entityId: claims.entityId,
        enquiryId: data.enquiryId,
        title: data.title,
        clientId: data.clientId,
        validityDate: Timestamp.fromDate(data.validityDate),
        scopeOfWork: {
          summary: data.scopeOfWork.summary,
          objectives: data.scopeOfWork.objectives || [],
          deliverables: data.scopeOfWork.deliverables || [],
          inclusions: data.scopeOfWork.inclusions || [],
          exclusions: data.scopeOfWork.exclusions || [],
          assumptions: data.scopeOfWork.assumptions || [],
        },
        deliveryPeriod: {
          durationInWeeks: data.deliveryPeriod.durationInWeeks,
          description: data.deliveryPeriod.description,
          milestones: (data.deliveryPeriod.milestones || []) as ProposalMilestone[],
        },
        paymentTerms: data.paymentTerms,
      };

      if (proposalId) {
        // Update logic would go here
        // await updateProposal(db, proposalId, updateInput, user.uid);
      } else {
        const newProposal = await createProposal(db, createInput, user.uid);
        router.push(`/proposals/${newProposal.id}/edit`);
      }

      // For now, just move next or finish
      // setActiveStep((prev) => prev + 1);
    } catch (err) {
      console.error('Error saving proposal:', err);
      setError('Failed to save proposal');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading proposal..." />;
  }

  function LoadingState({ message }: { message: string }) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={40} />
        <Typography variant="body2" sx={{ ml: 2 }}>
          {message}
        </Typography>
      </Box>
    );
  }

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return <BasicInfoStep />;
      case 1:
        return <ScopeOfWorkStep />;
      case 2:
        return <ScopeOfSupplyStep />;
      case 3:
        return <Typography>Delivery Period Step (Coming Soon)</Typography>;
      case 4:
        return <Typography>Pricing Step (Coming Soon)</Typography>;
      case 5:
        return <Typography>Terms Step (Coming Soon)</Typography>;
      default:
        return <Typography>Unknown step</Typography>;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <FormProvider {...methods}>
        <Paper sx={{ p: 3, mb: 3, minHeight: '400px' }}>{renderStepContent(activeStep)}</Paper>
      </FormProvider>

      <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
        <Button
          color="inherit"
          disabled={activeStep === 0 || submitting}
          onClick={handleBack}
          sx={{ mr: 1 }}
        >
          Back
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button
          onClick={activeStep === STEPS.length - 1 ? handleSave : handleNext}
          disabled={submitting}
        >
          {submitting ? (
            <CircularProgress size={24} />
          ) : activeStep === STEPS.length - 1 ? (
            'Finish'
          ) : (
            'Next'
          )}
        </Button>
      </Box>
    </Box>
  );
}
