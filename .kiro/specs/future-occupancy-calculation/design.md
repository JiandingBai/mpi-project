# Design Document: Future Occupancy Calculation

## Overview

This feature implements proper future occupancy calculation for vacation rental properties using the PriceLabs reservations API. The current system compares historical property occupancy (past 30 days) against future market forecasts (next 7-120 days), creating an invalid apples-to-oranges comparison. This enhancement resolves Bug #1 by calculating actual future occupancy from reservation booking data, enabling valid future-to-future comparisons for accurate Market Penetration Index calculations.

The design extends the existing three-class OOP architecture (DataRepository, MPICalculator, OccupancyCalculator) by adding reservations API integration to DataRepository and future occupancy calculation logic to OccupancyCalculator. The solution maintains backward compatibility through intelligent fallback to historical occupancy when reservation data is unavailable.

## Architecture

### System Components

The feature integrates into the existing three-tier architecture:

1. **DataRepository**: Extended with reservations API endpoint, following the same three-tier fallback pattern (API → Database → JSON files)
2. **OccupancyCalculator**: Enhanced with reservation parsing and future occupancy calculation logic
3. **MPICalculator**: No changes required - continues to use OccupancyCalculator's interface

### Data Flow

```
┌─────────────────┐
│  MPICalculator  │
└────────┬────────┘
         │ requests occupancy
         ▼
┌─────────────────────────┐
│  OccupancyCalculator    │
│  - calculateProperty    │
│    Occupancy()          │
└────────┬────────────────┘
         │ needs reservation data
         ▼
┌─────────────────────────┐
│   DataRepository        │
│   - loadReservations()  │
└────────┬────────────────┘
         │
         ├─► Try API
         ├─► Try Database Cache
         └─► Try JSON File
```

### Fallback Strategy

The system implements two levels of fallback:

1. **Data Source Fallback** (DataRepository): API → Database → JSON files
2. **Calculation Fallback** (OccupancyCalculator): Reservations → Historical occupancy

This dual-fallback approach ensures the system remains operational even when the reservations API is unavailable.

## Components and Interfaces

### DataRepository Extensions

#### New Method: loadReservations

```typescript
async loadReservations(listingId: string): Promise<ReservationsData | null>
```

Loads reservation data for a specific listing using the three-tier fallback pattern.

**Parameters:**
- `listingId`: The unique identifier for the property

**Returns:**
- `ReservationsData` object if successful
- `null` if all data sources fail

**Behavior:**
1. Check database cache first (if fresh)
2. Try PriceLabs API: `GET /v1/reservations?listing_id={id}&api_key={key}`
3. On API success: cache to database and return
4. On API failure: try database cache (even if stale)
5. Final fallback: try JSON file
6. Log all attempts and results

#### New Private Methods

```typescript
private async tryLoadReservationsFromAPI(listingId: string): Promise<ReservationsData | null>
```

Attempts to load reservations from PriceLabs API.

```typescript
private tryLoadReservationsFromCache(listingId: string): ReservationsData | null
```

Attempts to load reservations from SQLite database cache.

```typescript
private async tryLoadReservationsFromFile(listingId: string): Promise<ReservationsData | null>
```

Attempts to load reservations from JSON file fallback.

```typescript
private saveReservationsToCache(listingId: string, data: ReservationsData): void
```

Saves reservations data to SQLite database cache.

### OccupancyCalculator Extensions

#### Modified Method: calculatePropertyOccupancy

```typescript
calculatePropertyOccupancy(
  listing: any,
  startDate: Date,
  endDate: Date,
  reservationsData?: ReservationsData | null
): number
```

Enhanced to accept optional reservations data and calculate future occupancy when available.

**Parameters:**
- `listing`: The property listing object
- `startDate`: Start of the date range (inclusive)
- `endDate`: End of the date range (inclusive)
- `reservationsData`: Optional reservation data for the listing

**Returns:**
- Decimal value between 0.0 and 1.0 representing occupancy percentage

**Behavior:**
1. Validate date range (start ≤ end)
2. If reservations data available: calculate from actual bookings
3. If reservations data unavailable: fall back to historical occupancy
4. Log calculation method and results

#### New Method: extractBookedDates

