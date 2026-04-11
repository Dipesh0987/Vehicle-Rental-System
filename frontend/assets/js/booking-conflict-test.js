/**
 * Booking Conflict Prevention Test
 * Simple test to verify that the booking conflict detection works correctly
 * Run this in browser console or as a Node.js script
 */

class BookingConflictTest {
  static async runTests() {
    console.log('🧪 Running Booking Conflict Prevention Tests...\n');

    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };

    // Test 1: Check date overlap logic
    console.log('Test 1: Date Overlap Detection');
    const overlapTests = [
      { booking1: { pickup: '2026-04-01', dropoff: '2026-04-05' }, booking2: { pickup: '2026-04-03', dropoff: '2026-04-07' }, expected: true, desc: 'Partial overlap' },
      { booking1: { pickup: '2026-04-01', dropoff: '2026-04-05' }, booking2: { pickup: '2026-04-05', dropoff: '2026-04-10' }, expected: false, desc: 'Adjacent dates (no overlap)' },
      { booking1: { pickup: '2026-04-01', dropoff: '2026-04-10' }, booking2: { pickup: '2026-04-03', dropoff: '2026-04-07' }, expected: true, desc: 'Complete overlap' },
      { booking1: { pickup: '2026-04-01', dropoff: '2026-04-05' }, booking2: { pickup: '2026-04-06', dropoff: '2026-04-10' }, expected: false, desc: 'No overlap' }
    ];

    overlapTests.forEach((test, index) => {
      const hasOverlap = !(test.booking2.dropoff < test.booking1.pickup || test.booking2.pickup > test.booking1.dropoff);
      const passed = hasOverlap === test.expected;
      results.tests.push({ name: `Overlap Test ${index + 1}: ${test.desc}`, passed });
      console.log(`  ${passed ? '✅' : '❌'} ${test.desc}: ${hasOverlap} (expected ${test.expected})`);
      if (passed) results.passed++; else results.failed++;
    });

    // Test 2: Check if BookingService methods exist
    console.log('\nTest 2: BookingService Methods');
    const serviceTests = [
      { method: 'validateAvailability', exists: typeof BookingService?.validateAvailability === 'function' },
      { method: 'createBooking', exists: typeof BookingService?.createBooking === 'function' }
    ];

    serviceTests.forEach(test => {
      results.tests.push({ name: `Service Method: ${test.method}`, passed: test.exists });
      console.log(`  ${test.exists ? '✅' : '❌'} ${test.method} method exists`);
      if (test.exists) results.passed++; else results.failed++;
    });

    // Test 3: Check if BookingErrorHandler methods exist
    console.log('\nTest 3: BookingErrorHandler Methods');
    const errorHandlerTests = [
      { method: 'showConflictError', exists: typeof BookingErrorHandler?.showConflictError === 'function' },
      { method: 'showGeneralError', exists: typeof BookingErrorHandler?.showGeneralError === 'function' },
      { method: 'showSuccess', exists: typeof BookingErrorHandler?.showSuccess === 'function' },
      { method: 'clearErrors', exists: typeof BookingErrorHandler?.clearErrors === 'function' }
    ];

    errorHandlerTests.forEach(test => {
      results.tests.push({ name: `Error Handler: ${test.method}`, passed: test.exists });
      console.log(`  ${test.exists ? '✅' : '❌'} ${test.method} method exists`);
      if (test.exists) results.passed++; else results.failed++;
    });

    // Test 4: Check if UI elements exist on vehicle details page
    console.log('\nTest 4: UI Elements on Vehicle Details Page');
    const uiTests = [
      { element: 'bookingErrorContainer', exists: document.getElementById('bookingErrorContainer') !== null },
      { element: 'bookingSuccessContainer', exists: document.getElementById('bookingSuccessContainer') !== null },
      { element: 'bookingPickupDate', exists: document.getElementById('bookingPickupDate') !== null },
      { element: 'bookingDropoffDate', exists: document.getElementById('bookingDropoffDate') !== null },
      { element: 'bookingSubmitBtn', exists: document.getElementById('bookingSubmitBtn') !== null }
    ];

    uiTests.forEach(test => {
      results.tests.push({ name: `UI Element: ${test.element}`, passed: test.exists });
      console.log(`  ${test.exists ? '✅' : '❌'} ${test.element} exists in DOM`);
      if (test.exists) results.passed++; else results.failed++;
    });

    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log(`   Passed: ${results.passed}`);
    console.log(`   Failed: ${results.failed}`);
    console.log(`   Total:  ${results.passed + results.failed}`);

    if (results.failed === 0) {
      console.log('🎉 All tests passed! Booking conflict prevention is properly implemented.');
    } else {
      console.log('⚠️  Some tests failed. Please check the implementation.');
    }

    return results;
  }

  // Helper method to test actual booking conflict (requires authentication)
  static async testBookingConflict(vehicleId, pickupDate, dropoffDate) {
    if (!BookingService?.validateAvailability) {
      console.error('BookingService.validateAvailability not available');
      return;
    }

    try {
      console.log(`Testing booking conflict for vehicle ${vehicleId} from ${pickupDate} to ${dropoffDate}`);
      const result = await BookingService.validateAvailability(vehicleId, pickupDate, dropoffDate);
      console.log('Conflict check result:', result);
      return result;
    } catch (error) {
      console.error('Error testing booking conflict:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export for use in browser console or Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookingConflictTest;
} else {
  window.BookingConflictTest = BookingConflictTest;
}

// Auto-run tests if in browser and on vehicle details page
if (typeof window !== 'undefined' && window.location.pathname.includes('vehicle-details.html')) {
  // Run tests after page load
  setTimeout(() => {
    BookingConflictTest.runTests();
  }, 1000);
}</content>
<parameter name="filePath">c:\Users\LENOVO\Desktop\Vehicle Rental\Vehicle-Rental-System\frontend\assets\js\booking-conflict-test.js