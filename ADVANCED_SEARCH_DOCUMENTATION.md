# Advanced Vehicle Rental Search System

## Overview

The Advanced Vehicle Rental Search System is a professional, feature-rich search and filtering platform for vehicle rentals. It provides users with powerful tools to find the perfect vehicle quickly and efficiently.

## Key Features

### Search Capabilities
- **Top Search Bar**: Pickup/drop-off locations with datetime pickers
- **Quick Filters**: Preset buttons for budget, family, luxury, and eco-friendly options
- **Advanced Filtering**: 12+ filtering categories with real-time results
- **Sorting Options**: Sort by relevance, price, rating, or newest

### Filter Categories

#### 1. Vehicle Type
- Economy
- Sedan
- SUV
- Luxury
- Van

#### 2. Transmission
- Manual
- Automatic

#### 3. Fuel Type
- Petrol
- Diesel
- Electric
- Hybrid

#### 4. Price Range
- Configurable daily rate filter ($0-$500)
- Real-time price updates

#### 5. Seating Capacity
- Range from 1-9 seats
- Real-time filtering

#### 6. User Rating
- 0-5 star filter
- Shows only rated vehicles

#### 7. Features & Amenities
- Air Conditioning
- GPS Navigation
- Bluetooth
- Reverse Camera
- Child Seat

#### 8. Insurance Options
- Basic Coverage
- Premium Coverage
- Comprehensive

#### 9. Driver Options
- Self-Drive
- With Driver

#### 10. Mileage Policy
- Unlimited
- Limited (km/day)

#### 11. Availability
- Toggle to show only available vehicles

#### 12. Search Text
- Free-text search across brand, model, type, fuel, transmission, and features

### Responsive Design
- **Desktop**: Permanent sidebar filter panel (80w)
- **Mobile**: Toggle filter modal with overlay
- Touch-friendly interface
- Optimized layouts for all screen sizes

### Performance Features
- Request debouncing (500ms for API calls)
- Response caching (5-minute TTL)
- Offline queue support
- Loading skeletons during data fetch
- Zero jank animations (GPU-accelerated)

### User Experience
- Real-time filter updates
- Active filter tags with easy removal
- Result counter and no-results messaging
- Wishlist/favorites with persistence
- Filter state preservation in localStorage

## Architecture

### Module Structure

#### 1. **search-api-client.js** (SearchAPIClient)
Handles all backend API calls with advanced features:
- Request debouncing to reduce server load
- Response caching with TTL
- Offline request queue
- Error handling and retry logic
- Timeout support (8 seconds default)

**Key Methods:**
- `searchVehicles()` - Get vehicles with filters
- `checkAvailability()` - Check vehicle availability
- `getPriceEstimate()` - Get booking costs
- `searchLocations()` - Location autocomplete
- `debounce()` - Debounce API calls

#### 2. **search-filter-manager.js** (SearchFilterManager)
Manages all filter state and application logic:
- Encapsulated filter state (closure pattern)
- Real-time filter matching
- Sorting engine (4+ sort options)
- localStorage persistence
- Event listener system

**Key Methods:**
- `matchesFilters(vehicle)` - Check if vehicle matches all filters
- `applyFilters(vehicles)` - Apply filters to vehicle array
- `updateFilter(name, value)` - Update single filter
- `toggleFilter(name, value)` - Toggle array filters
- `setSortOrder(order)` - Change sort order
- `getActiveFilters()` - Get non-default filters
- `saveState()` / `restoreState()` - Persistence

**Filter Properties:**
```javascript
filters: {
  // Location
  pickupLocation: "",
  dropoffLocation: "",
  
  // Date/Time
  pickupDateTime: "",
  dropoffDateTime: "",
  
  // Vehicle Attributes
  vehicleTypes: [],
  brands: [],
  models: [],
  transmissions: [],
  fuelTypes: [],
  
  // Capacity & Features
  minSeats: 1,
  maxSeats: 9,
  features: [],
  
  // Price & Rating
  minPrice: 0,
  maxPrice: 500,
  minRating: 0,
  
  // Rental Options
  insuranceTypes: [],
  driverOptions: [],
  mileagePolicy: [],
  
  // Other
  availabilityOnly: true,
  minEVRange: 0,
  searchText: ""
}
```

#### 3. **search-ui-manager.js** (SearchUIManager)
Renders all UI components and handles DOM updates:
- Dynamic filter panel generation
- Vehicle card rendering
- Active filter tags
- Responsive layout management
- Event attachment and handling

**Key Methods:**
- `renderFilterPanel()` - Generate filter UI
- `renderVehicleResults(vehicles)` - Display search results
- `updateActiveFilterTags()` - Update filter badges
- `attachFilterEventListeners()` - Setup event handlers
- `toggleMobileFilters()` - Mobile panel toggle

**Vehicle Card Features:**
- Availability badges
- Star ratings
- Feature tags
- Wishlist button
- View Details / Book Now actions

