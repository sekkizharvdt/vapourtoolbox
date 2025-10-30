# Responsive Design Guide

**Vapour Toolbox - Desktop-First with Mobile Support**

---

## ✅ Responsive Design - COMPLETE

The Vapour Toolbox UI is **optimized for desktop monitors** with responsive support for tablets and mobile devices when needed.

---

## 📱 Responsive Breakpoints

```typescript
xs: 0px      // Mobile phones (portrait) - 320px to 599px
sm: 600px    // Mobile phones (landscape) / Small tablets
md: 900px    // Tablets / Small laptops
lg: 1200px   // Desktop / Large tablets (landscape)
xl: 1536px   // Large desktop / 4K screens
```

### Device Targeting (Priority Order)

| Device | Breakpoint | Typical Resolution | Layout | Priority |
|--------|------------|-------------------|---------|----------|
| **Desktop Monitor** | lg-xl | 1920×1080+ | 3-4 columns, full sidebar | **PRIMARY** ⭐ |
| **Laptop** | md-lg | 1440×900 | 2-3 columns, full sidebar | **COMMON** |
| **iPad Pro** | md | 1024×1366 | 2 columns, sidebar | Occasional |
| **Tablet** | sm | 744×1133 | 2 columns, side drawer | Occasional |
| **Mobile** | xs | 375-430px | 1 column, bottom nav | **Rare** |

---

## 🖥️ UI Patterns (Desktop-First)

### 1. **Navigation**

#### **Desktop (>900px) - PRIMARY** ⭐
```
┌────────┬─────────────────────────────────────┐
│ [Logo] │ Vapour Toolbox      [🌓][🔔][👤][⚙️] │ ← Header (64px)
├────────┼─────────────────────────────────────┤
│        │                                     │
│ 👥 User │  Dashboard - 3-4 Column Grid       │
│ Mgmt   │  ┌───────┐ ┌───────┐ ┌───────┐     │
│        │  │Module │ │Module │ │Module │     │
│ 🏢 Entity│  │  1    │ │  2    │ │  3    │     │
│ Mgmt   │  └───────┘ └───────┘ └───────┘     │
│        │  ┌───────┐ ┌───────┐ ┌───────┐     │
│ 📋 Proj │  │Module │ │Module │ │Module │     │
│ Mgmt   │  │  4    │ │  5    │ │  6    │     │
│        │  └───────┘ └───────┘ └───────┘     │
│ 🏛️ Co  │                                     │
│ Settings│  Data tables, forms, charts...     │
│        │  All optimized for large screens    │
│━━━━━━━ │                                     │
│        │                                     │
│ ⏱️ Time │                                     │
│ Track  │                                     │
│        │                                     │
│ 💰 Acct │                                     │
│ ounting│                                     │
│        │                                     │
│ 🛒 Proc │                                     │
│ urement│                                     │
│        │                                     │
│ 📊 Estim│                                     │
│ ation  │                                     │
└────────┴─────────────────────────────────────┘
   ↑ Full sidebar (240px) - Always visible
```

**Desktop Features:**
- ✅ Full sidebar always visible (240px)
- ✅ 3-4 column module grid
- ✅ Compact, information-dense layout
- ✅ Hover effects and tooltips
- ✅ Keyboard shortcuts
- ✅ Rich data tables
- ✅ Multi-panel views

#### Tablet (600px - 900px) - Occasional
```
┌──┬──────────────────────┐
│  │ Vapour    [🔔][👤]    │
├──┼──────────────────────┤
│👥│                      │
│📋│  Content Area        │
│💰│  (2 column grid)     │
│⏱️│                      │
│⚙️│                      │
└──┴──────────────────────┘
   ↑ Icon-only (64px)
```

**Tablet Features:**
- Icon-only sidebar
- 2-column layout
- Tooltips for icons

#### Mobile (<600px) - Rare
```
┌─────────────────────────┐
│ [☰] Vapour  [🔔][👤]     │
├─────────────────────────┤
│                         │
│   Content (1 column)    │
│                         │
├─────────────────────────┤
│ [👥][📋][⏱️][💰][⚙️]      │
└─────────────────────────┘
```

**Mobile Features:**
- Hamburger menu
- Bottom nav
- Single column

---

## 🖱️ Desktop Optimization (Primary)

### Standard Desktop Sizing

Components are optimized for **desktop use with mouse/trackpad**:

```typescript
// Buttons (Desktop default)
minHeight: 40px      // Compact, efficient
padding: 8px 16px

// Icon Buttons (Desktop)
padding: 8px         // Standard size

// List Items (Desktop)
minHeight: 48px      // Information-dense
padding: 8px 12px

// Text Fields (Desktop)
minHeight: 40px      // Standard form height

// Mobile (only when needed)
// All elements increase size for touch
minHeight: 48px      // Touch-friendly
```

### Touch-Friendly Spacing

```typescript
// Spacing between elements
gap: 16px           // Prevents mis-taps

// Card padding
padding: 16px       // Adequate touch area

// Button padding
padding: 12px 24px  // Large enough for fingers
```

