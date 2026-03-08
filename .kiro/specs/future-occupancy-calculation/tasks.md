# Implementation Plan: Future Occupancy Calculation

## Overview

This implementation adds proper future occupancy calculation using the PriceLabs reservations API. The feature extends DataRepository with a new reservations endpoint following the existing three-tier fallback pattern, and enhances OccupancyCalculator to parse reservation data and calculate actual future occupancy. The system maintains backward compatibility through intelligent fallback to historical occupancy when reservation data is unavailable.

## Tasks

- [x] 1. Define data models and TypeScript interfaces
  - Create ReservationsData and Reservation interfaces in types file
  - Add proper TypeScript types for all new methods
  - _Requirements: 1.1, 10.1, 10.2_

- [x] 2. Set up database schema for reservations caching
  - Create reservations table with listing_id, data_json, and updated_at columns
  - Add index on updated_at for cache freshness queries
  - Update database initialization to create the new table
  - _Requirements: 2.2_

- [x] 3. Implement DataRepository.loadReservations() method
  - [x] 3.1 Add public loadReservations() method with three-tier fallback
    - Implement main method that orchestrates fallback strategy
    - Check database cache first if fresh
    - Try API if cache miss or stale
    - Fall back to database even if stale on API failure
    - Final fallback to JSON file
    - Return null if all sources fail
    - _Requirements: 1.1, 1.5, 2.3, 2.4, 2.5_
  
  - [x] 3.2 Implement tryLoadReservationsFromAPI() private method
    - Build API URL: `/v1/reservations?listing_id={id}&api_key={key}`
    - Make fetch request with proper error handling
    - Parse JSON response and validate structure
    - Log API call and response status
    - Return parsed ReservationsData or null on failure
    - _Requirements: 1.2, 1.3, 1.4, 9.3, 10.1_
  
  - [x] 3.3 Implement tryLoadReservationsFromCache() private method
    - Query reservations table by listing_id
    - Check cache freshness using isCacheFresh helper
    - Parse data_json to ReservationsData
    - Log cache hit/miss
    - Return cached data or null
    - _Requirements: 2.3, 2.4, 7.4, 9.4_
  
  - [x] 3.4 Implement tryLoadReservationsFromFile() private method
    - Try server-side file loading from public/reservations-{listingId}.json
    - Fall back to client-side fetch
    - Parse JSON and return ReservationsData
    - Return null if file not found
    - _Requirements: 1.5_
  
  - [x] 3.5 Implement saveReservationsToCache() private method
    - Insert or replace reservations data in database
    - Store listing_id, JSON-serialized data, and current timestamp
    - Handle database errors gracefully with logging
    - _Requirements: 2.1, 2.5_
  
  - [ ]* 3.6 Write unit tests for DataRepository reservations methods
    - Test API endpoint URL format validation
    - Test successful API response parsing
    - Test API failure handling returns null
    - Test malformed JSON error handling
    - Test missing required fields validation
    - Test cache save after successful API load
    - Test fresh cache prevents API calls
    - Test stale cache triggers refresh
    - _Requirements: 8.4, 10.3, 10.4, 10.5_

- [x] 4. Implement OccupancyCalculator date parsing and validation
  - [x] 4.1 Add parseDateToUTC() private method
    - Validate ISO 8601 format (YYYY-MM-DD) with regex
    - Parse to Date object normalized to UTC
    - Return null for invalid dates with warning log
    - _Requirements: 6.3, 6.5_
  
  - [x] 4.2 Add validateDateRange() private method
    - Check that start date is not after end date
    - Log error if invalid
    - Return boolean validation result
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 4.3 Write property test for date parsing
    - **Property 16: ISO 8601 Date Format Validation**
    - **Validates: Requirements 6.3**
    - Generate random date strings in various formats
    - Verify only ISO 8601 format (YYYY-MM-DD) is accepted
    - _Requirements: 8.3_
  
  - [ ]* 4.4 Write property test for UTC normalization
    - **Property 17: UTC Timezone Normalization**
    - **Validates: Requirements 6.5**
    - Generate dates with various timezones
    - Verify all dates normalized to UTC
    - _Requirements: 8.3_

- [x] 5. Implement reservation parsing and booked dates extraction
  - [x] 5.1 Add extractBookedDates() private method
    - Iterate through all reservations in ReservationsData
    - Parse check-in and check-out dates to UTC
    - Include all dates in range [check-in, check-out) as booked
    - Handle overlapping reservations (deduplicate dates)
    - Skip invalid reservations with warning log
    - Return Set<string> of booked dates in ISO 8601 format
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]* 5.2 Write property test for date range extraction
    - **Property 8: Reservation Date Range Extraction**
    - **Validates: Requirements 3.2**
    - Generate random reservations with valid check-in/check-out
    - Verify extracted dates include [check-in, check-out)
    - Verify check-out date is exclusive
    - _Requirements: 8.1, 8.3_
  
  - [ ]* 5.3 Write property test for overlapping reservations
    - **Property 9: Overlapping Reservations Deduplication**
    - **Validates: Requirements 3.3**
    - Generate overlapping reservations
    - Verify each date appears at most once in result
    - _Requirements: 8.3_
  
  - [ ]* 5.4 Write unit tests for invalid reservation handling
    - Test reservations with invalid date strings are skipped
    - Test warning is logged for invalid reservations
    - Test valid reservations still processed
    - _Requirements: 8.3_