#### 4. **search-wishlist.js** (SearchWishlist)
Manages user favorites with persistence:
- Add/remove vehicles
- Toggle wishlist status
- localStorage persistence
- Event notifications
- Import/export functionality

**Key Methods:**
- `addToWishlist(vehicleId)` - Add to favorites
- `removeFromWishlist(vehicleId)` - Remove from favorites
- `toggleWishlist(vehicleId)` - Toggle favorite status
- `isWishlisted(vehicleId)` - Check if wishlisted
- `getWishlist()` - Get all favorited IDs
- `getCount()` - Get count of favorites

#### 5. **advanced-search.js** (AdvancedSearchSystem)
Main orchestrator coordinating all modules:
- System initialization
- Event setup and delegation
- Test data loading (from vehicle-details.js)
- Search execution
- Quick filter presets

**Quick Filter Presets:**

| Preset | Filters Applied |
|--------|-----------------|
| Budget | Max $80, Economy vehicles |
| Family | Min 6 seats, Child seat |
| Luxury | Min $150, Luxury vehicles, 4.5★+ rating |
| Eco | Electric or Hybrid fuel only |

## Usage Guide

### Basic Initialization

```javascript
// System initializes automatically on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    window.AdvancedSearch = new AdvancedSearchSystem();
    await window.AdvancedSearch.init();
});
```

### Programmatic Usage

```javascript
// Get filter manager instance
const filterMgr = window.AdvancedSearch.filterManager;

// Update a single filter
filterMgr.updateFilter('minPrice', 100);

// Update multiple filters
filterMgr.updateFilters({
    vehicleTypes: ['suv', 'luxury'],
    transmissions: ['automatic'],
    minRating: 4.0
});

// Toggle checkbox filter
filterMgr.toggleFilter('features', 'gps');

// Clear specific filter
filterMgr.clearFilter('minPrice');

// Clear all filters
filterMgr.clearAllFilters();

// Check if vehicle matches current filters
const matches = filterMgr.matchesFilters(vehicleObject);

// Get active (non-default) filters
const active = filterMgr.getActiveFilters();

// Set sort order
filterMgr.setSortOrder('price-low'); // 'price-low', 'price-high', 'rating', 'newest', 'relevance'
```

### Event Handling

```javascript
// Listen for filter changes
filterMgr.onFilterChange((filteredVehicles, filters) => {
    console.log('Filter changed, showing', filteredVehicles.length, 'results');
});

// Listen for wishlist changes
window.SearchWishlist.onWishlistChange((event) => {
    console.log('Wishlist action:', event.action); // 'added', 'removed', 'cleared', 'imported'
    console.log('Updated wishlist:', event.wishlist);
});
```

### API Client Usage

```javascript
const apiClient = window.AdvancedSearch.apiClient;

// Search vehicles (with caching)
const results = await apiClient.searchVehicles({
    minPrice: 50,
    maxPrice: 150,
    fuelTypes: ['hybrid']
});

// Check availability for specific date range
const availability = await apiClient.checkAvailability(
    'vehicle-id-123',
    '2024-01-15T10:00:00',
    '2024-01-18T10:00:00'
);

// Get price estimate
const estimate = await apiClient.getPriceEstimate(
    'vehicle-id-123',
    '2024-01-15T10:00:00',
    '2024-01-18T10:00:00'
);

// Location search with autocomplete
const locations = await apiClient.searchLocations('new york');

// Clear cache if needed
apiClient.clearCache();
```

## Data Structure

### Vehicle Object

```javascript
{
    id: "vehicle-id-123",
    brand: "Toyota",
    name: "Camry Hybrid",
    type: "sedan",
    transmission: "automatic",
    fuelType: "hybrid",
    seats: 5,
    rating: 4.5,
    location: "New York, USA",
    available: true,
    pricing: {
        dailyRate: "$82 / day",
        securityDeposit: "$350 refundable"
    },
    features: ["Air Conditioning", "GPS Navigation", "Bluetooth"],
    insuranceOptions: ["Basic Coverage", "Premium Coverage"],
    driverOptions: ["Self-Drive", "With Driver"],
    mileagePolicy: ["Unlimited"],
    badges: ["Fuel Efficient", "Airport Pickup"],
    description: "Premium sedan with excellent fuel efficiency"
}
```

## Styling System

### Color Scheme
- **Accent**: `#E58C4E` (Orange - primary CTA)
- **Panel**: `#2C766E` (Teal - backgrounds)
- **Ink**: `#0E2528` (Dark - text)
- **Muted**: `#6C7074` (Gray - secondary text)
- **Paper**: `#F2F3F1` (Light - page background)

### Responsive Breakpoints (Tailwind)
- **Mobile**: Default (< 640px)
- **Tablet**: md: 768px
- **Desktop**: lg: 1024px
- **Large**: xl: 1280px