---

## 📐 Typography (Desktop-Optimized)

### Standard Desktop Typography

Typography is optimized for **desktop readability**:

| Element | Size | Usage |
|---------|------|-------|
| **H1** | 40px (2.5rem) | Page titles |
| **H2** | 32px (2rem) | Section headers |
| **H3** | 28px (1.75rem) | Subsections |
| **H4** | 24px (1.5rem) | Card titles |
| **H5** | 20px (1.25rem) | List headers |
| **H6** | 16px (1rem) | Small headers |
| **Body** | 16px (1rem) | Body text |
| **Caption** | 12px (0.75rem) | Metadata |

**No automatic scaling** - Desktop sizes maintained across all screens for consistency and information density.

### Implementation

```typescript
// Desktop-first - same size everywhere
<Typography variant="h1">Title</Typography>
// Always: 40px (desktop-optimized)
```

---

## 🎯 Responsive Hooks

### Built-in Hooks

```typescript
import {
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsSmallScreen,
  useGridColumns,
  useModuleCardColumns,
  useIsTouchDevice,
  useSidebarWidth,
} from '@vapour/ui';

// Detect device type
const isMobile = useIsMobile();          // <600px
const isTablet = useIsTablet();          // 600-900px
const isDesktop = useIsDesktop();        // >900px
const isSmall = useIsSmallScreen();      // <900px

// Get responsive grid columns
const columns = useGridColumns();         // 1/2/3/4 based on screen
const cardCols = useModuleCardColumns();  // Optimized for module cards

// Touch detection
const isTouch = useIsTouchDevice();

// Sidebar state
const { width, collapsed } = useSidebarWidth();
// Mobile: width=0, collapsed=true
// Tablet: width=64, collapsed=true
// Desktop: width=240, collapsed=false
```

### Usage Examples

```typescript
// Conditional rendering
function MyComponent() {
  const isMobile = useIsMobile();

  return (
    <Box>
      {isMobile ? (
        <MobileView />      // Show on mobile
      ) : (
        <DesktopView />     // Show on desktop
      )}
    </Box>
  );
}

// Responsive props
function DataTable() {
  const isMobile = useIsMobile();

  return (
    <Table
      size={isMobile ? 'small' : 'medium'}
      pagination={isMobile ? 10 : 25}
    />
  );
}

// Responsive grid
function ModuleGrid() {
  const columns = useModuleCardColumns();

  return (
    <Grid container spacing={2}>
      {modules.map(module => (
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <ModuleCard module={module} />
        </Grid>
      ))}
    </Grid>
  );
}
```

---

## 📱 Mobile Layout Patterns

### 1. **Dashboard Home**

```typescript
// Mobile: Vertical stack
<Grid container spacing={2}>
  <Grid item xs={12}>           {/* Stats card */}
  <Grid item xs={12}>           {/* Module card 1 */}
  <Grid item xs={12}>           {/* Module card 2 */}
</Grid>

// Tablet: 2 columns
<Grid container spacing={2}>
  <Grid item xs={12} sm={6}>    {/* 2 per row */}
  <Grid item xs={12} sm={6}>
</Grid>

// Desktop: 3-4 columns
<Grid container spacing={2}>
  <Grid item xs={12} sm={6} md={4} lg={3}>  {/* 3-4 per row */}
</Grid>
```

### 2. **Forms**

```typescript
// Mobile: Full width
<TextField fullWidth />

// Desktop: 2 columns
<Grid container spacing={2}>
  <Grid item xs={12} md={6}>
    <TextField fullWidth />
  </Grid>
  <Grid item xs={12} md={6}>
    <TextField fullWidth />
  </Grid>
</Grid>
```

### 3. **Data Tables**

```typescript
// Mobile: Card view (not table)
const isMobile = useIsMobile();

{isMobile ? (
  <Stack spacing={2}>
    {data.map(item => (
      <Card>
        <CardContent>
          <Typography variant="h6">{item.name}</Typography>
          <Typography variant="body2">{item.details}</Typography>
        </CardContent>
      </Card>
    ))}
  </Stack>
) : (
  <Table>
    {/* Desktop table view */}
  </Table>
)}
```

### 4. **Dialogs/Modals**

```typescript
// Automatically full-screen on mobile
<Dialog
  fullScreen={useIsMobile()}  // Full screen on mobile
  maxWidth="md"
>
  <DialogTitle>Title</DialogTitle>
  <DialogContent>Content</DialogContent>
</Dialog>
```

---

## 🎨 MUI Responsive Props

Material UI components support responsive props:

```typescript
// Grid columns
<Grid
  item
  xs={12}    // Mobile: full width
  sm={6}     // Tablet: half width
  md={4}     // Desktop: 1/3 width
  lg={3}     // Large: 1/4 width
>

// Typography
<Typography
  variant="h4"
  sx={{
    fontSize: { xs: '1.5rem', md: '2rem' }  // Responsive size
  }}
>

// Spacing
<Box
  sx={{
    p: { xs: 2, md: 3 },          // Padding
    mt: { xs: 1, sm: 2, md: 3 }   // Margin top
  }}
>

// Display
<Box
  sx={{
    display: { xs: 'none', md: 'block' }  // Hide on mobile
  }}
>
```