- [x] 6. Implement future occupancy calculation
  - [x] 6.1 Add calculateFutureOccupancy() private method
    - Calculate total nights in range (inclusive of start and end)
    - Count how many dates in range are in bookedDates set
    - Return (booked nights / total nights) as decimal
    - Handle edge case: if total nights = 0, return 0.0 with warning
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 6.2 Write property test for occupancy calculation formula
    - **Property 11: Future Occupancy Calculation Formula**
    - **Validates: Requirements 4.2, 4.3**
    - Generate random booked dates and date ranges
    - Verify occupancy = |booked ∩ range| / |range|
    - _Requirements: 8.1, 8.3_
  
  - [ ]* 6.3 Write property test for occupancy range validation
    - **Property 12: Occupancy Range Validation**
    - **Validates: Requirements 4.4**
    - Generate various booked dates and ranges
    - Verify result always between 0.0 and 1.0 inclusive
    - _Requirements: 8.3_
  
  - [ ]* 6.4 Write unit tests for edge cases
    - Test empty date range (start = end) returns correct value
    - Test zero total nights returns 0.0 with warning
    - Test fully booked range returns 1.0
    - Test empty reservations returns 0.0
    - _Requirements: 8.3_

- [x] 7. Enhance calculatePropertyOccupancy() with reservations support
  - [x] 7.1 Modify calculatePropertyOccupancy() signature
    - Add optional reservationsData parameter
    - Maintain backward compatibility (parameter is optional)
    - _Requirements: 4.1, 5.3_
  
  - [x] 7.2 Implement reservation-based calculation path
    - Validate date range before calculation
    - If reservationsData provided and non-null: use reservation-based calculation
    - Call extractBookedDates() to get booked dates
    - Call calculateFutureOccupancy() to compute occupancy
    - Log calculation method and metrics (booked nights, total nights, occupancy)
    - _Requirements: 4.1, 9.1, 9.5_
  
  - [x] 7.3 Implement historical fallback path
    - If reservationsData is null: fall back to historical occupancy
    - Log warning message indicating limitation
    - Use existing historical occupancy logic
    - _Requirements: 5.1, 5.2, 5.3, 9.2_
  
  - [ ]* 7.4 Write property test for calculation method selection
    - **Property 13: Reservations Data Availability Determines Calculation Method**
    - **Validates: Requirements 4.1, 5.1**
    - Generate listings with and without reservations data
    - Verify correct calculation method is used
    - _Requirements: 8.2_
  
  - [ ]* 7.5 Write unit test for historical fallback logging
    - **Property 14: Historical Fallback Logs Warning**
    - **Validates: Requirements 5.2**
    - Call calculatePropertyOccupancy without reservations data
    - Verify warning message is logged
    - _Requirements: 8.2_

- [x] 8. Checkpoint - Ensure all tests pass
  - Run test suite and verify all new tests pass
  - Verify all existing 8 tests still pass
  - Ask the user if questions arise

- [x] 9. Wire DataRepository and OccupancyCalculator together
  - [x] 9.1 Update MPICalculator to load reservations data
    - Call dataRepository.loadReservations() for each listing
    - Pass reservations data to occupancyCalculator.calculatePropertyOccupancy()
    - Handle null reservations data gracefully (fallback works automatically)
    - _Requirements: 5.4, 5.5_
  
  - [ ]* 9.2 Write integration test for end-to-end MPI calculation
    - Test MPI calculation with reservations data available
    - Test MPI calculation with reservations data unavailable (fallback)
    - Verify correct occupancy values in both scenarios
    - _Requirements: 8.1, 8.2_

- [ ]* 10. Add comprehensive property-based tests for caching behavior
  - [ ]* 10.1 Write property test for cache reuse
    - **Property 18: Cache Reuse Across Multiple Requests**
    - **Validates: Requirements 7.1, 7.5**
    - Simulate multiple requests for same listing within cache window
    - Verify API called only once
    - _Requirements: 7.3, 8.4_
  
  - [ ]* 10.2 Write property test for three-tier fallback sequence
    - **Property 2: Three-Tier Fallback Sequence**
    - **Validates: Requirements 1.5, 2.3**
    - Simulate various failure scenarios
    - Verify correct fallback order: API → Database → JSON
    - _Requirements: 8.4_

- [ ]* 11. Add logging and observability tests
  - [ ]* 11.1 Write unit tests for API call logging
    - **Property 21: API Call Logging**
    - **Validates: Requirements 9.3**
    - Verify API endpoint, listing ID, and status are logged
    - _Requirements: 9.3_
  
  - [ ]* 11.2 Write unit tests for cache hit/miss logging
    - **Property 19: Cache Hit/Miss Logging**
    - **Validates: Requirements 7.4, 9.4**
    - Verify cache hits and misses are logged
    - _Requirements: 9.4_
  
  - [ ]* 11.3 Write unit tests for traceability
    - **Property 22: Traceability in Log Messages**
    - **Validates: Requirements 9.5**
    - Verify listing ID and date range included in logs
    - _Requirements: 9.5_

- [-] 12. Final checkpoint - Backward compatibility validation
  - Run complete test suite
  - Verify all 8 existing tests pass without modification
  - Verify all new tests pass
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (100 iterations each)
- Unit tests validate specific examples and edge cases
- The implementation maintains backward compatibility through optional parameters and intelligent fallback
- All new code follows existing patterns in DataRepository and OccupancyCalculator