```typescript
private extractBookedDates(
  reservationsData: ReservationsData,
  startDate: Date,
  endDate: Date
): Set<string>
```

Extracts booked dates from reservation data within the specified range.

**Parameters:**
- `reservationsData`: The reservations data object
- `startDate`: Start of the date range to consider
- `endDate`: End of the date range to consider

**Returns:**
- Set of date strings in ISO 8601 format (YYYY-MM-DD) representing booked dates

**Behavior:**
1. Iterate through all reservations
2. For each reservation with valid check-in and check-out dates:
   - Parse dates to UTC
   - Include all dates in range [check-in, check-out) as booked
   - Note: check-out date is exclusive (guest departs that day)
3. Handle overlapping reservations (dates only counted once)
4. Skip invalid reservations with warning log
5. Return deduplicated set of booked dates

#### New Method: calculateFutureOccupancy

```typescript
private calculateFutureOccupancy(
  bookedDates: Set<string>,
  startDate: Date,
  endDate: Date
): number
```

Calculates occupancy percentage from booked dates.

**Parameters:**
- `bookedDates`: Set of booked date strings
- `startDate`: Start of the date range (inclusive)
- `endDate`: End of the date range (inclusive)

**Returns:**
- Decimal value between 0.0 and 1.0

**Behavior:**
1. Calculate total nights in range (inclusive of both start and end)
2. Count how many dates in range are in bookedDates set
3. Return (booked nights / total nights)
4. Handle edge case: if total nights = 0, return 0.0 with warning

#### New Method: validateDateRange

```typescript
private validateDateRange(startDate: Date, endDate: Date): boolean
```

Validates that a date range is valid.

**Parameters:**
- `startDate`: Start date
- `endDate`: End date

**Returns:**
- `true` if valid (start ≤ end), `false` otherwise

**Behavior:**
1. Check that start date is not after end date
2. Log error if invalid
3. Return validation result

#### New Method: parseDateToUTC

```typescript
private parseDateToUTC(dateString: string): Date | null
```

Parses an ISO 8601 date string to a UTC Date object.

**Parameters:**
- `dateString`: Date string in ISO 8601 format

**Returns:**
- Date object normalized to UTC, or null if invalid

**Behavior:**
1. Validate ISO 8601 format (YYYY-MM-DD)
2. Parse to Date object with UTC timezone
3. Return null if parsing fails
4. Log warning for invalid dates

## Data Models

### ReservationsData Interface

```typescript
export interface ReservationsData {
  listing_id: string;
  reservations: Reservation[];
}
```

Represents the complete reservations response for a listing.

### Reservation Interface

```typescript
export interface Reservation {
  check_in: string;   // ISO 8601 date: "YYYY-MM-DD"
  check_out: string;  // ISO 8601 date: "YYYY-MM-DD"
  guest_name?: string;
  confirmation_code?: string;
  status?: string;
}
```

Represents a single booking reservation. Only `check_in` and `check_out` are required for occupancy calculation.

### Database Schema Extension

#### New Table: reservations

