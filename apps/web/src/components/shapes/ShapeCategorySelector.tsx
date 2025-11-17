'use client';

import { List, ListItemButton, ListItemIcon, ListItemText, Chip } from '@mui/material';
import {
  Layers as PlatesIcon,
  Circle as TubesIcon,
  Storage as VesselsIcon,
  DeviceThermostat as HeatExchangerIcon,
  Hub as NozzlesIcon,
} from '@mui/icons-material';

interface ShapeCategorySelectorProps {
  selectedCategory: string | null;
  onCategorySelect: (category: string) => void;
}

const categories = [
  {
    id: 'plates',
    name: 'Plates & Sheets',
    icon: <PlatesIcon />,
    count: 3,
    description: 'Rectangular, circular, and custom plates',
  },
  {
    id: 'tubes',
    name: 'Tubes',
    icon: <TubesIcon />,
    count: 1,
    description: 'Custom fabricated tubes',
  },
  {
    id: 'vessels',
    name: 'Pressure Vessels',
    icon: <VesselsIcon />,
    count: 7,
    description: 'Shells and heads per ASME',
  },
  {
    id: 'heatExchangers',
    name: 'Heat Exchangers',
    icon: <HeatExchangerIcon />,
    count: 4,
    description: 'Tube bundles, baffles, tube sheets',
  },
  {
    id: 'nozzles',
    name: 'Nozzles & Connections',
    icon: <NozzlesIcon />,
    count: 5,
    description: 'Nozzle assemblies with auto-reinforcement',
  },
];

export default function ShapeCategorySelector({
  selectedCategory,
  onCategorySelect,
}: ShapeCategorySelectorProps) {
  return (
    <List>
      {categories.map((category) => (
        <ListItemButton
          key={category.id}
          selected={selectedCategory === category.id}
          onClick={() => onCategorySelect(category.id)}
          sx={{ borderRadius: 1, mb: 1 }}
        >
          <ListItemIcon>{category.icon}</ListItemIcon>
          <ListItemText primary={category.name} secondary={category.description} />
          <Chip label={category.count} size="small" color="primary" />
        </ListItemButton>
      ))}
    </List>
  );
}