---

## ✅ Mobile UX Best Practices

### Implemented Features

1. **✅ Touch Targets**
   - Minimum 48x48px for all interactive elements
   - Extra padding on buttons and inputs
   - Adequate spacing between tappable elements

2. **✅ Readable Text**
   - Minimum 16px body text (no smaller on mobile)
   - Responsive headings (smaller on mobile)
   - High contrast ratios (WCAG AA)

3. **✅ Simple Navigation**
   - Bottom navigation bar on mobile
   - Hamburger menu for full navigation
   - Icon-only sidebar on tablet

4. **✅ Fast Load Times**
   - No unnecessary assets
   - Lazy loading for components
   - Optimized bundle size

5. **✅ Swipe Gestures**
   - MUI Drawer supports swipe to open/close
   - Native mobile feel

6. **✅ Form Optimization**
   - Large input fields (48px min height)
   - Proper input types (tel, email, number)
   - Auto-complete support

7. **✅ Offline Awareness**
   - Ready for PWA implementation
   - Firebase offline persistence available

---

## 📊 Module Card Responsive Layout

```typescript
// Module cards automatically adapt

// Mobile (xs): 1 column
┌─────────────┐
│ Module 1    │
└─────────────┘
┌─────────────┐
│ Module 2    │
└─────────────┘

// Tablet (sm): 2 columns
┌──────┐ ┌──────┐
│ Mod1 │ │ Mod2 │
└──────┘ └──────┘
┌──────┐ ┌──────┐
│ Mod3 │ │ Mod4 │
└──────┘ └──────┘

// Desktop (lg): 3 columns
┌────┐ ┌────┐ ┌────┐
│ M1 │ │ M2 │ │ M3 │
└────┘ └────┘ └────┘
┌────┐ ┌────┐ ┌────┐
│ M4 │ │ M5 │ │ M6 │
└────┘ └────┘ └────┘

// Large Desktop (xl): 4 columns
┌───┐┌───┐┌───┐┌───┐
│M1 ││M2 ││M3 ││M4 │
└───┘└───┘└───┘└───┘
```

---

## 🧪 Testing on Mobile

### Browser DevTools
```
Chrome DevTools:
1. F12 to open DevTools
2. Click device toggle (Ctrl+Shift+M)
3. Select device: iPhone 12 Pro, iPad, etc.
4. Test different orientations

Devices to test:
- iPhone SE (375px) - Smallest
- iPhone 14 Pro (393px)
- iPad Mini (744px)
- iPad Pro (1024px)
```

### Real Device Testing
```
Local network testing:
1. Run: pnpm dev
2. Note your IP: 192.168.x.x:3000
3. Access from phone on same WiFi
4. Test touch interactions
```

---

## 🎯 Recommended Implementation Order

When building pages/components:

1. **Start with Desktop** (lg/xl) ⭐ **PRIMARY**
   - Design for 1920×1080 first
   - 3-4 column layout
   - Information-dense
   - Full sidebar always visible
   - Rich interactions (hover, keyboard shortcuts)

2. **Adapt for Laptop** (md)
   - 2-3 column layout
   - Maintain full sidebar
   - Optimize spacing

3. **Graceful Tablet Degradation** (sm)
   - 2 column layout
   - Icon-only sidebar
   - Simplify if needed

4. **Mobile Fallback** (xs) - **Only if necessary**
   - Single column
   - Bottom nav
   - Simplified features

**Desktop-first CSS:**
```typescript
// Base (desktop) - Default styling
sx={{
  fontSize: '1.25rem',
  padding: 3,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',

  // Simplify for mobile (rare case)
  [theme.breakpoints.down('md')]: {
    fontSize: '1rem',
    padding: 2,
    gridTemplateColumns: '1fr',
  }
}}
```

---

## ✅ Summary

### Desktop-First Checklist

- ✅ **Desktop-optimized (PRIMARY)** - 1920×1080+ resolution
- ✅ Responsive breakpoints configured
- ✅ Desktop-first CSS approach
- ✅ Compact, information-dense layouts
- ✅ Full sidebar (240px) always visible on desktop
- ✅ 3-4 column grid layouts
- ✅ Standard desktop component sizes (40px buttons, etc.)
- ✅ Responsive utility hooks available
- ✅ Grid system adapts to screen size
- ✅ Graceful degradation for smaller screens
- ✅ Mobile support (when rarely needed)
- ✅ Touch-friendly on mobile (48px targets)
- ✅ No horizontal scrolling
- ✅ High contrast for accessibility
- ✅ Type-safe responsive helpers

**Result: Vapour Toolbox is optimized for desktop monitors with responsive support for occasional tablet/mobile use!** 🖥️✅

---

**Created:** October 27, 2025
**Version:** 1.0
**Status:** Complete