```sql
CREATE TABLE IF NOT EXISTS reservations (
  listing_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `listing_id`: Unique identifier for the property (primary key)
- `data_json`: JSON-serialized ReservationsData object
- `updated_at`: Timestamp of last update (ISO 8601 format)

**Indexes:**
```sql
CREATE INDEX IF NOT EXISTS idx_reservations_updated 
ON reservations(updated_at);
```

### API Response Format

The PriceLabs reservations API returns:

```json
{
  "listing_id": "12345",
  "reservations": [
    {
      "check_in": "2025-02-01",
      "check_out": "2025-02-05",
      "guest_name": "John Doe",
      "confirmation_code": "ABC123",
      "status": "confirmed"
    }
  ]
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API Endpoint Format Validation

*For any* listing ID and API key, when the DataRepository calls the reservations API, the URL SHALL match the format `/v1/reservations?listing_id={id}&api_key={key}`

**Validates: Requirements 1.2**

### Property 2: Three-Tier Fallback Sequence

*For any* listing ID, when loading reservations data, the DataRepository SHALL attempt data sources in the order: API → Database → JSON files, stopping at the first successful source

**Validates: Requirements 1.5, 2.3**

### Property 3: API Success Returns Parsed Data

*For any* valid API response containing reservations, the DataRepository SHALL return a ReservationsData object with all reservations extracted

**Validates: Requirements 1.3, 10.2**

### Property 4: API Failure Returns Null

*For any* failed API request, the DataRepository SHALL log the failure and return null

**Validates: Requirements 1.4**

### Property 5: Successful API Load Triggers Cache Save

*For any* successful API response, the DataRepository SHALL save the data to the SQLite database with the current timestamp

**Validates: Requirements 2.1**

### Property 6: Fresh Cache Prevents API Calls

*For any* cached reservations data where (current_time - updated_at) < cache_max_age_hours, the DataRepository SHALL return cached data without calling the API

**Validates: Requirements 2.4, 7.3**

### Property 7: Stale Cache Triggers API Refresh

*For any* cached reservations data where (current_time - updated_at) ≥ cache_max_age_hours, the DataRepository SHALL fetch fresh data from the API and update the cache

**Validates: Requirements 2.5**

### Property 8: Reservation Date Range Extraction

*For any* reservation with valid check-in date C and check-out date O, the extracted booked dates SHALL include all dates D where C ≤ D < O (check-out is exclusive)

**Validates: Requirements 3.2**

### Property 9: Overlapping Reservations Deduplication

*For any* set of reservations with overlapping date ranges, each date SHALL appear at most once in the extracted booked dates set

**Validates: Requirements 3.3**

### Property 10: Invalid Reservation Dates Skipped

*For any* reservation with invalid date strings, the OccupancyCalculator SHALL skip that reservation, log a warning, and continue processing remaining reservations

**Validates: Requirements 3.4, 6.4, 10.5**

### Property 11: Future Occupancy Calculation Formula

*For any* set of booked dates B and date range [S, E], the calculated occupancy SHALL equal |B ∩ [S, E]| / |[S, E]| where both S and E are inclusive

**Validates: Requirements 4.2, 4.3**

### Property 12: Occupancy Range Validation

*For any* occupancy calculation, the returned value SHALL be a decimal between 0.0 and 1.0 inclusive

**Validates: Requirements 4.4**

### Property 13: Reservations Data Availability Determines Calculation Method

*For any* property occupancy calculation, if reservations data is provided and non-null, the OccupancyCalculator SHALL use reservation-based calculation; otherwise it SHALL fall back to historical occupancy

**Validates: Requirements 4.1, 5.1**

### Property 14: Historical Fallback Logs Warning

*For any* property occupancy calculation that falls back to historical occupancy, the OccupancyCalculator SHALL log a warning message indicating the limitation

**Validates: Requirements 5.2, 9.2**

### Property 15: Date Range Validation

*For any* date range with start date S and end date E where S > E, the OccupancyCalculator SHALL log an error and return 0.0

**Validates: Requirements 6.1, 6.2**

### Property 16: ISO 8601 Date Format Validation

*For any* reservation date string, the OccupancyCalculator SHALL only accept dates in ISO 8601 format (YYYY-MM-DD) and reject all other formats

**Validates: Requirements 6.3**

### Property 17: UTC Timezone Normalization

*For any* parsed date, the OccupancyCalculator SHALL normalize it to UTC timezone regardless of the input timezone

**Validates: Requirements 6.5**

### Property 18: Cache Reuse Across Multiple Requests

*For any* sequence of reservation data requests for the same listing ID within cache_max_age_hours, the DataRepository SHALL load from API only once and reuse cached data for subsequent requests

**Validates: Requirements 7.1, 7.5**

### Property 19: Cache Hit/Miss Logging

*For any* reservation data load attempt, the DataRepository SHALL log whether the data was loaded from cache (hit) or required an API call (miss)

**Validates: Requirements 7.4, 9.4**

### Property 20: Calculation Logging Includes Metrics

*For any* future occupancy calculation from reservations, the OccupancyCalculator SHALL log the number of booked nights, total nights, and resulting occupancy percentage

**Validates: Requirements 9.1**

### Property 21: API Call Logging

*For any* reservations API request, the DataRepository SHALL log the API endpoint, listing ID, and response status

**Validates: Requirements 9.3**

### Property 22: Traceability in Log Messages

*For any* log message related to occupancy calculation or data loading, the message SHALL include the listing ID and date range for traceability

**Validates: Requirements 9.5**

### Property 23: JSON Parsing Error Handling

*For any* malformed JSON response from the reservations API, the DataRepository SHALL log an error and return null

**Validates: Requirements 10.3**

### Property 24: Required Fields Validation

*For any* reservation object in the API response, if it lacks check_in or check_out fields, the DataRepository SHALL log a warning and skip that reservation

**Validates: Requirements 10.4, 10.5**

### Property 25: MPI Calculation Resilience

*For any* MPI calculation request, the MPICalculator SHALL produce valid results regardless of whether reservations data is available (using fallback when necessary)

**Validates: Requirements 5.5**

## Error Handling

### API Errors

**Network Failures:**
- Catch fetch exceptions
- Log error with listing ID and error message
- Return null to trigger fallback chain
- Example: `logger.apiFailure('GET', 'Reservations API', error)`

**HTTP Error Responses:**
- Check response.ok before parsing
- Log HTTP status code
- Return null to trigger fallback
- Example: `logger.warn('Reservations API returned status', response.status)`

**Timeout Handling:**
- Use fetch with timeout (e.g., 10 seconds)
- Treat timeout as API failure
- Fall back to database cache

### Data Parsing Errors

**Malformed JSON:**
- Wrap JSON.parse in try-catch
- Log parsing error with response preview
- Return null
- Example: `logger.error('Failed to parse reservations JSON', error)`

**Missing Required Fields:**
- Validate each reservation has check_in and check_out
- Skip invalid reservations with warning
- Continue processing valid reservations
- Example: `logger.warn('Skipping reservation missing required fields', reservation)`

**Invalid Date Formats:**
- Validate ISO 8601 format with regex: `/^\d{4}-\d{2}-\d{2}$/`
- Attempt to parse with Date constructor
- Check for NaN result
- Skip invalid dates with warning
- Example: `logger.warn('Invalid date format in reservation', dateString)`

### Date Range Errors

**Invalid Range (start > end):**
- Validate before calculation
- Log error with date values
- Return 0.0 occupancy
- Example: `logger.error('Invalid date range: start after end', {start, end})`

**Empty Range (start = end):**
- Treat as single-day range (1 night)
- Calculate normally
- Log info message

**Zero Total Nights:**
- Should not occur with proper validation
- If it does: log warning and return 0.0
- Example: `logger.warn('Date range has zero total nights', {start, end})`

### Database Errors

**Cache Read Failures:**
- Catch SQLite exceptions
- Log error
- Continue to next fallback tier (API or JSON)
- Example: `logger.error('Database cache read failed', error)`

**Cache Write Failures:**
- Catch SQLite exceptions
- Log error
- Do not fail the request (data already loaded from API)
- System continues to function without cache
- Example: `logger.error('Failed to cache reservations', error)`

### Fallback Behavior

**All Data Sources Fail:**
- For reservations: return null
- OccupancyCalculator detects null and uses historical occupancy
- Log warning about using historical fallback
- MPI calculation continues with degraded accuracy

**Partial Data Success:**
- If some reservations are invalid: skip them, use valid ones
- If some dates are invalid: skip them, calculate with valid dates
- Log warnings for skipped items
- Return best-effort result

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples demonstrating correct behavior
- Edge cases (empty ranges, single-day ranges, boundary dates)
- Error conditions (malformed JSON, invalid dates, network failures)
- Integration points between DataRepository and OccupancyCalculator
- Backward compatibility (existing 8 tests must continue passing)

**Property-Based Tests** focus on:
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Invariants (occupancy always between 0.0 and 1.0)
- Round-trip properties (date parsing and formatting)
- Metamorphic properties (relationships between inputs and outputs)

Together, unit tests catch concrete bugs while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

**Library Selection:**
- TypeScript/JavaScript: Use `fast-check` library
- Installation: `npm install --save-dev fast-check`
- Integration: Import in test files with `import fc from 'fast-check'`

**Test Configuration:**
- Each property test MUST run minimum 100 iterations
- Configure with: `fc.assert(fc.property(...), { numRuns: 100 })`
- Use seed for reproducibility: `{ seed: 42, numRuns: 100 }`

**Property Test Tagging:**
- Each test MUST include a comment referencing the design property
- Format: `// Feature: future-occupancy-calculation, Property {number}: {property_text}`
- Example:
  ```typescript
  // Feature: future-occupancy-calculation, Property 11: Future Occupancy Calculation Formula
  it('calculates occupancy as booked nights / total nights', () => {
    fc.assert(fc.property(
      fc.array(fc.date()),
      fc.date(),
      fc.date(),
      (bookedDates, start, end) => {
        // Test implementation
      }
    ), { numRuns: 100 });
  });
  ```

### Test Categories

#### 1. DataRepository Tests

**Unit Tests:**
- API endpoint URL format validation (Property 1)
- Successful API response parsing (Property 3)
- API failure handling returns null (Property 4)
- Malformed JSON error handling (Property 23)
- Missing required fields validation (Property 24)

**Property Tests:**
- Three-tier fallback sequence (Property 2)
- Cache save after successful API load (Property 5)
- Fresh cache prevents API calls (Property 6)
- Stale cache triggers refresh (Property 7)
- Cache reuse across multiple requests (Property 18)

#### 2. OccupancyCalculator Tests

**Unit Tests:**
- Single reservation date extraction
- Empty reservations array handling
- Single-day date range calculation
- Zero total nights edge case
- Historical fallback when reservations null

**Property Tests:**
- Reservation date range extraction [check-in, check-out) (Property 8)
- Overlapping reservations deduplication (Property 9)
- Invalid dates skipped with warning (Property 10)
- Future occupancy calculation formula (Property 11)
- Occupancy range validation 0.0-1.0 (Property 12)
- Date range validation (Property 15)
- ISO 8601 format validation (Property 16)
- UTC timezone normalization (Property 17)

#### 3. Integration Tests

**Unit Tests:**
- End-to-end MPI calculation with reservations
- End-to-end MPI calculation with fallback
- Backward compatibility with existing tests

**Property Tests:**
- Reservations availability determines method (Property 13)
- Historical fallback logs warning (Property 14)
- MPI calculation resilience (Property 25)

#### 4. Logging Tests

**Unit Tests:**
- Cache hit/miss logging (Property 19)
- API call logging (Property 21)
- Calculation metrics logging (Property 20)
- Traceability in log messages (Property 22)

### Test Data Generators (for Property Tests)

**Date Generator:**
```typescript
const arbitraryDate = fc.date({
  min: new Date('2024-01-01'),
  max: new Date('2026-12-31')
});
```

**Date Range Generator:**
```typescript
const arbitraryDateRange = fc.tuple(arbitraryDate, arbitraryDate)
  .map(([d1, d2]) => d1 <= d2 ? [d1, d2] : [d2, d1]);
```

**Reservation Generator:**
```typescript
const arbitraryReservation = fc.record({
  check_in: fc.date().map(d => d.toISOString().split('T')[0]),
  check_out: fc.date().map(d => d.toISOString().split('T')[0])
}).filter(r => r.check_in < r.check_out);
```

**Reservations Data Generator:**
```typescript
const arbitraryReservationsData = fc.record({
  listing_id: fc.string(),
  reservations: fc.array(arbitraryReservation, { minLength: 0, maxLength: 20 })
});
```

### Backward Compatibility Testing

**Requirement:** All existing 8 tests must continue to pass without modification.

**Approach:**
1. Run existing test suite before any changes
2. Document current test results as baseline
3. After implementation, run tests again
4. Verify all 8 tests still pass
5. If any test fails: fix implementation, not tests

**Existing Test Coverage:**
- MPI calculation with API data
- MPI calculation with neighborhood data
- Fallback behavior
- Occupancy calculations
- Data loading from various sources

### Test Execution

**Command:**
```bash
npm test
```

**Expected Results:**
- All existing 8 tests pass
- All new unit tests pass
- All new property tests pass (100 iterations each)
- Total test count: 8 (existing) + ~30 (new) = ~38 tests
- Execution time: < 10 seconds

**Continuous Integration:**
- Run tests on every commit
- Fail build if any test fails
- Track test coverage (target: >80% for new code)
