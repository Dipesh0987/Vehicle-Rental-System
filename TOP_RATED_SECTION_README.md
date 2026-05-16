# Top Rated Rental Cars Section

## Overview
The Top Rated Rental Cars section displays dynamically fetched vehicles from the database, organized by brand with interactive filtering.

## Features
- **Dynamic Data**: Fetches real vehicle data from Supabase database
- **NPR Pricing**: All prices displayed in Nepalese Rupees (NPR)
- **Brand Filtering**: Interactive brand pills to filter vehicles by manufacturer
- **Responsive Design**: Fully responsive layout for mobile, tablet, and desktop
- **Modern UI**: Matches reference design with smooth animations and hover effects

## Design Elements
- **Brand Pills**: Orange gradient for active brand, sage gray for inactive
- **Vehicle Cards**: Clean white cards with rounded corners and shadows
- **Fuel Badges**: Display fuel type (Petrol/Diesel/Electric/CNG)
- **Specifications**: Shows seating capacity, transmission type, and fuel type
- **Action Buttons**: 
  - "Details" button: Orange gradient (primary action)
  - "Book Now" button: Sage gray outline (secondary action)

## Data Source
- Fetches from `vehicles` table in Supabase
- Filters by availability and active status
- Sorts by rating (highest first)
- Groups by brand and shows top 3 vehicles per brand

## Technical Implementation
- **File**: `frontend/assets/js/top-rented-redesign.js`
- **Container**: `#homeTopRatedSection` in `frontend/index.html`
- **Styling**: Inline CSS within the JavaScript file
- **Dependencies**: 
  - Supabase client
  - VehicleCatalogService (optional fallback)

## Customization
- `PILL_LIMIT`: Maximum number of brand pills to display (default: 5)
- `CARDS_PER_BRAND`: Number of vehicles to show per brand (default: 3)
- `FALLBACK_IMG`: Default image when vehicle image is unavailable

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Graceful degradation for older browsers
