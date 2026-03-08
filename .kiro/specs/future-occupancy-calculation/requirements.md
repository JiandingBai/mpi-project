# Requirements Document

## Introduction

This feature implements proper future occupancy calculation for vacation rental properties using the PriceLabs reservations API. Currently, the MPI calculator compares historical property occupancy (past 30 days) against future market forecasts (next 7-120 days), creating an invalid apples-to-oranges comparison documented as Bug #1. This enhancement resolves the root cause by calculating actual future occupancy from reservation booking data, enabling valid future-to-future comparisons for accurate Market Penetration Index calculations.

## Glossary

- **MPI_Calculator**: The system that calculates Market Penetration Index by comparing property performance against market averages
- **DataRepository**: The component responsible for loading data from PriceLabs API with three-tier fallback strategy (API → Database → JSON files)
- **OccupancyCalculator**: The component that calculates occupancy percentages for properties and markets
- **Reservations_API**: The PriceLabs API endpoint that provides booking reservation data for a specific listing
- **Future_Occupancy**: The percentage of nights booked in a future date range, calculated from actual reservation data
- **Historical_Occupancy**: The percentage of nights booked in a past date range (e.g., past 30 days)
- **Date_Range**: An inclusive period defined by start and end dates (e.g., next 7, 30, 60, 90, or 120 days)
- **Reservation**: A booking record containing check-in and check-out dates for a property
- **Booked_Dates**: The set of calendar dates that are occupied by confirmed reservations
- **Cache**: SQLite database storage for API responses to minimize redundant API calls and improve performance
- **Fallback_Strategy**: The pattern of trying multiple data sources in priority order when primary sources fail

## Requirements

### Requirement 1: Reservations API Integration

**User Story:** As a developer, I want to integrate the PriceLabs reservations API endpoint, so that the system can retrieve booking data for properties.

#### Acceptance Criteria

1. THE DataRepository SHALL provide a method to load reservations data for a specific listing ID
2. WHEN the reservations API is called, THE DataRepository SHALL use the endpoint format `/v1/reservations?listing_id={id}&api_key={key}`
3. WHEN the API request succeeds, THE DataRepository SHALL return the parsed reservations data
4. IF the API request fails, THEN THE DataRepository SHALL log the failure and return null
5. THE DataRepository SHALL follow the same three-tier fallback pattern as existing endpoints (API → Database → JSON files)

### Requirement 2: Reservations Data Caching

**User Story:** As a system administrator, I want reservations data cached in the database, so that API calls are minimized and performance is optimized.

#### Acceptance Criteria

1. WHEN reservations data is successfully loaded from the API, THE DataRepository SHALL save it to the SQLite database
2. THE DataRepository SHALL store reservations data in a table named `reservations` with columns for listing_id, data_json, and updated_at
3. WHEN loading reservations data, THE DataRepository SHALL check the database cache before calling the API
4. WHILE cached reservations data is fresh (within cache_max_age_hours), THE DataRepository SHALL use the cached data instead of calling the API
5. WHEN cached data is stale, THE DataRepository SHALL fetch fresh data from the API and update the cache

### Requirement 3: Reservations Data Parsing

**User Story:** As a developer, I want to parse reservation data into booked dates, so that I can calculate occupancy for any date range.

#### Acceptance Criteria

1. THE OccupancyCalculator SHALL provide a method to extract booked dates from reservations data
2. WHEN a reservation has check-in and check-out dates, THE OccupancyCalculator SHALL include all dates in the range [check-in, check-out) as booked
3. THE OccupancyCalculator SHALL handle overlapping reservations by treating each date as booked only once
4. WHEN reservation data contains invalid dates, THE OccupancyCalculator SHALL log a warning and skip the invalid reservation
5. THE OccupancyCalculator SHALL return a set of booked dates in a format suitable for occupancy calculation

### Requirement 4: Future Occupancy Calculation

**User Story:** As a property manager, I want accurate future occupancy calculations based on actual bookings, so that MPI comparisons are valid and meaningful.

#### Acceptance Criteria

1. WHEN calculating property occupancy for a future date range, THE OccupancyCalculator SHALL use actual reservation data if available
2. THE OccupancyCalculator SHALL calculate future occupancy as (number of booked nights / total nights in range)
3. WHEN a date range spans from today to N days in the future, THE OccupancyCalculator SHALL count all dates in the inclusive range [start, end]
4. THE OccupancyCalculator SHALL return occupancy as a decimal value between 0.0 and 1.0
5. WHEN the date range has zero total nights, THE OccupancyCalculator SHALL return 0.0 and log a warning

