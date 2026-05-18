# How it Works Section - Feature Documentation

## Overview
The "How it Works" section is an informational component on the landing page that guides visitors through the vehicle rental process in three simple steps.

## Features

### Section Structure
- **Centered Heading**: "How it Works" with optional subtitle
- **Three Sequential Steps**: Displayed horizontally on desktop, vertically on mobile
- **Visual Indicators**: Numbered badges (1, 2, 3) for each step
- **Icons**: Custom SVG icons for each step
- **Descriptions**: Short, user-friendly descriptions for each step
- **Connecting Arrows**: Dashed curved arrows connecting steps (desktop only, vertical on mobile)

### Step Details

#### Step 1: Choose Location
- **Icon**: Location pin (gray background)
- **Title**: "Choose Location"
- **Description**: "Select your pickup location from our available branches"
- **Background**: Light gray (#E0E3DF)

#### Step 2: Pick-Up Date (Active)
- **Icon**: Calendar (orange background - active state)
- **Title**: "Pick-Up Date"
- **Description**: "Select your preferred date and time for vehicle pickup"
- **Background**: Orange/Accent color (#E58C4E)
- **Special**: Features pulsing glow animation to indicate active step

#### Step 3: Book Your Car
- **Icon**: Car (gray background)
- **Title**: "Book Your Car"
- **Description**: "Complete your booking and get instant confirmation"
- **Background**: Light gray (#E0E3DF)

## Design Specifications

### Colors
- **Background**: Light off-white (#F2F3F1) - matches hero panel
- **Primary Text**: Ink color (#0E2528)
- **Secondary Text**: Muted gray (#6C7074)
- **Accent**: Orange (#E58C4E)
- **Step Badge**: Teal/Panel color (#2C766E)
- **Icon Background**: Light gray (#E0E3DF)

### Typography
- **Heading**: 36px (mobile) → 48px (desktop), Bold
- **Subtitle**: 14px (mobile) → 16px (desktop), Medium, Muted
- **Step Title**: 18px (mobile) → 20px (desktop), Semibold
- **Description**: 14px, Regular
- **Font Family**: Poppins

### Spacing & Layout
- **Section Padding**: 16px horizontal, 16px vertical (mobile) → 32px vertical (desktop)
- **Step Gap**: 12px (mobile) → 8px (desktop)
- **Icon Size**: 96px (h-24 w-24)
- **Icon Border Radius**: 20px (rounded-[20px])
- **Max Section Width**: 1390px

### Responsive Breakpoints
- **Mobile First**: Vertical stack with vertical arrows
- **Desktop (lg)**: Horizontal layout with horizontal dashed arrows

## Animations

### Step Card Entrance
- Duration: 600ms (0.6s)
- Easing: ease-out
- Motion: Slide up with fade-in
- Staggered delays: 0s, 0.2s, 0.4s for steps 1, 2, 3 respectively

### Arrow Animation
- **Desktop Arrows**: Horizontal curved dashed lines with moving dash pattern
- **Mobile Arrows**: Vertical curved dashed lines
- Animation: 500ms linear infinite

### Icon Hover Effects
- **Scale**: 1 → 1.1 (10% growth)
- **Shadow**: Enhanced shadow on hover
- **Duration**: 300ms

### Active Step (Step 2) Pulsing Glow
- **Animation**: Radial pulse outward
- **Duration**: 2s infinite
- **Color**: Orange (#E58C4E) with decreasing opacity

### Accessibility
- Respects `prefers-reduced-motion` for users who prefer no animations
- All animations are removed when reduced motion is preferred

## Interactive Features

### JavaScript Module: `how-it-works.js`

#### Methods
- `init()` - Initializes the module and sets up event listeners
- `setupScrollObserver()` - Sets up Intersection Observer for scroll animations
- `setupStepCardInteractions()` - Handles hover effects
- `highlightStep(stepIndex)` - Highlights a specific step on hover
- `removeHighlight()` - Removes all highlights
- `getStepData()` - Returns array of step information
- `trackInteraction(action, stepNumber)` - Tracks user interactions for analytics

#### Events
- Mouse enter/leave on step cards triggers highlight effects
- Scroll detection activates animations when section comes into view

## Accessibility Features
1. **Semantic HTML**: Proper heading hierarchy (h2)
2. **ARIA Labels**: Descriptive text for icons and steps
3. **Focus States**: Visible focus outlines on interactive elements
4. **Color Contrast**: Meets WCAG AA standards
5. **Reduced Motion**: Respects system preferences for motion
6. **Keyboard Navigation**: Steps are accessible via keyboard

## Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

## File Locations
- **HTML**: `frontend/index.html`
- **CSS**: `frontend/assets/css/tailwind.input.css`
- **JavaScript**: `frontend/assets/js/how-it-works.js`

## Integration Notes
- Section is placed after the hero section in the landing page
- Uses Tailwind CSS utility classes for styling
- No external dependencies beyond Tailwind CSS
- JavaScript module initializes automatically on page load

## Future Enhancements
- Add more detailed step information in a modal/drawer
- Connect steps to actual UI flows (location selection, date picker, booking form)
- Add progress tracking if user starts the booking process
- Analytics integration for tracking step interactions
- A/B testing different copy/visuals
- Animation preferences based on user viewport
