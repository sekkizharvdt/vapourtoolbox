'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Divider,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  Collapse,
} from '@mui/material';
import {
  CheckCircle as BidIcon,
  Cancel as NoBidIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { recordBidDecision, reviseBidDecision } from '@/lib/enquiry/enquiryService';
import type {
  BidDecision,
  BidEvaluationCriteria,
  Enquiry,
} from '@vapour/types';
import {
  STRATEGIC_ALIGNMENT_LABELS,
  WIN_PROBABILITY_LABELS,
  COMMERCIAL_VIABILITY_LABELS,
  RISK_EXPOSURE_LABELS,
  CAPACITY_CAPABILITY_LABELS,
} from '@vapour/types';

interface BidDecisionDialogProps {
  open: boolean;
  onClose: () => void;
  enquiry: Enquiry;
  onSuccess: (updatedEnquiry: Enquiry) => void;
  /** If true, this is revising an existing decision */
  isRevision?: boolean;
}

type StrategicAlignmentRating = BidEvaluationCriteria['strategicAlignment']['rating'];
type WinProbabilityRating = BidEvaluationCriteria['winProbability']['rating'];
type CommercialViabilityRating = BidEvaluationCriteria['commercialViability']['rating'];
type RiskExposureRating = BidEvaluationCriteria['riskExposure']['rating'];
type CapacityCapabilityRating = BidEvaluationCriteria['capacityCapability']['rating'];

export function BidDecisionDialog({
  open,
  onClose,
  enquiry,
  onSuccess,
  isRevision = false,
}: BidDecisionDialogProps) {
  const db = useFirestore();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Decision
  const [decision, setDecision] = useState<BidDecision | ''>('');

  // Evaluation criteria
  const [strategicAlignment, setStrategicAlignment] = useState<StrategicAlignmentRating | ''>('');
  const [strategicAlignmentNotes, setStrategicAlignmentNotes] = useState('');
  const [winProbability, setWinProbability] = useState<WinProbabilityRating | ''>('');
  const [winProbabilityNotes, setWinProbabilityNotes] = useState('');
  const [commercialViability, setCommercialViability] = useState<CommercialViabilityRating | ''>('');
  const [commercialViabilityNotes, setCommercialViabilityNotes] = useState('');
  const [riskExposure, setRiskExposure] = useState<RiskExposureRating | ''>('');
  const [riskExposureNotes, setRiskExposureNotes] = useState('');
  const [capacityCapability, setCapacityCapability] = useState<CapacityCapabilityRating | ''>('');
  const [capacityCapabilityNotes, setCapacityCapabilityNotes] = useState('');

  // Rationale
  const [rationale, setRationale] = useState('');

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    strategic: true,
    win: true,
    commercial: true,
    risk: true,
    capacity: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!decision) {
      setError('Please select a bid decision (Bid or No Bid)');
      return;
    }
    if (!strategicAlignment) {
      setError('Please rate Strategic Alignment');
      return;
    }
    if (!winProbability) {
      setError('Please rate Win Probability');
      return;
    }
    if (!commercialViability) {
      setError('Please rate Commercial Viability');
      return;
    }
    if (!riskExposure) {
      setError('Please rate Risk Exposure');
      return;
    }
    if (!capacityCapability) {
      setError('Please rate Capacity & Capability');
      return;
    }
    if (!rationale.trim()) {
      setError('Please provide a rationale for your decision');
      return;
    }

    if (!db || !user?.uid) {
      setError('Authentication required');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const evaluation: BidEvaluationCriteria = {
        strategicAlignment: {
          rating: strategicAlignment,
          notes: strategicAlignmentNotes || undefined,
        },
        winProbability: {
          rating: winProbability,
          notes: winProbabilityNotes || undefined,
        },
        commercialViability: {
          rating: commercialViability,
          notes: commercialViabilityNotes || undefined,
        },
        riskExposure: {
          rating: riskExposure,
          notes: riskExposureNotes || undefined,
        },
        capacityCapability: {
          rating: capacityCapability,
          notes: capacityCapabilityNotes || undefined,
        },
      };

      // Use appropriate service based on whether this is a revision
      const updatedEnquiry = isRevision
        ? await reviseBidDecision(
            db,
            enquiry.id,
            decision,
            evaluation,
            rationale,
            user.uid,
            user.displayName || 'Unknown User'
          )
        : await recordBidDecision(
            db,
            enquiry.id,
            decision,
            evaluation,
            rationale,
            user.uid,
            user.displayName || 'Unknown User'
          );

      onSuccess(updatedEnquiry);
      handleClose();
    } catch (err) {
      console.error('Error recording bid decision:', err);
      setError(err instanceof Error ? err.message : 'Failed to record bid decision');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setDecision('');
    setStrategicAlignment('');
    setStrategicAlignmentNotes('');
    setWinProbability('');
    setWinProbabilityNotes('');
    setCommercialViability('');
    setCommercialViabilityNotes('');
    setRiskExposure('');
    setRiskExposureNotes('');
    setCapacityCapability('');
    setCapacityCapabilityNotes('');
    setRationale('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isRevision ? 'Revise Bid Decision' : 'Bid/No-Bid Decision'}
        <Typography variant="body2" color="text.secondary">
          {enquiry.enquiryNumber} - {enquiry.title}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 2 }}>
            Complete the evaluation criteria below, then make your final Bid/No-Bid decision at the end.
          </Alert>

          <Typography variant="h6" gutterBottom>
            Evaluation Criteria
          </Typography>

          {/* Strategic Alignment */}
          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                cursor: 'pointer',
              }}
              onClick={() => toggleSection('strategic')}
            >
              <Typography variant="subtitle1" fontWeight="medium">
                1. Strategic Alignment
              </Typography>
              {expandedSections.strategic ? <CollapseIcon /> : <ExpandIcon />}
            </Box>
            <Collapse in={expandedSections.strategic}>
              <Box sx={{ px: 2, pb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Does this opportunity align with our long-term strategy, core competencies, and target market positioning?
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth required>
                      <InputLabel>Rating</InputLabel>
                      <Select
                        value={strategicAlignment}
                        onChange={(e) => setStrategicAlignment(e.target.value as StrategicAlignmentRating)}
                        label="Rating"
                      >
                        {Object.entries(STRATEGIC_ALIGNMENT_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Notes (optional)"
                      value={strategicAlignmentNotes}
                      onChange={(e) => setStrategicAlignmentNotes(e.target.value)}
                      multiline
                      rows={2}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Paper>

          {/* Win Probability */}
          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                cursor: 'pointer',
              }}
              onClick={() => toggleSection('win')}
            >
              <Typography variant="subtitle1" fontWeight="medium">
                2. Win Probability
              </Typography>
              {expandedSections.win ? <CollapseIcon /> : <ExpandIcon />}
            </Box>
            <Collapse in={expandedSections.win}>
              <Box sx={{ px: 2, pb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Do we have a clear, defensible advantage that gives us a realistic probability of winning?
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth required>
                      <InputLabel>Rating</InputLabel>
                      <Select
                        value={winProbability}
                        onChange={(e) => setWinProbability(e.target.value as WinProbabilityRating)}
                        label="Rating"
                      >
                        {Object.entries(WIN_PROBABILITY_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Notes (optional)"
                      value={winProbabilityNotes}
                      onChange={(e) => setWinProbabilityNotes(e.target.value)}
                      multiline
                      rows={2}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Paper>

          {/* Commercial Viability */}
          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                cursor: 'pointer',
              }}
              onClick={() => toggleSection('commercial')}
            >
              <Typography variant="subtitle1" fontWeight="medium">
                3. Commercial Viability
              </Typography>
              {expandedSections.commercial ? <CollapseIcon /> : <ExpandIcon />}
            </Box>
            <Collapse in={expandedSections.commercial}>
              <Box sx={{ px: 2, pb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Will this bid deliver acceptable margins, cash flow, and return on resources invested?
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth required>
                      <InputLabel>Rating</InputLabel>
                      <Select
                        value={commercialViability}
                        onChange={(e) => setCommercialViability(e.target.value as CommercialViabilityRating)}
                        label="Rating"
                      >
                        {Object.entries(COMMERCIAL_VIABILITY_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Notes (optional)"
                      value={commercialViabilityNotes}
                      onChange={(e) => setCommercialViabilityNotes(e.target.value)}
                      multiline
                      rows={2}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Paper>

          {/* Risk Exposure */}
          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                cursor: 'pointer',
              }}
              onClick={() => toggleSection('risk')}
            >
              <Typography variant="subtitle1" fontWeight="medium">
                4. Risk Exposure
              </Typography>
              {expandedSections.risk ? <CollapseIcon /> : <ExpandIcon />}
            </Box>
            <Collapse in={expandedSections.risk}>
              <Box sx={{ px: 2, pb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Are the technical, contractual, financial, and execution risks understood and manageable?
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth required>
                      <InputLabel>Rating</InputLabel>
                      <Select
                        value={riskExposure}
                        onChange={(e) => setRiskExposure(e.target.value as RiskExposureRating)}
                        label="Rating"
                      >
                        {Object.entries(RISK_EXPOSURE_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Notes (optional)"
                      value={riskExposureNotes}
                      onChange={(e) => setRiskExposureNotes(e.target.value)}
                      multiline
                      rows={2}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Paper>

          {/* Capacity & Capability */}
          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                cursor: 'pointer',
              }}
              onClick={() => toggleSection('capacity')}
            >
              <Typography variant="subtitle1" fontWeight="medium">
                5. Capacity & Capability
              </Typography>
              {expandedSections.capacity ? <CollapseIcon /> : <ExpandIcon />}
            </Box>
            <Collapse in={expandedSections.capacity}>
              <Box sx={{ px: 2, pb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Do we have the internal capacity, skills, and delivery bandwidth to execute successfully?
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth required>
                      <InputLabel>Rating</InputLabel>
                      <Select
                        value={capacityCapability}
                        onChange={(e) => setCapacityCapability(e.target.value as CapacityCapabilityRating)}
                        label="Rating"
                      >
                        {Object.entries(CAPACITY_CAPABILITY_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Notes (optional)"
                      value={capacityCapabilityNotes}
                      onChange={(e) => setCapacityCapabilityNotes(e.target.value)}
                      multiline
                      rows={2}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Paper>

          <Divider sx={{ my: 2 }} />

          {/* Rationale */}
          <Typography variant="h6" gutterBottom>
            Decision Rationale
          </Typography>
          <TextField
            fullWidth
            required
            label="Rationale"
            placeholder="Provide a summary explaining your bid decision..."
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            multiline
            rows={4}
            helperText="Required - Explain the key factors behind this decision"
          />

          <Divider sx={{ my: 3 }} />

          {/* Final Decision Selection - moved to end */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography variant="h6" gutterBottom>
              Final Decision
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Based on your evaluation above, select your bid decision:
            </Typography>
            <RadioGroup
              row
              value={decision}
              onChange={(e) => setDecision(e.target.value as BidDecision)}
            >
              <FormControlLabel
                value="BID"
                control={<Radio color="success" />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BidIcon color="success" />
                    <Typography>Bid - Proceed with Proposal</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="NO_BID"
                control={<Radio color="error" />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <NoBidIcon color="error" />
                    <Typography>No Bid - Decline Opportunity</Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          color={decision === 'NO_BID' ? 'error' : 'primary'}
        >
          {submitting
            ? 'Recording...'
            : decision === 'NO_BID'
              ? 'Confirm No Bid'
              : decision === 'BID'
                ? 'Confirm Bid Decision'
                : 'Record Decision'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
