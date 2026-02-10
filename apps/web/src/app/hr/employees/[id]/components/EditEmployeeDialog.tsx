'use client';

/**
 * Edit Employee Dialog
 *
 * Dialog for editing employee profile information.
 * Only available to users with MANAGE_USERS permission.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Typography,
  Divider,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { updateEmployeeHRProfile, updateEmployeeBasicInfo } from '@/lib/hr';
import { getDepartmentOptions } from '@vapour/constants';
import type {
  EmployeeDetail,
  BloodGroup,
  Gender,
  MaritalStatus,
  EmploymentType,
  EmployeeAddress,
  EmergencyContact,
  EmployeeBankDetails,
} from '@vapour/types';

interface EditEmployeeDialogProps {
  open: boolean;
  employee: EmployeeDetail;
  onClose: () => void;
  onSuccess: () => void;
}

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'];
const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
const MARITAL_STATUSES: MaritalStatus[] = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER'];
const EMPLOYMENT_TYPES: EmploymentType[] = [
  'PERMANENT',
  'CONTRACT',
  'PROBATION',
  'INTERN',
  'CONSULTANT',
];

export function EditEmployeeDialog({
  open,
  employee,
  onClose,
  onSuccess,
}: EditEmployeeDialogProps) {
  const { user, claims } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Accordion expansion state
  const [expandedSection, setExpandedSection] = useState<string | false>('employment');

  // Basic Info (from User document)
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');

  // Employment Details (from hrProfile)
  const [employeeId, setEmployeeId] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [reportingManagerName, setReportingManagerName] = useState('');

  // Personal Details
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | ''>('');
  const [nationality, setNationality] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');

  // Current Address
  const [currentAddressLine1, setCurrentAddressLine1] = useState('');
  const [currentAddressLine2, setCurrentAddressLine2] = useState('');
  const [currentCity, setCurrentCity] = useState('');
  const [currentState, setCurrentState] = useState('');
  const [currentPostalCode, setCurrentPostalCode] = useState('');
  const [currentCountry, setCurrentCountry] = useState('India');

  // Permanent Address
  const [permanentAddressLine1, setPermanentAddressLine1] = useState('');
  const [permanentAddressLine2, setPermanentAddressLine2] = useState('');
  const [permanentCity, setPermanentCity] = useState('');
  const [permanentState, setPermanentState] = useState('');
  const [permanentPostalCode, setPermanentPostalCode] = useState('');
  const [permanentCountry, setPermanentCountry] = useState('India');

  // Emergency Contact
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyAlternatePhone, setEmergencyAlternatePhone] = useState('');
  const [emergencyEmail, setEmergencyEmail] = useState('');

  // Bank Details
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');

  // Government IDs
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [pfAccountNumber, setPfAccountNumber] = useState('');
  const [uanNumber, setUanNumber] = useState('');

  // Initialize form when employee changes
  useEffect(() => {
    if (employee && open) {
      const hp = employee.hrProfile;

      // Basic Info
      setJobTitle(employee.jobTitle || '');
      setDepartment(employee.department || '');
      setPhone(employee.phone || '');
      setMobile(employee.mobile || '');

      // Employment Details
      setEmployeeId(hp?.employeeId || '');
      setEmploymentType(hp?.employmentType || '');
      setDateOfJoining(hp?.dateOfJoining ? formatDateForInput(hp.dateOfJoining) : '');
      setReportingManagerName(hp?.reportingManagerName || '');

      // Personal Details
      setDateOfBirth(hp?.dateOfBirth ? formatDateForInput(hp.dateOfBirth) : '');
      setGender(hp?.gender || '');
      setBloodGroup(hp?.bloodGroup || '');
      setMaritalStatus(hp?.maritalStatus || '');
      setNationality(hp?.nationality || '');
      setPersonalEmail(hp?.personalEmail || '');
      setPersonalPhone(hp?.personalPhone || '');

      // Current Address
      if (hp?.currentAddress) {
        setCurrentAddressLine1(hp.currentAddress.line1 || '');
        setCurrentAddressLine2(hp.currentAddress.line2 || '');
        setCurrentCity(hp.currentAddress.city || '');
        setCurrentState(hp.currentAddress.state || '');
        setCurrentPostalCode(hp.currentAddress.postalCode || '');
        setCurrentCountry(hp.currentAddress.country || 'India');
      }

      // Permanent Address
      if (hp?.permanentAddress) {
        setPermanentAddressLine1(hp.permanentAddress.line1 || '');
        setPermanentAddressLine2(hp.permanentAddress.line2 || '');
        setPermanentCity(hp.permanentAddress.city || '');
        setPermanentState(hp.permanentAddress.state || '');
        setPermanentPostalCode(hp.permanentAddress.postalCode || '');
        setPermanentCountry(hp.permanentAddress.country || 'India');
      }

      // Emergency Contact
      if (hp?.emergencyContact) {
        setEmergencyName(hp.emergencyContact.name || '');
        setEmergencyRelationship(hp.emergencyContact.relationship || '');
        setEmergencyPhone(hp.emergencyContact.phone || '');
        setEmergencyAlternatePhone(hp.emergencyContact.alternatePhone || '');
        setEmergencyEmail(hp.emergencyContact.email || '');
      }

      // Bank Details
      if (hp?.bankDetails) {
        setBankAccountNumber(hp.bankDetails.accountNumber || '');
        setBankName(hp.bankDetails.bankName || '');
        setBankIfsc(hp.bankDetails.ifscCode || '');
        setBankAccountHolder(hp.bankDetails.accountHolderName || '');
      }

      // Government IDs
      setPanNumber(hp?.panNumber || '');
      setAadhaarNumber(hp?.aadhaarNumber || '');
      setPfAccountNumber(hp?.pfAccountNumber || '');
      setUanNumber(hp?.uanNumber || '');

      setSaveSuccess(false);
      setError('');
    }
  }, [employee, open]);

  const formatDateForInput = (timestamp: { toDate: () => Date }): string => {
    const date = timestamp.toDate();
    const parts = date.toISOString().split('T');
    return parts[0] || '';
  };

  const parseInputDate = (dateStr: string): Timestamp | undefined => {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    return Timestamp.fromDate(date);
  };

  const handleAccordionChange =
    (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedSection(isExpanded ? panel : false);
    };

  const buildAddress = (
    line1: string,
    line2: string,
    city: string,
    state: string,
    postalCode: string,
    country: string
  ): EmployeeAddress | undefined => {
    if (!line1 && !city) return undefined;
    return {
      line1: line1.trim(),
      line2: line2.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
      country: country.trim(),
    };
  };

  const buildEmergencyContact = (): EmergencyContact | undefined => {
    if (!emergencyName || !emergencyPhone) return undefined;
    return {
      name: emergencyName.trim(),
      relationship: emergencyRelationship.trim(),
      phone: emergencyPhone.trim(),
      alternatePhone: emergencyAlternatePhone.trim() || undefined,
      email: emergencyEmail.trim() || undefined,
    };
  };

  const buildBankDetails = (): EmployeeBankDetails | undefined => {
    if (!bankAccountNumber || !bankName || !bankIfsc) return undefined;
    return {
      accountNumber: bankAccountNumber.trim(),
      bankName: bankName.trim(),
      ifscCode: bankIfsc.trim().toUpperCase(),
      accountHolderName: bankAccountHolder.trim(),
    };
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      // Update basic info
      const auditor = { userName: user.displayName || '', userEmail: user.email || '' };
      await updateEmployeeBasicInfo(
        employee.uid,
        {
          phone: phone.trim() || undefined,
          mobile: mobile.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          department: department || undefined,
        },
        user.uid,
        auditor,
        claims?.permissions2
      );

      // Build HR profile update - strip undefined values for Firestore
      const hrProfileUpdate: Record<string, unknown> = {};

      if (employeeId.trim()) hrProfileUpdate.employeeId = employeeId.trim();
      if (employmentType) hrProfileUpdate.employmentType = employmentType;
      if (dateOfJoining) hrProfileUpdate.dateOfJoining = parseInputDate(dateOfJoining);
      if (reportingManagerName.trim())
        hrProfileUpdate.reportingManagerName = reportingManagerName.trim();
      if (dateOfBirth) hrProfileUpdate.dateOfBirth = parseInputDate(dateOfBirth);
      if (gender) hrProfileUpdate.gender = gender;
      if (bloodGroup) hrProfileUpdate.bloodGroup = bloodGroup;
      if (maritalStatus) hrProfileUpdate.maritalStatus = maritalStatus;
      if (nationality.trim()) hrProfileUpdate.nationality = nationality.trim();
      if (personalEmail.trim()) hrProfileUpdate.personalEmail = personalEmail.trim();
      if (personalPhone.trim()) hrProfileUpdate.personalPhone = personalPhone.trim();

      const currentAddr = buildAddress(
        currentAddressLine1,
        currentAddressLine2,
        currentCity,
        currentState,
        currentPostalCode,
        currentCountry
      );
      if (currentAddr) hrProfileUpdate.currentAddress = currentAddr;

      const permanentAddr = buildAddress(
        permanentAddressLine1,
        permanentAddressLine2,
        permanentCity,
        permanentState,
        permanentPostalCode,
        permanentCountry
      );
      if (permanentAddr) hrProfileUpdate.permanentAddress = permanentAddr;

      const emergencyContact = buildEmergencyContact();
      if (emergencyContact) hrProfileUpdate.emergencyContact = emergencyContact;

      const bankDetails = buildBankDetails();
      if (bankDetails) hrProfileUpdate.bankDetails = bankDetails;

      if (panNumber.trim()) hrProfileUpdate.panNumber = panNumber.trim().toUpperCase();
      if (aadhaarNumber.trim()) hrProfileUpdate.aadhaarNumber = aadhaarNumber.trim();
      if (pfAccountNumber.trim()) hrProfileUpdate.pfAccountNumber = pfAccountNumber.trim();
      if (uanNumber.trim()) hrProfileUpdate.uanNumber = uanNumber.trim();

      // Update HR profile
      await updateEmployeeHRProfile(
        employee.uid,
        hrProfileUpdate,
        user.uid,
        auditor,
        claims?.permissions2
      );

      setSaveSuccess(true);

      // Auto-close after showing success message
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: unknown) {
      console.error('Error updating employee:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update employee. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !saveSuccess) {
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Employee Profile</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <strong>Employee profile updated successfully!</strong>
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          {/* Basic Info */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Basic Information
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Email"
              value={employee.email}
              disabled
              fullWidth
              size="small"
              helperText="Email cannot be changed"
            />
            <TextField
              label="Display Name"
              value={employee.displayName}
              disabled
              fullWidth
              size="small"
              helperText="Name is managed in user settings"
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <TextField
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              fullWidth
              size="small"
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <TextField
              label="Job Title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              fullWidth
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select
                value={department}
                label="Department"
                onChange={(e) => setDepartment(e.target.value)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {getDepartmentOptions().map((dept) => (
                  <MenuItem key={dept.value} value={dept.value}>
                    {dept.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* Employment Details Accordion */}
          <Accordion
            expanded={expandedSection === 'employment'}
            onChange={handleAccordionChange('employment')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Employment Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="Employee ID"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="e.g., VDT-001"
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Employment Type</InputLabel>
                  <Select
                    value={employmentType}
                    label="Employment Type"
                    onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                  >
                    <MenuItem value="">
                      <em>Not Set</em>
                    </MenuItem>
                    {EMPLOYMENT_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type.charAt(0) + type.slice(1).toLowerCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Date of Joining"
                  type="date"
                  value={dateOfJoining}
                  onChange={(e) => setDateOfJoining(e.target.value)}
                  fullWidth
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Reporting Manager"
                  value={reportingManagerName}
                  onChange={(e) => setReportingManagerName(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Personal Details Accordion */}
          <Accordion
            expanded={expandedSection === 'personal'}
            onChange={handleAccordionChange('personal')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Personal Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="Date of Birth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  fullWidth
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Gender</InputLabel>
                  <Select
                    value={gender}
                    label="Gender"
                    onChange={(e) => setGender(e.target.value as Gender)}
                  >
                    <MenuItem value="">
                      <em>Not Set</em>
                    </MenuItem>
                    {GENDERS.map((g) => (
                      <MenuItem key={g} value={g}>
                        {g.replace(/_/g, ' ').charAt(0) +
                          g.replace(/_/g, ' ').slice(1).toLowerCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Blood Group</InputLabel>
                  <Select
                    value={bloodGroup}
                    label="Blood Group"
                    onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                  >
                    <MenuItem value="">
                      <em>Not Set</em>
                    </MenuItem>
                    {BLOOD_GROUPS.map((bg) => (
                      <MenuItem key={bg} value={bg}>
                        {bg}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Marital Status</InputLabel>
                  <Select
                    value={maritalStatus}
                    label="Marital Status"
                    onChange={(e) => setMaritalStatus(e.target.value as MaritalStatus)}
                  >
                    <MenuItem value="">
                      <em>Not Set</em>
                    </MenuItem>
                    {MARITAL_STATUSES.map((ms) => (
                      <MenuItem key={ms} value={ms}>
                        {ms.charAt(0) + ms.slice(1).toLowerCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="Nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Personal Email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  fullWidth
                  size="small"
                  type="email"
                />
              </Stack>
              <TextField
                label="Personal Phone"
                value={personalPhone}
                onChange={(e) => setPersonalPhone(e.target.value)}
                fullWidth
                size="small"
              />
            </AccordionDetails>
          </Accordion>

          {/* Addresses Accordion */}
          <Accordion
            expanded={expandedSection === 'addresses'}
            onChange={handleAccordionChange('addresses')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Addresses</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Current Address
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="Address Line 1"
                  value={currentAddressLine1}
                  onChange={(e) => setCurrentAddressLine1(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Address Line 2"
                  value={currentAddressLine2}
                  onChange={(e) => setCurrentAddressLine2(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <TextField
                  label="City"
                  value={currentCity}
                  onChange={(e) => setCurrentCity(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="State"
                  value={currentState}
                  onChange={(e) => setCurrentState(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Postal Code"
                  value={currentPostalCode}
                  onChange={(e) => setCurrentPostalCode(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Country"
                  value={currentCountry}
                  onChange={(e) => setCurrentCountry(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Permanent Address
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="Address Line 1"
                  value={permanentAddressLine1}
                  onChange={(e) => setPermanentAddressLine1(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Address Line 2"
                  value={permanentAddressLine2}
                  onChange={(e) => setPermanentAddressLine2(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="City"
                  value={permanentCity}
                  onChange={(e) => setPermanentCity(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="State"
                  value={permanentState}
                  onChange={(e) => setPermanentState(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Postal Code"
                  value={permanentPostalCode}
                  onChange={(e) => setPermanentPostalCode(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Country"
                  value={permanentCountry}
                  onChange={(e) => setPermanentCountry(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Emergency Contact Accordion */}
          <Accordion
            expanded={expandedSection === 'emergency'}
            onChange={handleAccordionChange('emergency')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Emergency Contact</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="Contact Name"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Relationship"
                  value={emergencyRelationship}
                  onChange={(e) => setEmergencyRelationship(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="e.g., Spouse, Parent, Sibling"
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="Phone"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Alternate Phone"
                  value={emergencyAlternatePhone}
                  onChange={(e) => setEmergencyAlternatePhone(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>
              <TextField
                label="Email"
                value={emergencyEmail}
                onChange={(e) => setEmergencyEmail(e.target.value)}
                fullWidth
                size="small"
                type="email"
              />
            </AccordionDetails>
          </Accordion>

          {/* Bank Details Accordion */}
          <Accordion expanded={expandedSection === 'bank'} onChange={handleAccordionChange('bank')}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Bank Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                Bank details are used for salary and reimbursement processing.
              </Alert>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="Account Holder Name"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Bank Name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Account Number"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="IFSC Code"
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                  fullWidth
                  size="small"
                  placeholder="e.g., SBIN0001234"
                />
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Government IDs Accordion */}
          <Accordion
            expanded={expandedSection === 'govIds'}
            onChange={handleAccordionChange('govIds')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Government IDs</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="PAN Number"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  fullWidth
                  size="small"
                  placeholder="e.g., ABCDE1234F"
                />
                <TextField
                  label="Aadhaar Number"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="12 digit number"
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="PF Account Number"
                  value={pfAccountNumber}
                  onChange={(e) => setPfAccountNumber(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="UAN Number"
                  value={uanNumber}
                  onChange={(e) => setUanNumber(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading || saveSuccess}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || saveSuccess}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