### Requirement 5: Backward Compatibility and Fallback

**User Story:** As a system operator, I want the system to gracefully handle missing reservations data, so that MPI calculations continue working even when the reservations API is unavailable.

#### Acceptance Criteria

1. WHEN reservations data is unavailable for a listing, THE OccupancyCalculator SHALL fall back to using historical occupancy as a proxy
2. WHEN using the historical occupancy fallback, THE OccupancyCalculator SHALL log a warning message indicating the limitation
3. THE OccupancyCalculator SHALL maintain the existing behavior for historical occupancy calculations
4. WHEN reservations data becomes available after a fallback, THE OccupancyCalculator SHALL automatically use the reservations data on the next calculation
5. THE MPI_Calculator SHALL continue to produce valid results regardless of whether reservations data is available

### Requirement 6: Date Range Validation

**User Story:** As a developer, I want robust date range validation, so that occupancy calculations are accurate and edge cases are handled properly.

#### Acceptance Criteria

1. WHEN a date range is provided, THE OccupancyCalculator SHALL validate that the start date is not after the end date
2. IF the start date is after the end date, THEN THE OccupancyCalculator SHALL log an error and return 0.0
3. WHEN parsing reservation dates, THE OccupancyCalculator SHALL validate that dates are in valid ISO 8601 format
4. IF a reservation date is invalid, THEN THE OccupancyCalculator SHALL skip that reservation and log a warning
5. THE OccupancyCalculator SHALL handle timezone differences by normalizing all dates to UTC

### Requirement 7: Performance Optimization

**User Story:** As a system administrator, I want efficient data loading and caching, so that the system performs well even with many properties.

#### Acceptance Criteria

1. WHEN multiple listings share the same reservations data source, THE DataRepository SHALL load the data only once
2. THE DataRepository SHALL cache reservations data for the configured cache_max_age_hours duration
3. WHEN the cache is fresh, THE DataRepository SHALL avoid making redundant API calls
4. THE DataRepository SHALL log cache hits and misses for monitoring and debugging
5. WHEN loading reservations for multiple listings, THE DataRepository SHALL reuse cached data where applicable

### Requirement 8: Testing and Validation

**User Story:** As a developer, I want comprehensive tests for future occupancy calculation, so that the feature is reliable and regressions are prevented.

#### Acceptance Criteria

1. THE test suite SHALL include tests that verify future occupancy calculation with sample reservation data
2. THE test suite SHALL include tests that verify the fallback to historical occupancy when reservations are unavailable
3. THE test suite SHALL include tests that verify date range edge cases (empty ranges, single-day ranges, overlapping reservations)
4. THE test suite SHALL include tests that verify caching behavior for reservations data
5. WHEN all tests are run, THE existing 8 tests SHALL continue to pass without modification

### Requirement 9: Logging and Observability

**User Story:** As a system operator, I want clear logging for occupancy calculations, so that I can debug issues and monitor system behavior.

#### Acceptance Criteria

1. WHEN calculating future occupancy from reservations, THE OccupancyCalculator SHALL log the number of booked nights and total nights
2. WHEN falling back to historical occupancy, THE OccupancyCalculator SHALL log a warning with the reason for the fallback
3. WHEN reservations data is loaded from the API, THE DataRepository SHALL log the API call and response status
4. WHEN reservations data is loaded from cache, THE DataRepository SHALL log a cache hit message
5. THE logging messages SHALL include the listing ID and date range for traceability

### Requirement 10: API Response Parsing

**User Story:** As a developer, I want robust parsing of the reservations API response, so that the system handles various response formats correctly.

#### Acceptance Criteria

1. THE DataRepository SHALL parse the reservations API response as JSON
2. WHEN the API response contains a reservations array, THE DataRepository SHALL extract all reservation objects
3. WHEN the API response is malformed, THE DataRepository SHALL log an error and return null
4. THE DataRepository SHALL validate that each reservation object contains required fields (check-in date, check-out date)
5. WHEN a reservation object is missing required fields, THE DataRepository SHALL log a warning and skip that reservation
