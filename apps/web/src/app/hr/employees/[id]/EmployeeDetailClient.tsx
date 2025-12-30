'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Alert,
  Skeleton,
  IconButton,
  Divider,
  Button,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Email as EmailIcon,
  Bloodtype as BloodIcon,
  Business as BusinessIcon,
  Badge as BadgeIcon,
  Person as PersonIcon,
  Emergency as EmergencyIcon,
  AccountBalance as BankIcon,
  Edit as EditIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewHR, canManageHRSettings } from '@vapour/constants';
import { getEmployeeById } from '@/lib/hr';
import type { EmployeeDetail } from '@vapour/types';

const BLOOD_GROUP_COLORS: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  'A+': 'error',
  'A-': 'error',
  'B+': 'warning',
  'B-': 'warning',
  'AB+': 'info',
  'AB-': 'info',
  'O+': 'success',
  'O-': 'success',
};

interface EmployeeDetailClientProps {
  employeeId: string;
}

export default function EmployeeDetailClient({ employeeId }: EmployeeDetailClientProps) {
  const router = useRouter();
  const { claims } = useAuth();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const permissions2 = claims?.permissions2 ?? 0;
  const hasAccess = canViewHR(permissions2);
  const canEdit = canManageHRSettings(permissions2);
  const claimsLoaded = claims !== undefined;

  useEffect(() => {
    const loadEmployee = async () => {
      // Wait for claims to load before checking access
      if (!claimsLoaded) return;
      if (!hasAccess || !employeeId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getEmployeeById(employeeId);
        if (!data) {
          setError(
            `Employee not found. The user with ID "${employeeId}" may not exist in the system.`
          );
        } else {
          setEmployee(data);
        }
      } catch (err) {
        console.error('Failed to load employee:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load employee profile: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    loadEmployee();
  }, [employeeId, hasAccess, claimsLoaded]);

  const formatDate = (timestamp: { toDate: () => Date } | undefined) => {
    if (!timestamp) return '-';
    return timestamp.toDate().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatAddress = (
    address:
      | {
          line1: string;
          line2?: string;
          city: string;
          state: string;
          postalCode: string;
          country: string;
        }
      | undefined
  ) => {
    if (!address) return null;
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  if (!hasAccess) {
    return (
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Employee Profile
        </Typography>
        <Alert severity="error">You do not have permission to view employee profiles.</Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={24} sx={{ mb: 2 }} />
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rectangular" height={300} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rectangular" height={300} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error || !employee) {
    return (
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            color="inherit"
            href="/hr"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/hr');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            HR
          </Link>
          <Link
            color="inherit"
            href="/hr/employees"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/hr/employees');
            }}
            sx={{ cursor: 'pointer' }}
          >
            Employee Directory
          </Link>
          <Typography color="text.primary">Not Found</Typography>
        </Breadcrumbs>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Employee Profile
        </Typography>
        <Alert severity="error">{error || 'Employee not found.'}</Alert>
      </Box>
    );
  }

  const hrProfile = employee.hrProfile;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/hr"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/hr');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          HR
        </Link>
        <Link
          color="inherit"
          href="/hr/employees"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/hr/employees');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Employee Directory
        </Link>
        <Typography color="text.primary">{employee.displayName}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4">Employee Profile</Typography>
        {canEdit && (
          <Button variant="outlined" startIcon={<EditIcon />} disabled>
            Edit Profile
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Avatar
                src={employee.photoURL}
                alt={employee.displayName}
                sx={{ width: 120, height: 120, mx: 'auto', mb: 2, fontSize: '3rem' }}
              >
                {employee.displayName.charAt(0)}
              </Avatar>
              <Typography variant="h5" gutterBottom>
                {employee.displayName}
              </Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {employee.jobTitle || 'No job title'}
              </Typography>
              {employee.department && (
                <Chip
                  label={employee.department}
                  color="primary"
                  variant="outlined"
                  sx={{ mt: 1 }}
                />
              )}
              {employee.employeeId && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Employee ID: <strong>{employee.employeeId}</strong>
                </Typography>
              )}

              <Divider sx={{ my: 3 }} />

              {/* Quick Contact */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                {employee.mobile && (
                  <IconButton
                    href={`tel:${employee.mobile}`}
                    color="primary"
                    title={employee.mobile}
                  >
                    <PhoneIcon />
                  </IconButton>
                )}
                <IconButton
                  href={`mailto:${employee.email}`}
                  color="primary"
                  title={employee.email}
                >
                  <EmailIcon />
                </IconButton>
              </Box>

              {/* Blood Group */}
              {hrProfile?.bloodGroup && (
                <Box sx={{ mt: 3 }}>
                  <Chip
                    icon={<BloodIcon />}
                    label={`Blood Group: ${hrProfile.bloodGroup}`}
                    color={BLOOD_GROUP_COLORS[hrProfile.bloodGroup] || 'default'}
                    size="medium"
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Details */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Grid container spacing={3}>
            {/* Employment Details */}
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <BusinessIcon color="primary" />
                    <Typography variant="h6">Employment Details</Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Employee ID" value={employee.employeeId} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Department" value={employee.department} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Job Title" value={employee.jobTitle} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Employment Type" value={hrProfile?.employmentType} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow
                        label="Date of Joining"
                        value={formatDate(hrProfile?.dateOfJoining)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Reporting Manager" value={hrProfile?.reportingManagerName} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Status" value={employee.status} />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Personal Details */}
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <PersonIcon color="primary" />
                    <Typography variant="h6">Personal Details</Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Email" value={employee.email} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Mobile" value={employee.mobile} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Personal Email" value={hrProfile?.personalEmail} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Personal Phone" value={hrProfile?.personalPhone} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Date of Birth" value={formatDate(hrProfile?.dateOfBirth)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Gender" value={hrProfile?.gender} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Blood Group" value={hrProfile?.bloodGroup} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Marital Status" value={hrProfile?.maritalStatus} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <InfoRow label="Nationality" value={hrProfile?.nationality} />
                    </Grid>
                  </Grid>

                  {/* Addresses */}
                  {(hrProfile?.currentAddress || hrProfile?.permanentAddress) && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Grid container spacing={2}>
                        {hrProfile?.currentAddress && (
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Current Address
                            </Typography>
                            <Typography variant="body2">
                              {formatAddress(hrProfile.currentAddress)}
                            </Typography>
                          </Grid>
                        )}
                        {hrProfile?.permanentAddress && (
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Permanent Address
                            </Typography>
                            <Typography variant="body2">
                              {formatAddress(hrProfile.permanentAddress)}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Emergency Contact */}
            {hrProfile?.emergencyContact && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <EmergencyIcon color="error" />
                      <Typography variant="h6">Emergency Contact</Typography>
                    </Box>
                    <InfoRow label="Name" value={hrProfile.emergencyContact.name} />
                    <InfoRow label="Relationship" value={hrProfile.emergencyContact.relationship} />
                    <InfoRow label="Phone" value={hrProfile.emergencyContact.phone} />
                    {hrProfile.emergencyContact.alternatePhone && (
                      <InfoRow
                        label="Alternate Phone"
                        value={hrProfile.emergencyContact.alternatePhone}
                      />
                    )}
                    {hrProfile.emergencyContact.email && (
                      <InfoRow label="Email" value={hrProfile.emergencyContact.email} />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Secondary Emergency Contact */}
            {hrProfile?.emergencyContact2 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <EmergencyIcon color="warning" />
                      <Typography variant="h6">Secondary Emergency Contact</Typography>
                    </Box>
                    <InfoRow label="Name" value={hrProfile.emergencyContact2.name} />
                    <InfoRow
                      label="Relationship"
                      value={hrProfile.emergencyContact2.relationship}
                    />
                    <InfoRow label="Phone" value={hrProfile.emergencyContact2.phone} />
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Bank Details (only for HR admins) */}
            {canEdit && hrProfile?.bankDetails && (
              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <BankIcon color="primary" />
                      <Typography variant="h6">Bank Details</Typography>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <InfoRow
                          label="Account Holder"
                          value={hrProfile.bankDetails.accountHolderName}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <InfoRow label="Bank Name" value={hrProfile.bankDetails.bankName} />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <InfoRow
                          label="Account Number"
                          value={hrProfile.bankDetails.accountNumber}
                          masked
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <InfoRow label="IFSC Code" value={hrProfile.bankDetails.ifscCode} />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Government IDs (only for HR admins) */}
            {canEdit && (hrProfile?.panNumber || hrProfile?.aadhaarNumber) && (
              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <BadgeIcon color="primary" />
                      <Typography variant="h6">Government IDs</Typography>
                    </Box>
                    <Grid container spacing={2}>
                      {hrProfile.panNumber && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <InfoRow label="PAN Number" value={hrProfile.panNumber} masked />
                        </Grid>
                      )}
                      {hrProfile.aadhaarNumber && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <InfoRow label="Aadhaar Number" value={hrProfile.aadhaarNumber} masked />
                        </Grid>
                      )}
                      {hrProfile.pfAccountNumber && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <InfoRow label="PF Account Number" value={hrProfile.pfAccountNumber} />
                        </Grid>
                      )}
                      {hrProfile.uanNumber && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <InfoRow label="UAN Number" value={hrProfile.uanNumber} />
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}

// Helper component for displaying info rows
function InfoRow({
  label,
  value,
  masked = false,
}: {
  label: string;
  value: string | undefined | null;
  masked?: boolean;
}) {
  const displayValue = value || '-';
  const maskedValue = masked && value ? value.replace(/.(?=.{4})/g, '*') : displayValue;

  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2">{maskedValue}</Typography>
    </Box>
  );
}
