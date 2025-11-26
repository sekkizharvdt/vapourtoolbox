'use client';

import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  CalendarToday as CalendarIcon,
  CheckCircle as CompletedIcon,
  Schedule as ScheduleIcon,
  LocalShipping as DeliveryIcon,
  Business as VendorIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';
import type { Timestamp } from 'firebase/firestore';
import type { Project } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

interface TimelineTabProps {
  project: Project;
}

interface TimelineEvent {
  id: string;
  date: Date;
  type: 'project' | 'deliverable' | 'procurement' | 'vendor' | 'document';
  title: string;
  description: string;
  status: 'past' | 'upcoming' | 'overdue';
  icon: React.ReactNode;
  color: 'success' | 'primary' | 'error' | 'warning' | 'grey';
}

export function TimelineTab({ project }: TimelineTabProps) {
  const parseDateToObject = (date?: Timestamp | Date | { toDate: () => Date } | string): Date | null => {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === 'object' && 'toDate' in date) return date.toDate();
    if (typeof date === 'string') return new Date(date);
    return null;
  };

  const getDaysDifference = (date: Date): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getEventStatus = (date: Date): 'past' | 'upcoming' | 'overdue' => {
    const days = getDaysDifference(date);
    if (days < 0) return 'overdue';
    if (days > 7) return 'upcoming';
    return 'past';
  };

  // Build timeline events
  const buildTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    const today = new Date();

    // Project dates
    const startDate = parseDateToObject(project.dates?.startDate);
    if (startDate) {
      events.push({
        id: 'project-start',
        date: startDate,
        type: 'project',
        title: 'Project Start Date',
        description: `${project.name} begins`,
        status: startDate < today ? 'past' : 'upcoming',
        icon: <CalendarIcon />,
        color: 'primary',
      });
    }

    const endDate = parseDateToObject(project.dates?.endDate);
    if (endDate) {
      events.push({
        id: 'project-end',
        date: endDate,
        type: 'project',
        title: 'Project End Date',
        description: `Target completion for ${project.name}`,
        status: getEventStatus(endDate),
        icon: <CompletedIcon />,
        color: endDate < today && !project.dates?.actualEndDate ? 'error' : 'success',
      });
    }

    // Charter deliverables
    const deliverables = project.charter?.deliverables || [];
    deliverables.forEach((deliverable) => {
      const dueDate = parseDateToObject(deliverable.dueDate);
      if (dueDate) {
        events.push({
          id: `deliverable-${deliverable.id}`,
          date: dueDate,
          type: 'deliverable',
          title: `Deliverable: ${deliverable.name}`,
          description: deliverable.description,
          status: deliverable.status === 'ACCEPTED' ? 'past' : getEventStatus(dueDate),
          icon: <CompletedIcon />,
          color: deliverable.status === 'ACCEPTED' ? 'success' : 'warning',
        });
      }
    });

    // Procurement items
    const procurementItems = project.procurementItems || [];
    procurementItems.forEach((item) => {
      const requiredDate = parseDateToObject(item.requiredByDate);
      if (requiredDate) {
        events.push({
          id: `procurement-${item.id}`,
          date: requiredDate,
          type: 'procurement',
          title: `Procurement: ${item.itemName}`,
          description: `Required by date for ${item.category}`,
          status: item.status === 'DELIVERED' ? 'past' : getEventStatus(requiredDate),
          icon: <DeliveryIcon />,
          color: item.status === 'DELIVERED' ? 'success' : 'grey',
        });
      }
    });

    // Vendor contracts
    const vendors = project.vendors || [];
    vendors.forEach((vendor) => {
      const contractStart = parseDateToObject(vendor.contractStartDate);
      if (contractStart) {
        events.push({
          id: `vendor-start-${vendor.id}`,
          date: contractStart,
          type: 'vendor',
          title: `Vendor Contract Start: ${vendor.vendorName}`,
          description: vendor.scopeOfWork,
          status: contractStart < today ? 'past' : 'upcoming',
          icon: <VendorIcon />,
          color: 'primary',
        });
      }

      const contractEnd = parseDateToObject(vendor.contractEndDate);
      if (contractEnd) {
        events.push({
          id: `vendor-end-${vendor.id}`,
          date: contractEnd,
          type: 'vendor',
          title: `Vendor Contract End: ${vendor.vendorName}`,
          description: `${vendor.scopeOfWork} - Contract completion`,
          status: vendor.contractStatus === 'COMPLETED' ? 'past' : getEventStatus(contractEnd),
          icon: <VendorIcon />,
          color: vendor.contractStatus === 'COMPLETED' ? 'success' : 'warning',
        });
      }
    });

    // Document requirements
    const documentRequirements = project.documentRequirements || [];
    documentRequirements.forEach((doc) => {
      const dueDate = parseDateToObject(doc.dueDate);
      if (dueDate) {
        events.push({
          id: `document-${doc.id}`,
          date: dueDate,
          type: 'document',
          title: `Document Due: ${doc.documentType}`,
          description: doc.description,
          status: doc.status === 'APPROVED' ? 'past' : getEventStatus(dueDate),
          icon: <DocumentIcon />,
          color: doc.status === 'APPROVED' ? 'success' : 'grey',
        });
      }
    });

    // Sort events by date
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const timelineEvents = buildTimelineEvents();
  const today = new Date();

  // Calculate stats
  const projectStartDate = parseDateToObject(project.dates?.startDate);
  const projectEndDate = parseDateToObject(project.dates?.endDate);
  const totalDuration =
    projectStartDate && projectEndDate
      ? Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
  const elapsedDays =
    projectStartDate && projectStartDate < today
      ? Math.ceil((today.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
  const remainingDays =
    projectEndDate && projectEndDate > today ? getDaysDifference(projectEndDate) : 0;
  const progressPercentage =
    totalDuration > 0 ? Math.min((elapsedDays / totalDuration) * 100, 100).toFixed(1) : '0';

  const upcomingEvents = timelineEvents.filter((e) => e.status === 'upcoming').length;
  const overdueEvents = timelineEvents.filter((e) => e.status === 'overdue').length;

  return (
    <Box>
      {/* Timeline Overview Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Duration
              </Typography>
              <Typography variant="h4">{totalDuration}</Typography>
              <Typography variant="caption">days</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Days Elapsed
              </Typography>
              <Typography variant="h4">{elapsedDays}</Typography>
              <Typography variant="caption">since start</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{ bgcolor: remainingDays < 30 && remainingDays > 0 ? 'warning.light' : undefined }}
          >
            <CardContent>
              <Typography variant="body2" gutterBottom>
                Days Remaining
              </Typography>
              <Typography variant="h4">{remainingDays > 0 ? remainingDays : 0}</Typography>
              <Typography variant="caption">until end date</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Progress
              </Typography>
              <Typography variant="h4">{progressPercentage}%</Typography>
              <Typography variant="caption">time elapsed</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Project Dates Summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Project Dates
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2" color="text.secondary">
              Planned Start
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatDate(project.dates?.startDate)}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2" color="text.secondary">
              Planned End
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatDate(project.dates?.endDate)}
            </Typography>
          </Grid>

          {project.dates?.actualStartDate && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Actual Start
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {formatDate(project.dates.actualStartDate)}
              </Typography>
            </Grid>
          )}

          {project.dates?.actualEndDate && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Actual End
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {formatDate(project.dates.actualEndDate)}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Alerts */}
      {overdueEvents > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {overdueEvents} overdue event{overdueEvents > 1 ? 's' : ''} requiring attention!
        </Alert>
      )}

      {/* Timeline Visualization */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Project Timeline</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip label={`${upcomingEvents} Upcoming`} size="small" color="primary" />
            {overdueEvents > 0 && (
              <Chip label={`${overdueEvents} Overdue`} size="small" color="error" />
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {timelineEvents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <ScheduleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              No timeline events defined yet. Add deliverables, procurement items, vendor contracts,
              or document requirements with due dates to populate the timeline.
            </Typography>
          </Box>
        ) : (
          <Timeline position="right">
            {timelineEvents.map((event, index) => (
              <TimelineItem key={event.id}>
                <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.3 }}>
                  <Typography variant="body2" fontWeight="medium">
                    {formatDate(event.date)}
                  </Typography>
                  <Typography variant="caption">
                    {getDaysDifference(event.date) === 0
                      ? 'Today'
                      : getDaysDifference(event.date) > 0
                        ? `In ${getDaysDifference(event.date)} days`
                        : `${Math.abs(getDaysDifference(event.date))} days ago`}
                  </Typography>
                </TimelineOppositeContent>

                <TimelineSeparator>
                  <TimelineDot color={event.color}>{event.icon}</TimelineDot>
                  {index < timelineEvents.length - 1 && <TimelineConnector />}
                </TimelineSeparator>

                <TimelineContent>
                  <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
                    <Typography variant="body1" fontWeight="medium" gutterBottom>
                      {event.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {event.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Chip label={event.type.toUpperCase()} size="small" variant="outlined" />
                      {event.status === 'overdue' && (
                        <Chip label="OVERDUE" size="small" color="error" />
                      )}
                    </Box>
                  </Paper>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </Paper>

      {/* Future Enhancements Note */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2" fontWeight="medium" gutterBottom>
          Timeline Enhancements
        </Typography>
        <Typography variant="body2">
          Future enhancements will include: Gantt chart visualization, milestone management with
          CRUD operations, dependency tracking, critical path analysis, and drag-and-drop timeline
          editing.
        </Typography>
      </Alert>
    </Box>
  );
}
