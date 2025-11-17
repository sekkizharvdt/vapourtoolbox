'use client';

import { Container, Card, CardContent, Typography, Button, Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { Construction as ConstructionIcon } from '@mui/icons-material';

interface ComingSoonCardProps {
  title: string;
  description: string;
}

export default function ComingSoonCard({ title, description }: ComingSoonCardProps) {
  const router = useRouter();

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <ConstructionIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            {title} - Coming Soon
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}
          >
            {description}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button variant="contained" onClick={() => router.push('/materials')}>
              Back to Materials
            </Button>
            <Button variant="outlined" onClick={() => router.push('/materials/plates')}>
              View Plates (Active)
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