### Key CSS Classes
- `.vehicle-card` - Hoverable vehicle container
- `.filter-sidebar` - Desktop filter panel
- `.search-header` - Top navigation gradient
- `.search-bar-container` - Sticky search bar
- `.quick-filter-btn` - Quick filter button
- `.availability-badge` - Success badge
- `.price-badge` - Price highlight
- `.checkbox-custom` - Styled checkbox
- `.range-slider` - Custom range input

## Performance Optimizations

### Debouncing
- API calls debounced at 500ms
- Search text debounced
- Location autocomplete debounced

### Caching
- API responses cached for 5 minutes
- Cache keys generated from endpoint + params
- Old entries auto-purged on expiration

### Offline Support
- Failed requests queued
- Automatic replay when connection restores
- Online/offline event listeners

### UI Optimization
- Loading skeletons for better UX
- GPU-accelerated animations
- Virtual scrolling ready (for pagination)
- Minimal DOM reflows

## Browser Compatibility

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **ES Features**: ES6+, Promise, Fetch API
- **CSS**: CSS Grid, Flexbox, CSS Custom Properties
- **Fallbacks**: Graceful degradation for older browsers

## Error Handling

### API Errors
```javascript
try {
    const results = await apiClient.searchVehicles(filters);
} catch (error) {
    console.error('API Error:', error.message);
    // error.endpoint, error.timestamp also available
}
```

### Validation
- Negative price validation
- NaN handling
- Empty array handling
- Null/undefined checks

### Recovery
- Auto-retry on networks errors
- Fallback to test data if API unavailable
- Clear error messages in UI

## Testing

### Test Data
The system loads test vehicles from `window.VehicleDetailsData` (vehicle-details.js) by default:

```javascript
// 12 example vehicles with complete metadata
- camry-hybrid
- mustang-gt
- tesla-model3
- range-rover
- honda-accord
- bmw-x5
- lexus-rx
- ford-transit-van
- hyundai-elantra
- chevrolet-silverado
- audi-a4
- volkswagen-arteon
```

### Manual Testing Checklist
- [ ] Filter application in real-time
- [ ] Sort order changes update results
- [ ] Clear filters resets to defaults
- [ ] Quick filters apply presets
- [ ] Mobile responsive layout
- [ ] Wishlist persistence across page navigation
- [ ] Price range input validation
- [ ] Search text filtering
- [ ] "No results" messaging
- [ ] Result counter accuracy
- [ ] localStorage save/restore

## Accessibility (a11y)

### ARIA Labels
All filter inputs have descriptive labels and ARIA attributes

### Keyboard Navigation
- Tab through all interactive elements
- Space/Enter to activate buttons
- Arrow keys for range sliders

### Focus Management
- Focus-visible outlines on all interactive elements
- Color contrast ratio > 4.5:1
- Semantic HTML structure

### Screen Reader Support
- Proper heading hierarchy
- Button labels describe action
- Form inputs have associated labels
- ARIA live regions for dynamic content

## Future Enhancements

### Planned Features
- [ ] Map-based search with location pins
- [ ] Real-time availability calendar
- [ ] Advanced price analytics
- [ ] Filter comparison tools
- [ ] User reviews integration
- [ ] Multi-language support
- [ ] Saved search preferences
- [ ] Push notifications for price drops
- [ ] Vehicle comparison modal
- [ ] Email wishlist sharing

### Performance Roadmap
- [ ] Implement virtual scrolling for large datasets
- [ ] Add service worker for offline browsing
- [ ] Optimize images with WebP format
- [ ] Implement lazy loading for vehicle cards
- [ ] Add compression for API responses

### Analytics
- Track filter usage patterns
- Monitor slowest filter combinations
- Identify most-viewed vehicles
- Analyze search abandonment

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Filters not applying | Check browser console for errors, verify vehicle data structure |
| Slow performance | Clear browser cache, check network throttling, reduce dataset size |
| localStorage errors | Check storage quota, verify browser support, allow permissions |
| UI not rendering | Verify Tailwind CSS loaded, check script load order |
| Wishlist not persisting | Check localStorage permissions, verify key name |

### Debug Mode

```javascript
// Access system instance
console.log(window.AdvancedSearch.getStats());

// Log filter state
console.log(window.AdvancedSearch.filterManager.filters);

// Log all vehicles
console.log(window.AdvancedSearch.vehicles);

// Log API cache
console.log(window.AdvancedSearch.apiClient.cache);

// Clear all storage
localStorage.clear();
```

## File Structure

```
frontend/
├── search.html                          # Main search page
├── assets/
│   └── js/
│       ├── search-api-client.js        # API communication layer
│       ├── search-filter-manager.js    # Filter state management
│       ├── search-ui-manager.js        # UI rendering and updates
│       ├── search-wishlist.js          # Favorites management
│       └── advanced-search.js          # Main orchestrator
```

## Support

For issues, feature requests, or contributions:
1. Check existing documentation
2. Review browser console for errors
3. Verify data structure compliance
4. Test with sample data first
5. Contact development team with reproduction steps

## License

Part of Vehicle Rental System project. All rights reserved.
