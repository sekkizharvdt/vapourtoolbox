'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  Skeleton,
  TextField,
  MenuItem,
  Chip,
  Avatar,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Tooltip,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Bloodtype as BloodIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getAllEmployees, getDepartments } from '@/lib/hr';
import type { EmployeeListItem } from '@vapour/types';

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

export default function EmployeeDirectoryPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [employeesData, departmentsData] = await Promise.all([
        getAllEmployees(),
        getDepartments(),
      ]);
      setEmployees(employeesData);
      setDepartments(departmentsData);
    } catch (err) {
      console.error('Failed to load employees:', err);
      setError('Failed to load employee directory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    let result = employees;

    // Filter by department
    if (selectedDepartment !== 'all') {
      result = result.filter((e) => e.department === selectedDepartment);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.displayName.toLowerCase().includes(query) ||
          e.email.toLowerCase().includes(query) ||
          e.employeeId?.toLowerCase().includes(query) ||
          e.jobTitle?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [employees, selectedDepartment, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const bloodGroupCounts: Record<string, number> = {};
    const departmentCounts: Record<string, number> = {};

    employees.forEach((e) => {
      if (e.bloodGroup) {
        bloodGroupCounts[e.bloodGroup] = (bloodGroupCounts[e.bloodGroup] || 0) + 1;
      }
      if (e.department) {
        departmentCounts[e.department] = (departmentCounts[e.department] || 0) + 1;
      }
    });

    return {
      total: employees.length,
      active: employees.filter((e) => e.isActive).length,
      bloodGroupCounts,
      departmentCounts,
    };
  }, [employees]);

  const formatDate = (timestamp: { toDate: () => Date } | undefined) => {
    if (!timestamp) return '-';
    return timestamp.toDate().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

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
        <Typography color="text.primary">Employee Directory</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Employee Directory
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View employee details, emergency contacts, and blood groups
          </Typography>
        </Box>
        <IconButton onClick={loadData} title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      {!loading && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Total Employees
                </Typography>
                <Typography variant="h3">{stats.total}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.active} active
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Departments
                </Typography>
                <Typography variant="h3">{departments.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Blood Groups
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(stats.bloodGroupCounts).map(([group, count]) => (
                    <Chip
                      key={group}
                      icon={<BloodIcon />}
                      label={`${group}: ${count}`}
                      size="small"
                      color={BLOOD_GROUP_COLORS[group] || 'default'}
                      variant="outlined"
                    />
                  ))}
                  {Object.keys(stats.bloodGroupCounts).length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No blood group data available
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <TextField
          placeholder="Search by name, email, or employee ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{ width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          label="Department"
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          size="small"
          sx={{ width: 200 }}
        >
          <MenuItem value="all">All Departments</MenuItem>
          {departments.map((dept) => (
            <MenuItem key={dept} value={dept}>
              {dept}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={400} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Employee ID</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Job Title</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Blood Group</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      {searchQuery || selectedDepartment !== 'all'
                        ? 'No employees found matching your filters.'
                        : 'No employees found.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee) => (
                  <TableRow key={employee.uid} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={employee.photoURL}
                          alt={employee.displayName}
                          sx={{ width: 36, height: 36 }}
                        >
                          {employee.displayName.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {employee.displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {employee.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {employee.employeeId || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {employee.department ? (
                        <Chip label={employee.department} size="small" variant="outlined" />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{employee.jobTitle || '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {employee.mobile && (
                          <Tooltip title={employee.mobile}>
                            <IconButton
                              size="small"
                              href={`tel:${employee.mobile}`}
                              color="primary"
                            >
                              <PhoneIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={employee.email}>
                          <IconButton
                            size="small"
                            href={`mailto:${employee.email}`}
                            color="primary"
                          >
                            <EmailIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {employee.bloodGroup ? (
                        <Chip
                          icon={<BloodIcon />}
                          label={employee.bloodGroup}
                          size="small"
                          color={BLOOD_GROUP_COLORS[employee.bloodGroup] || 'default'}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(employee.dateOfJoining)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => router.push(`/hr/employees/${employee.uid}`)}
                        title="View Profile"
                      >
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && filteredEmployees.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Showing {filteredEmployees.length} of {employees.length} employees
        </Typography>
      )}
    </Box>
  );
}
