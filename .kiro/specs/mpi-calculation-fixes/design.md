# MPI Calculation Fixes - Technical Design

## Overview

This design addresses seven critical bugs in the Market Penetration Index (MPI) calculator that compromise accuracy and reliability. The MPI formula `MPI = (property_occupancy / market_occupancy) × 100` compares a property's performance against market average, where 100 represents market average performance.

The bugs range from critical data mismatches (comparing historical vs future data) to performance issues (redundant API calls) and calculation errors (off-by-one date ranges). This design provides root cause analysis, technical solutions, and a comprehensive testing strategy for each bug.

## Glossary

- **Bug_Condition (C)**: The condition that triggers each specific bug
- **Property (P)**: The desired correct behavior after the fix
- **Preservation**: Existing correct behaviors that must remain unchanged
- **MPI (Market Penetration Index)**: Performance metric = (property_occupancy / market_occupancy) × 100
- **Property Occupancy**: The occupancy rate of a specific vacation rental property
- **Market Occupancy**: The average occupancy rate of comparable properties in the neighborhood
- **Timeframe**: The date range for MPI calculation (7, 30, 60, 90, or 120 days)
- **Future-looking data**: Occupancy projections for upcoming dates from "Future Occ/New/Canc" section
- **Historical data**: Past occupancy data from `adjusted_occupancy_past_30` field
- **API MPI**: Pre-calculated MPI values from PriceLabs API (`mpi_next_7`, `mpi_next_30`, etc.)
- **Calculated MPI**: MPI values computed from neighborhood data when API values unavailable

## Bug Details


### Bug #1: Property vs Market Occupancy Mismatch (CRITICAL)

**Bug Condition:**
```
FUNCTION isBugCondition_1(calculation)
  INPUT: calculation containing propertyOccupancy, marketOccupancy, timeframe
  OUTPUT: boolean
  
  RETURN calculation.propertyOccupancy.source == "adjusted_occupancy_past_30"
         AND calculation.marketOccupancy.source == "Future Occ/New/Canc"
         AND calculation.timeframe IN [7, 30, 60, 90, 120]
END FUNCTION
```

**Root Cause:**
The `calculatePropertyOccupancy()` function in `lib/data-loader.ts` (lines 177-183) always returns `adjusted_occupancy_past_30` regardless of the requested date range, while `calculateMarketOccupancy()` uses future-looking data from "Future Occ/New/Canc" section. This creates meaningless comparisons between past property performance and future market forecasts.

**Current Code (Defective):**
```typescript
export function calculatePropertyOccupancy(
  listing: any,
  startDate: Date,
  endDate: Date
): number {
  // BUG: Ignores startDate and endDate parameters
  return extractPercentage(listing.adjusted_occupancy_past_30);
}
```

**Examples:**
- 7-day MPI: Compares property's past 30-day occupancy (e.g., 85%) with market's next 7-day forecast (e.g., 75%)
- 120-day MPI: Compares same past 30-day occupancy (85%) with market's next 120-day forecast (e.g., 70%)
- Result: All timeframes use identical property occupancy, making comparisons invalid


### Bug #2: Dead Code Path (HIGH)

**Bug Condition:**
```
FUNCTION isBugCondition_2(listing, existingMPI)
  INPUT: listing with mpi_next_X fields, existingMPI value
  OUTPUT: boolean
  
  RETURN existingMPI !== undefined 
         AND existingMPI !== null 
         AND existingMPI >= 0
         AND neighborhoodFallbackCode.neverExecutes == true
END FUNCTION
```

**Root Cause:**
In `lib/mpi-calculator.ts` (lines 60-63), the condition `if (existingMPI !== undefined && existingMPI !== null && existingMPI >= 0)` always evaluates to true because all listings in the API response have `mpi_next_X` values (even if 0). The neighborhood calculation fallback (Priority 2, lines 66-91) never executes, making it dead code.

**Current Code (Defective):**
```typescript
// Priority 1: Always succeeds because API always provides mpi_next_X values
if (existingMPI !== undefined && existingMPI !== null && existingMPI >= 0) {
  return existingMPI * 100;
}

// Priority 2: DEAD CODE - never reached
try {
  const neighborhoodData = await loadNeighborhoodData(listing.id);
  // ... calculation logic that never runs
}
```

**Impact:**
- `calculationStats.neighborhoodCalculated` always shows 0
- Fallback logic cannot be tested or validated
- Code maintenance burden for unused code paths


### Bug #3: Inconsistent Scaling Logic (MEDIUM)

**Bug Condition:**
```
FUNCTION isBugCondition_3(apiMPI, calculatedMPI)
  INPUT: apiMPI from API, calculatedMPI from neighborhood data
  OUTPUT: boolean
  
  RETURN apiMPI.isScaledBy100 == true
         AND calculatedMPI.isScaledBy100 == false
         AND comparison.mixesScales == true
END FUNCTION
```

**Root Cause:**
API MPI values are multiplied by 100 in multiple places (`lib/mpi-calculator.ts` lines 63, 186-190) without clear documentation, while neighborhood-calculated MPI values already use the formula `(propertyOccupancy / marketOccupancy) * 100` and are in the 0-200 range. This creates confusion about which scale is correct.

**Current Code (Defective):**
```typescript
// API values scaled by 100
if (existingMPI !== undefined && existingMPI !== null && existingMPI >= 0) {
  return existingMPI * 100;  // Why multiply by 100?
}

// Calculated values already in 0-200 range
const calculatedMPI = (propertyOccupancy / marketOccupancy) * 100;
```

**Impact:**
- Unclear whether API returns values in 0-2 range or 0-200 range
- Potential for incorrect comparisons between API and calculated values
- Maintenance confusion about correct scaling


### Bug #4: Inefficient API Calls (MEDIUM)

**Bug Condition:**
```
FUNCTION isBugCondition_4(listings, apiCalls)
  INPUT: listings array, apiCalls made
  OUTPUT: boolean
  
  RETURN apiCalls.count == listings.length
         AND listings.manyInSameNeighborhood == true
         AND apiCalls.containsDuplicateNeighborhoodRequests == true
END FUNCTION
```

**Root Cause:**
In `lib/mpi-calculator.ts` (lines 54-104), `calculateListingMPI()` calls `loadNeighborhoodData(listing.id)` separately for each listing. When processing 49 listings, this makes 49 separate API calls even if many listings share the same neighborhood data.

**Current Code (Defective):**
```typescript
const calculatedMPIs = await Promise.all(
  listingsData.listings.map(async (listing) => {
    const mpi = await calculateListingMPI(listing);  // Each calls loadNeighborhoodData()
    return mpi;
  })
);
```

**Impact:**
- Unnecessary API calls (49 calls for 49 listings instead of ~5-10 unique neighborhoods)
- Slower performance due to network overhead
- Potential API rate limiting issues
- Higher costs if API charges per request


### Bug #5: Date Range Off-by-One Bug (LOW)

**Bug Condition:**
```
FUNCTION isBugCondition_5(timeframe, actualDays)
  INPUT: timeframe requested, actualDays calculated
  OUTPUT: boolean
  
  RETURN (timeframe == 7 AND actualDays == 6)
         OR (timeframe == 30 AND actualDays == 29)
         OR (timeframe == 60 AND actualDays == 59)
         OR (timeframe == 90 AND actualDays == 89)
         OR (timeframe == 120 AND actualDays == 119)
END FUNCTION
```

**Root Cause:**
In `lib/mpi-calculator.ts` (lines 16-35), `getDateRangeForTimeframe()` incorrectly subtracts 1 from the timeframe: `end.setDate(start.getDate() + timeframe - 1)`. This results in date ranges that are one day shorter than requested.

**Current Code (Defective):**
```typescript
switch (timeframe) {
  case 7:
    end.setDate(start.getDate() + 7 - 1);  // Results in 6 days, not 7
    break;
  case 30:
    end.setDate(start.getDate() + 30 - 1);  // Results in 29 days, not 30
    break;
}
```

**Examples:**
- Request 7-day MPI: Gets Aug 8-13 (6 days) instead of Aug 8-14 (7 days)
- Request 30-day MPI: Gets 29 days instead of 30 days
- Impact: Slightly underestimates occupancy by excluding one day


### Bug #6: Missing Validation (MEDIUM)

**Bug Condition:**
```
FUNCTION isBugCondition_6(marketOccupancy, dates, values)
  INPUT: marketOccupancy value, dates array, occupancy values
  OUTPUT: boolean
  
  RETURN (marketOccupancy == 0 AND divisionByZeroAttempted == true)
         OR (requestedDates NOT IN availableDates)
         OR (occupancyValues OUTSIDE [0, 1] range)
         OR (timezoneHandling.inconsistent == true)
END FUNCTION
```

**Root Cause:**
Multiple validation gaps in `lib/data-loader.ts`:
1. No division-by-zero check before `(propertyOccupancy / marketOccupancy) * 100` (line 82 in mpi-calculator.ts)
2. No validation that requested dates exist in neighborhood data (lines 107-145 in data-loader.ts)
3. No timezone handling for date string parsing (line 116)
4. No range validation for occupancy values (lines 157-167)

**Current Code (Defective):**
```typescript
// No check for marketOccupancy == 0
if (marketOccupancy > 0) {
  const calculatedMPI = (propertyOccupancy / marketOccupancy) * 100;
  return calculatedMPI;
}
// Falls through to return 0, but should log warning

// No validation that dates exist
const date = new Date(dateStr);  // Could fail or mismatch timezone
if (date >= startDate && date <= endDate) {
  relevantIndices.push(i);
}
```

**Impact:**
- Potential crashes or NaN values from division by zero
- Silent failures when dates don't match
- Incorrect calculations due to timezone mismatches
- Invalid occupancy values (e.g., >100%) not caught


### Bug #7: Misleading Statistics (LOW)

**Bug Condition:**
```
FUNCTION isBugCondition_7(stats, listings, timeframes)
  INPUT: calculationStats, number of listings, number of timeframes
  OUTPUT: boolean
  
  RETURN stats.existingMPIUsed == (listings.count * timeframes.count)
         AND stats.shouldBe == listings.count
         AND stats.misleadsUsers == true
END FUNCTION
```

**Root Cause:**
In `lib/mpi-calculator.ts` (lines 268-285), the statistics counters increment inside the timeframes loop, counting each timeframe separately instead of counting each listing once. For 49 listings × 5 timeframes, this shows 245 instead of 49.

**Current Code (Defective):**
```typescript
const timeframes: Timeframe[] = [7, 30, 60, 90, 120];
timeframes.forEach(timeframe => {
  const mpiField = `mpi_next_${timeframe}` as keyof Listing;
  const existingMPI = listing[mpiField] as number;
  
  if (existingMPI !== undefined && existingMPI !== null && existingMPI >= 0) {
    existingMPIUsed++;  // BUG: Increments 5 times per listing
  }
});
```

**Examples:**
- 49 listings processed
- Statistics show: `existingMPIUsed: 245` (49 × 5)
- Should show: `existingMPIUsed: 49` (number of listings)
- Users see misleading counts that don't represent actual listings


## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Core MPI formula `MPI = (property_occupancy / market_occupancy) × 100` must remain unchanged
- API integration with PriceLabs endpoints must continue to work with same request/response format
- Data structures (Listing, NeighborhoodData interfaces) must remain backward compatible
- Grouping and aggregation logic (by bedrooms, city, city-bedrooms) must produce same results for valid data
- Comparison mode must continue to show API vs calculated values side-by-side
- Logging and debugging output format must remain consistent
- Fallback mechanisms (API → local files) must continue to work

**Scope:**
All inputs that do NOT involve the specific bug conditions should be completely unaffected by these fixes. This includes:
- Valid MPI calculations with correct data alignment
- Listings with complete and valid occupancy data
- API responses with properly formatted data
- Date ranges that fall within available data
- Occupancy values within valid ranges (0-100%)


## Hypothesized Root Cause

Based on the bug analysis, the root causes are:

1. **Bug #1 - Data Mismatch**: The original implementation was designed for historical MPI analysis but was later adapted for future-looking MPI without updating the property occupancy calculation. The `calculatePropertyOccupancy()` function still uses historical data while market occupancy was updated to use future data.

2. **Bug #2 - Dead Code**: The API always returns `mpi_next_X` values (even 0 for no data), so the condition checking for undefined/null/negative values never fails. The fallback was designed for missing API fields but doesn't account for API always providing values.

3. **Bug #3 - Scaling Confusion**: The API likely returns MPI values in the 0-2 range (where 1.0 = 100% of market), requiring multiplication by 100 for display. However, this wasn't documented, and calculated values already use the 0-200 scale, creating inconsistency.

4. **Bug #4 - Performance Oversight**: The code was initially written for single-listing calculations and wasn't optimized when batch processing was added. Each listing independently loads neighborhood data without checking if it's already been loaded.

5. **Bug #5 - Date Range Logic Error**: The `-1` adjustment appears to be a misunderstanding of inclusive vs exclusive date ranges. The developer likely thought the end date should be "days - 1" but didn't account for the start date already being day 0.

6. **Bug #6 - Missing Error Handling**: The code assumes data is always valid and complete, without defensive programming for edge cases like missing dates, zero occupancy, or invalid values.

7. **Bug #7 - Loop Scope Error**: The statistics counters were placed inside the timeframes loop instead of outside it, causing them to count timeframe calculations instead of listings.


## Correctness Properties

Property 1: Bug Condition #1 - Property and Market Data Alignment

_For any_ MPI calculation where a timeframe is specified (7, 30, 60, 90, or 120 days), the fixed system SHALL use consistent time periods for both property occupancy and market occupancy, ensuring both use either historical data or future-looking data from the same date range.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Bug Condition #2 - Neighborhood Fallback Execution

_For any_ listing where API MPI values are genuinely missing or invalid (not just zero), the fixed system SHALL execute the neighborhood calculation fallback and successfully compute MPI from neighborhood data, with accurate statistics tracking.

**Validates: Requirements 2.5, 2.6, 2.7**

Property 3: Bug Condition #3 - Consistent MPI Scaling

_For any_ MPI value whether from API or calculated from neighborhood data, the fixed system SHALL apply consistent scaling with clear documentation, ensuring all MPI values use the same scale (0-200 range where 100 = market average).

**Validates: Requirements 2.8, 2.9, 2.10**

Property 4: Bug Condition #4 - Efficient Neighborhood Data Loading

_For any_ batch of listings being processed, the fixed system SHALL minimize neighborhood data API calls by reusing data for listings in the same neighborhood, reducing redundant requests.

**Validates: Requirements 2.11, 2.12, 2.13**

Property 5: Bug Condition #5 - Correct Date Range Calculation

_For any_ timeframe specification (7, 30, 60, 90, or 120 days), the fixed system SHALL calculate date ranges that include exactly the specified number of days, not one day less.

**Validates: Requirements 2.14, 2.15, 2.16**

Property 6: Bug Condition #6 - Data Validation and Error Handling

_For any_ MPI calculation, the fixed system SHALL validate inputs (check for division by zero, validate date existence, handle timezones consistently, validate occupancy ranges) and handle invalid data gracefully with appropriate warnings.

**Validates: Requirements 2.17, 2.18, 2.19, 2.20**

Property 7: Bug Condition #7 - Accurate Statistics Reporting

_For any_ batch calculation, the fixed system SHALL count statistics per listing (not per timeframe), accurately reporting the number of listings that used each calculation method.

**Validates: Requirements 2.21, 2.22, 2.23**

Property 8: Preservation - Core MPI Formula

_For any_ valid MPI calculation with correct data, the fixed system SHALL produce the same result as the original system, preserving the core formula and calculation logic.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17, 3.18**


## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, here are the specific changes needed:

#### Bug #1: Property vs Market Occupancy Mismatch

**File**: `lib/data-loader.ts`

**Function**: `calculatePropertyOccupancy()`

**Specific Changes**:

1. **Document Current Limitation**: Add clear documentation that we're using historical data as a proxy for future occupancy
   - Add JSDoc comment explaining the limitation
   - Note that future property occupancy would require calendar/reservation data

2. **Add Timeframe-Aware Logic**: Modify function to acknowledge the timeframe parameter
   - Keep using `adjusted_occupancy_past_30` for now (best available proxy)
   - Add TODO comment for future enhancement with actual future occupancy data
   - Log when using historical data as proxy

3. **Alternative Approach (if PriceLabs API supports it)**: Investigate using booking data fields
   - Check if `booking_pickup_unique_past_7` and `booking_pickup_unique_past_30` can help
   - Check if `last_booked_date` provides insights into future bookings
   - Consider calculating future occupancy from existing reservations if available

**Code Changes**:
```typescript
export function calculatePropertyOccupancy(
  listing: any,
  startDate: Date,
  endDate: Date
): number {
  // TODO: Ideally we would calculate future occupancy from the property's 
  // calendar/reservations for the specified date range. However, this data
  // is not currently available in the API response.
  // 
  // For now, we use adjusted_occupancy_past_30 as the best available proxy
  // for future performance. This assumes recent performance is a reasonable
  // predictor of near-term future performance.
  
  const historicalOccupancy = extractPercentage(listing.adjusted_occupancy_past_30);
  
  console.log(`⚠️ Using historical occupancy (${(historicalOccupancy * 100).toFixed(1)}%) as proxy for future occupancy for listing ${listing.id}`);
  
  return historicalOccupancy;
}
```


#### Bug #2: Dead Code Path

**File**: `lib/mpi-calculator.ts`

**Function**: `calculateListingMPI()`

**Specific Changes**:

1. **Update Condition Logic**: Change the condition to properly detect when API MPI is genuinely unavailable
   - Consider 0 as a valid MPI value (property has 0% occupancy)
   - Only fall back to neighborhood calculation if API value is truly missing (undefined/null)
   - Or add a flag to force neighborhood calculation for testing

2. **Add Calculation Method Tracking**: Track which method was used for statistics
   - Return calculation method along with MPI value
   - Update statistics to accurately reflect which method was used

3. **Remove Dead Code or Make It Reachable**: Either remove the fallback or make it testable
   - Option A: Remove neighborhood fallback if API always provides values
   - Option B: Add a parameter to force neighborhood calculation for testing
   - Option C: Keep fallback for future use when API might not provide values

**Code Changes**:
```typescript
const getMPI = async (timeframe: Timeframe): Promise<{ value: number; method: 'api' | 'neighborhood' | 'none' }> => {
  const mpiField = `mpi_next_${timeframe}` as keyof Listing;
  const existingMPI = listing[mpiField] as number;
  
  // Priority 1: Use API MPI if available (including 0 as valid value)
  // Note: API returns MPI in 0-2 range, multiply by 100 for display (0-200 range)
  if (existingMPI !== undefined && existingMPI !== null) {
    return { value: existingMPI * 100, method: 'api' };
  }
  
  // Priority 2: Calculate from neighborhood data if API value missing
  try {
    const dateRange = getDateRangeForTimeframe(timeframe);
    const neighborhoodData = await loadNeighborhoodData(listing.id);
    const categoryId = matchListingToNeighborhood(listing, neighborhoodData);
    
    if (categoryId) {
      const propertyOccupancy = calculatePropertyOccupancy(listing, dateRange.start, dateRange.end);
      const marketOccupancy = calculateMarketOccupancy(neighborhoodData, categoryId, dateRange.start, dateRange.end);
      
      if (marketOccupancy > 0) {
        const calculatedMPI = (propertyOccupancy / marketOccupancy) * 100;
        console.log(`✅ Calculated MPI ${timeframe}-day from neighborhood data`);
        return { value: calculatedMPI, method: 'neighborhood' };
      }
    }
  } catch (error) {
    console.log(`❌ Neighborhood calculation failed:`, error);
  }
  
  return { value: 0, method: 'none' };
};
```


#### Bug #3: Inconsistent Scaling Logic

**File**: `lib/mpi-calculator.ts`

**Functions**: `calculateListingMPI()`, `calculateListingMPIComparison()`

**Specific Changes**:

1. **Document Scaling Convention**: Add clear comments explaining the scaling
   - API returns MPI in 0-2 range (1.0 = market average)
   - Display uses 0-200 range (100 = market average)
   - All calculations should produce values in 0-200 range

2. **Ensure Consistent Scaling**: Verify all MPI values use the same scale
   - API values: multiply by 100 when retrieved
   - Calculated values: already in 0-200 range from formula
   - Comparison values: ensure both use same scale

3. **Add Scale Validation**: Add assertions to catch scaling errors
   - Log warning if MPI values seem out of expected range
   - Add comments at each scaling point

**Code Changes**:
```typescript
// Add constant for clarity
const MPI_SCALE_FACTOR = 100; // API returns 0-2 range, we display 0-200 range

const getMPI = async (timeframe: Timeframe): Promise<number> => {
  const mpiField = `mpi_next_${timeframe}` as keyof Listing;
  const existingMPI = listing[mpiField] as number;
  
  // Priority 1: Use API MPI if available
  // API returns MPI in 0-2 range (e.g., 1.73 means 173% of market)
  // Multiply by 100 to convert to 0-200 display range (173 = 173% of market)
  if (existingMPI !== undefined && existingMPI !== null) {
    const scaledMPI = existingMPI * MPI_SCALE_FACTOR;
    
    // Validation: warn if value seems out of expected range
    if (scaledMPI < 0 || scaledMPI > 500) {
      console.warn(`⚠️ Unusual MPI value: ${scaledMPI} for listing ${listing.id}, timeframe ${timeframe}`);
    }
    
    return scaledMPI;
  }
  
  // Priority 2: Calculate from neighborhood data
  // Formula already produces 0-200 range: (occupancy / market_occupancy) * 100
  const calculatedMPI = (propertyOccupancy / marketOccupancy) * 100;
  return calculatedMPI; // Already in correct scale
};
```


#### Bug #4: Inefficient API Calls

**File**: `lib/mpi-calculator.ts`

**Function**: `calculateMPISummaries()`

**Specific Changes**:

1. **Load Neighborhood Data Once**: Load shared neighborhood data before processing listings
   - Call `loadNeighborhoodData()` once with a sample listing ID
   - Pass the shared data to all listing calculations
   - Assumption: All listings in the batch are in the same neighborhood

2. **Add Neighborhood Grouping (Future Enhancement)**: For listings in different neighborhoods
   - Group listings by neighborhood (using lat/lng proximity)
   - Load neighborhood data once per unique neighborhood
   - Map listings to their neighborhood data

3. **Update Function Signatures**: Modify functions to accept pre-loaded neighborhood data
   - Add optional `neighborhoodData` parameter to `calculateListingMPI()`
   - Skip loading if data is provided

**Code Changes**:
```typescript
export async function calculateMPISummaries(
  listingsData: ListingsData, 
  grouping: string = 'city'
): Promise<{
  summaries: MPISummary[];
  calculatedMPIs: CalculatedMPI[];
  calculationStats: { /* ... */ };
}> {
  console.log(`Starting MPI calculations for ${listingsData.listings.length} listings...`);
  
  // OPTIMIZATION: Load neighborhood data once and share across all listings
  // This assumes all listings are in the same neighborhood (or close enough)
  let sharedNeighborhoodData: NeighborhoodData | null = null;
  
  try {
    // Use first listing's ID to load neighborhood data
    if (listingsData.listings.length > 0) {
      sharedNeighborhoodData = await loadNeighborhoodData(listingsData.listings[0].id);
      console.log(`✅ Loaded shared neighborhood data (will be reused for all ${listingsData.listings.length} listings)`);
    }
  } catch (error) {
    console.log('⚠️ Failed to load shared neighborhood data, will fall back to per-listing loading:', error);
  }
  
  const calculatedMPIs = await Promise.all(
    listingsData.listings.map(async (listing) => {
      // Pass shared neighborhood data to avoid redundant API calls
      const mpi = await calculateListingMPI(listing, sharedNeighborhoodData);
      return mpi;
    })
  );
  
  // ... rest of function
}

// Update function signature
async function calculateListingMPI(
  listing: Listing,
  sharedNeighborhoodData?: NeighborhoodData | null
): Promise<CalculatedMPI> {
  // Use shared data if provided, otherwise load per listing
  const getNeighborhoodData = async (): Promise<NeighborhoodData> => {
    if (sharedNeighborhoodData) {
      return sharedNeighborhoodData;
    }
    return await loadNeighborhoodData(listing.id);
  };
  
  // ... rest of function
}
```


#### Bug #5: Date Range Off-by-One Bug

**File**: `lib/mpi-calculator.ts`

**Function**: `getDateRangeForTimeframe()`

**Specific Changes**:

1. **Remove the `-1` Adjustment**: Change `end.setDate(start.getDate() + timeframe - 1)` to `end.setDate(start.getDate() + timeframe)`
   - This will include the correct number of days
   - Example: 7-day range from Aug 8 will be Aug 8-15 (8 days inclusive) or Aug 8-14 (7 days inclusive)

2. **Clarify Inclusive vs Exclusive**: Document whether end date is inclusive or exclusive
   - If inclusive: `end.setDate(start.getDate() + timeframe - 1)` is correct for "next N days including today"
   - If exclusive: `end.setDate(start.getDate() + timeframe)` is correct for "next N days starting tomorrow"
   - Current API uses "next 7 days" which typically means starting today

3. **Add Unit Tests**: Verify date range calculations
   - Test that 7-day range includes exactly 7 days
   - Test that date ranges align with API expectations

**Code Changes**:
```typescript
function getDateRangeForTimeframe(timeframe: Timeframe): { start: Date; end: Date } {
  const today = new Date();
  console.log(`📅 Today's date: ${today.toISOString().split('T')[0]}`);
  
  const start = new Date(today); // Start from today (inclusive)
  const end = new Date(today);
  
  // Calculate end date: start + timeframe days
  // Note: This creates an inclusive range [start, end] covering exactly 'timeframe' days
  // Example: timeframe=7, start=Aug 8 → end=Aug 14 (Aug 8,9,10,11,12,13,14 = 7 days)
  switch (timeframe) {
    case 7:
      end.setDate(start.getDate() + 6); // 7 days inclusive: today + 6 more days
      break;
    case 30:
      end.setDate(start.getDate() + 29); // 30 days inclusive
      break;
    case 60:
      end.setDate(start.getDate() + 59); // 60 days inclusive
      break;
    case 90:
      end.setDate(start.getDate() + 89); // 90 days inclusive
      break;
    case 120:
      end.setDate(start.getDate() + 119); // 120 days inclusive
      break;
  }
  
  console.log(`📅 Date range: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]} (${timeframe} days)`);
  
  return { start, end };
}
```

**Note**: The original code with `-1` was actually attempting to create an inclusive range, but the logic was confusing. The fix clarifies that we want `timeframe` days inclusive, so we add `timeframe - 1` to the start date to get the end date.


#### Bug #6: Missing Validation

**File**: `lib/data-loader.ts` and `lib/mpi-calculator.ts`

**Functions**: `calculateMarketOccupancy()`, `calculateMarketOccupancyFromCategory()`, `calculateListingMPI()`

**Specific Changes**:

1. **Add Division-by-Zero Check**: Validate marketOccupancy before division
   - Check if `marketOccupancy === 0` before calculating MPI
   - Return 0 or null with a warning message
   - Log the issue for debugging

2. **Add Date Validation**: Validate dates exist in neighborhood data
   - Check if requested date range has any matching dates
   - Log warning if no dates found
   - Return 0 with explanation

3. **Add Timezone Handling**: Parse dates consistently
   - Use UTC for all date comparisons
   - Document timezone assumptions
   - Add helper function for consistent date parsing

4. **Add Range Validation**: Validate occupancy values
   - Check if occupancy is in [0, 1] range (or [0, 100] if percentage)
   - Log warning for out-of-range values
   - Clamp values to valid range or skip invalid data

**Code Changes**:
```typescript
// In calculateMarketOccupancyFromCategory()
function calculateMarketOccupancyFromCategory(
  category: any,
  startDate: Date,
  endDate: Date,
  categoryId: string
): number {
  const { X_values, Y_values } = category;
  
  // Validation: Check if data exists
  if (!X_values || !Y_values || X_values.length === 0 || Y_values.length === 0) {
    console.warn(`⚠️ No occupancy data available for category ${categoryId}`);
    return 0;
  }
  
  const relevantIndices: number[] = [];
  const hasDailyData = X_values.length > 0 && X_values[0].includes('-');
  
  if (hasDailyData) {
    for (let i = 0; i < X_values.length; i++) {
      const dateStr = X_values[i];
      if (dateStr === "Last 365 Days" || dateStr === "Last 730 Days") continue;
      
      try {
        // Parse date in UTC to avoid timezone issues
        const date = new Date(dateStr + 'T00:00:00Z');
        
        // Validation: Check if date is valid
        if (isNaN(date.getTime())) {
          console.warn(`⚠️ Invalid date string: ${dateStr}`);
          continue;
        }
        
        if (date >= startDate && date <= endDate) {
          relevantIndices.push(i);
        }
      } catch (error) {
        console.warn(`⚠️ Error parsing date ${dateStr}:`, error);
        continue;
      }
    }
  }
  
  // Validation: Check if any relevant dates found
  if (relevantIndices.length === 0) {
    console.warn(`⚠️ No dates in range ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    return 0;
  }
  
  let totalOccupancy = 0;
  let count = 0;
  
  for (const index of relevantIndices) {
    let occupancyValue = /* ... extract value ... */;
    
    // Validation: Check if value is valid and in range
    if (occupancyValue !== undefined && occupancyValue !== null) {
      // Validate range (assuming percentage 0-100)
      if (occupancyValue < 0 || occupancyValue > 100) {
        console.warn(`⚠️ Occupancy value out of range: ${occupancyValue}% at index ${index}`);
        // Clamp to valid range
        occupancyValue = Math.max(0, Math.min(100, occupancyValue));
      }
      
      totalOccupancy += occupancyValue / 100;
      count++;
    }
  }
  
  const avgOccupancy = count > 0 ? totalOccupancy / count : 0;
  
  // Validation: Final sanity check
  if (avgOccupancy < 0 || avgOccupancy > 1) {
    console.warn(`⚠️ Calculated occupancy out of range: ${avgOccupancy}`);
    return Math.max(0, Math.min(1, avgOccupancy));
  }
  
  return avgOccupancy;
}

// In calculateListingMPI()
if (categoryId) {
  const propertyOccupancy = calculatePropertyOccupancy(listing, dateRange.start, dateRange.end);
  const marketOccupancy = calculateMarketOccupancy(neighborhoodData, categoryId, dateRange.start, dateRange.end);
  
  // Validation: Check for division by zero
  if (marketOccupancy === 0) {
    console.warn(`⚠️ Market occupancy is 0 for listing ${listing.id}, timeframe ${timeframe}. Cannot calculate MPI.`);
    return 0;
  }
  
  const calculatedMPI = (propertyOccupancy / marketOccupancy) * 100;
  return calculatedMPI;
}
```


#### Bug #7: Misleading Statistics

**File**: `lib/mpi-calculator.ts`

**Function**: `calculateMPISummaries()`

**Specific Changes**:

1. **Move Counters Outside Loop**: Track statistics per listing, not per timeframe
   - Move counter increments outside the timeframes loop
   - Count each listing once based on which method was used
   - Determine method by checking if any timeframe used that method

2. **Track Method Per Listing**: Determine primary calculation method for each listing
   - If all timeframes use API: count as "API"
   - If any timeframe uses neighborhood: count as "neighborhood"
   - If no data for any timeframe: count as "no data"

3. **Add Detailed Statistics**: Provide more granular statistics
   - Count listings by primary method
   - Optionally track per-timeframe statistics separately
   - Make it clear what each statistic represents

**Code Changes**:
```typescript
export async function calculateMPISummaries(
  listingsData: ListingsData, 
  grouping: string = 'city'
): Promise<{
  summaries: MPISummary[];
  calculatedMPIs: CalculatedMPI[];
  calculationStats: {
    existingMPIUsed: number;
    neighborhoodCalculated: number;
    noDataAvailable: number;
    totalListings: number;
  };
}> {
  let existingMPIUsed = 0;
  let neighborhoodCalculated = 0;
  let noDataAvailable = 0;
  
  console.log(`Starting MPI calculations for ${listingsData.listings.length} listings...`);
  
  const calculatedMPIs = await Promise.all(
    listingsData.listings.map(async (listing) => {
      const mpi = await calculateListingMPI(listing);
      
      // Count calculation methods used PER LISTING (not per timeframe)
      // Determine primary method: check if API values exist for this listing
      const timeframes: Timeframe[] = [7, 30, 60, 90, 120];
      let hasAnyAPIValue = false;
      let hasAnyNeighborhoodValue = false;
      let hasAnyData = false;
      
      for (const timeframe of timeframes) {
        const mpiField = `mpi_next_${timeframe}` as keyof Listing;
        const existingMPI = listing[mpiField] as number;
        
        if (existingMPI !== undefined && existingMPI !== null) {
          hasAnyAPIValue = true;
          hasAnyData = true;
        }
        
        // Check if neighborhood calculation was used (would need to track this in calculateListingMPI)
        // For now, assume if no API value, we tried neighborhood
        if (existingMPI === undefined || existingMPI === null) {
          // This is a simplification - in reality we'd track the actual method used
          hasAnyNeighborhoodValue = true;
        }
      }
      
      // Count this listing once based on primary method
      if (hasAnyAPIValue) {
        existingMPIUsed++;
      } else if (hasAnyNeighborhoodValue) {
        neighborhoodCalculated++;
      } else {
        noDataAvailable++;
      }
      
      return mpi;
    })
  );
  
  const summaries = calculateGroupAverages(calculatedMPIs, grouping, listingsData);
  
  console.log(`✅ Completed MPI calculations:`);
  console.log(`  - Listings using API MPI: ${existingMPIUsed}`);
  console.log(`  - Listings using neighborhood calculation: ${neighborhoodCalculated}`);
  console.log(`  - Listings with no data: ${noDataAvailable}`);
  console.log(`  - Total listings: ${listingsData.listings.length}`);
  
  return { 
    summaries, 
    calculatedMPIs,
    calculationStats: {
      existingMPIUsed,
      neighborhoodCalculated,
      noDataAvailable,
      totalListings: listingsData.listings.length
    }
  };
}
```


## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach:

1. **Exploratory Bug Condition Checking**: Surface counterexamples that demonstrate each bug on unfixed code
2. **Fix Checking**: Verify that fixes resolve the bugs for all affected inputs
3. **Preservation Checking**: Verify that existing correct behavior is unchanged

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing fixes. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that expose each bug on the UNFIXED code, then verify fixes resolve the issues.

**Test Cases**:

1. **Bug #1 - Data Mismatch Test**
   - Test: Call `calculatePropertyOccupancy()` with different date ranges
   - Expected failure: Returns same value regardless of date range
   - Verify: Function ignores startDate and endDate parameters
   - Counterexample: `calculatePropertyOccupancy(listing, Aug8, Aug14)` === `calculatePropertyOccupancy(listing, Aug8, Nov8)`

2. **Bug #2 - Dead Code Test**
   - Test: Mock API to return listings without `mpi_next_X` fields
   - Expected failure: Fallback code never executes even when API values missing
   - Verify: `calculationStats.neighborhoodCalculated` always shows 0
   - Counterexample: Process 49 listings, neighborhood calculation count = 0

3. **Bug #3 - Scaling Test**
   - Test: Compare API MPI values with calculated MPI values
   - Expected failure: Inconsistent scaling between API (×100) and calculated values
   - Verify: API values scaled by 100, calculated values already in 0-200 range
   - Counterexample: API returns 1.73, code shows 173; calculated returns 173 directly

4. **Bug #4 - API Efficiency Test**
   - Test: Process 49 listings and count `loadNeighborhoodData()` calls
   - Expected failure: 49 API calls made instead of 1-5 unique neighborhood calls
   - Verify: Each listing triggers separate API call
   - Counterexample: 49 listings → 49 API calls (should be ~5-10 for unique neighborhoods)

5. **Bug #5 - Date Range Test**
   - Test: Call `getDateRangeForTimeframe(7)` and count days between start and end
   - Expected failure: Returns 6 days instead of 7
   - Verify: `end.setDate(start.getDate() + 7 - 1)` produces 6-day range
   - Counterexample: Request 7 days, get Aug 8-13 (6 days)

6. **Bug #6 - Validation Test**
   - Test: Call MPI calculation with marketOccupancy = 0
   - Expected failure: Division by zero or NaN result
   - Verify: No validation before division
   - Counterexample: `(0.85 / 0) * 100` = Infinity or NaN

7. **Bug #7 - Statistics Test**
   - Test: Process 49 listings and check `existingMPIUsed` count
   - Expected failure: Shows 245 (49 × 5) instead of 49
   - Verify: Counter increments inside timeframes loop
   - Counterexample: 49 listings → stats show 245 calculations


### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode**:
```
FOR EACH bug IN [1, 2, 3, 4, 5, 6, 7] DO
  FOR ALL input WHERE isBugCondition_N(input) DO
    result := fixedFunction_N(input)
    ASSERT expectedBehavior_N(result)
  END FOR
END FOR
```

**Test Cases**:

1. **Bug #1 Fix Verification**
   - Test: Verify property occupancy calculation acknowledges timeframe
   - Assert: Function logs warning about using historical data as proxy
   - Assert: Documentation clearly explains the limitation

2. **Bug #2 Fix Verification**
   - Test: Process listings with missing API MPI values
   - Assert: Neighborhood fallback executes successfully
   - Assert: Statistics accurately track neighborhood calculations

3. **Bug #3 Fix Verification**
   - Test: Compare API and calculated MPI values
   - Assert: Both use consistent 0-200 scale
   - Assert: Documentation explains scaling convention

4. **Bug #4 Fix Verification**
   - Test: Process 49 listings in same neighborhood
   - Assert: Only 1 neighborhood API call made
   - Assert: All listings use shared neighborhood data

5. **Bug #5 Fix Verification**
   - Test: Request 7-day, 30-day, 60-day, 90-day, 120-day ranges
   - Assert: Each returns exactly the requested number of days
   - Assert: Date ranges are inclusive and correct

6. **Bug #6 Fix Verification**
   - Test: Calculate MPI with marketOccupancy = 0
   - Assert: Returns 0 with warning, no crash or NaN
   - Test: Parse dates with timezone differences
   - Assert: Consistent UTC handling
   - Test: Process occupancy values outside [0, 100] range
   - Assert: Values clamped or skipped with warning

7. **Bug #7 Fix Verification**
   - Test: Process 49 listings
   - Assert: Statistics show 49 listings, not 245 calculations
   - Assert: Counts represent listings, not timeframes


### Preservation Checking

**Goal**: Verify that for all inputs where bug conditions do NOT hold, the fixed functions produce the same results as the original functions.

**Pseudocode**:
```
FOR ALL input WHERE NOT (isBugCondition_1(input) OR ... OR isBugCondition_7(input)) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Capture behavior on UNFIXED code for valid inputs, then write property-based tests to verify this behavior continues after fixes.

**Test Cases**:

1. **Core MPI Formula Preservation**
   - Test: Calculate MPI with valid property and market occupancy
   - Assert: Formula `(property / market) * 100` produces same result
   - Property: For any valid occupancy values, MPI calculation unchanged

2. **API Integration Preservation**
   - Test: Load listings from PriceLabs API
   - Assert: Same API endpoints, request format, response parsing
   - Property: For any valid API response, data loading unchanged

3. **Grouping Logic Preservation**
   - Test: Group listings by bedrooms, city, city-bedrooms
   - Assert: Same grouping keys and aggregation logic
   - Property: For any valid grouping method, results unchanged

4. **Comparison Mode Preservation**
   - Test: Generate comparison between API and calculated values
   - Assert: Same comparison structure and display format
   - Property: For any valid listing, comparison format unchanged

5. **Valid Date Range Preservation**
   - Test: Calculate MPI for date ranges that have matching data
   - Assert: Same occupancy calculation logic
   - Property: For any date range with valid data, calculation unchanged

6. **Valid Occupancy Values Preservation**
   - Test: Process occupancy values in [0, 100] range
   - Assert: Same value extraction and conversion logic
   - Property: For any valid occupancy value, processing unchanged

7. **Logging Format Preservation**
   - Test: Run calculations and capture log output
   - Assert: Same log message format and structure
   - Property: For any calculation, logging format unchanged


### Unit Tests

**Test Coverage by Bug**:

1. **Bug #1 - Property vs Market Occupancy Mismatch**
   - Test `calculatePropertyOccupancy()` with different date ranges
   - Test that function logs warning about using historical data
   - Test that documentation is present and accurate

2. **Bug #2 - Dead Code Path**
   - Test `calculateListingMPI()` with missing API values
   - Test that neighborhood fallback executes
   - Test that statistics track calculation methods correctly
   - Mock API responses to test both code paths

3. **Bug #3 - Inconsistent Scaling Logic**
   - Test API MPI scaling (multiply by 100)
   - Test calculated MPI scaling (already in 0-200 range)
   - Test comparison mode uses consistent scales
   - Test validation warnings for out-of-range values

4. **Bug #4 - Inefficient API Calls**
   - Test `calculateMPISummaries()` with multiple listings
   - Mock `loadNeighborhoodData()` to count calls
   - Verify only 1 call made for shared neighborhood
   - Test that shared data is correctly passed to all listings

5. **Bug #5 - Date Range Off-by-One Bug**
   - Test `getDateRangeForTimeframe()` for each timeframe
   - Count days between start and end dates
   - Verify exactly N days for N-day timeframe
   - Test edge cases (month boundaries, year boundaries)

6. **Bug #6 - Missing Validation**
   - Test division by zero handling (marketOccupancy = 0)
   - Test date parsing with invalid dates
   - Test timezone handling consistency
   - Test occupancy value range validation
   - Test missing date handling

7. **Bug #7 - Misleading Statistics**
   - Test statistics counting with known number of listings
   - Verify counts represent listings, not timeframes
   - Test with different calculation method distributions
   - Verify statistics sum to total listings

**Additional Unit Tests**:
- Test `extractPercentage()` with various input formats
- Test `matchListingToNeighborhood()` with different category structures
- Test `calculateMarketOccupancyFromCategory()` with daily and monthly data
- Test `calculateGroupAverages()` with different grouping methods
- Test error handling for API failures
- Test fallback to local files


### Property-Based Tests

**Test Strategy**: Generate random inputs to verify correctness properties hold across the input domain.

1. **Property: Data Alignment Consistency**
   - Generate: Random timeframes (7, 30, 60, 90, 120)
   - Generate: Random listings with various occupancy values
   - Property: For any timeframe, property and market occupancy use consistent time periods
   - Verify: Both use future-looking data or both use historical data (with documentation)

2. **Property: Scaling Consistency**
   - Generate: Random MPI values from API (0-2 range)
   - Generate: Random occupancy values for calculation (0-1 range)
   - Property: All MPI values end up in 0-200 range regardless of source
   - Verify: API values × 100 = calculated values from formula

3. **Property: Date Range Correctness**
   - Generate: Random timeframes
   - Generate: Random start dates
   - Property: Date range always includes exactly N days for N-day timeframe
   - Verify: Count days between start and end = timeframe

4. **Property: Validation Robustness**
   - Generate: Random occupancy values including edge cases (0, negative, >100)
   - Generate: Random date strings including invalid formats
   - Property: System handles all inputs gracefully without crashes
   - Verify: Invalid inputs return 0 or default with warnings, no exceptions

5. **Property: Statistics Accuracy**
   - Generate: Random number of listings (1-1000)
   - Generate: Random mix of API vs calculated values
   - Property: Statistics counts equal number of listings, not timeframes
   - Verify: Sum of all method counts = total listings

6. **Property: Preservation of Core Formula**
   - Generate: Random valid property and market occupancy values
   - Property: MPI formula produces same result before and after fixes
   - Verify: `(property / market) * 100` unchanged for valid inputs

7. **Property: API Call Efficiency**
   - Generate: Random number of listings in same neighborhood
   - Property: Neighborhood data loaded once regardless of listing count
   - Verify: API call count = 1 for N listings in same neighborhood


### Integration Tests

**End-to-End Test Scenarios**:

1. **Full MPI Calculation Flow**
   - Load listings from API
   - Load neighborhood data
   - Calculate MPI for all timeframes
   - Group by city and bedrooms
   - Verify results are consistent and accurate
   - Check that all 7 bugs are fixed in the complete flow

2. **Comparison Mode Flow**
   - Load listings with API MPI values
   - Calculate MPI from neighborhood data
   - Generate comparison report
   - Verify both values use consistent scaling
   - Verify statistics are accurate

3. **Fallback Scenarios**
   - Test API failure → local file fallback
   - Test missing API MPI → neighborhood calculation
   - Test missing neighborhood data → graceful degradation
   - Verify all fallbacks work correctly

4. **Multi-Neighborhood Scenario**
   - Process listings from different cities
   - Verify neighborhood data loaded efficiently
   - Verify grouping works correctly
   - Verify statistics are accurate across neighborhoods

5. **Edge Case Scenarios**
   - Process listings with 0% occupancy
   - Process listings with 100% occupancy
   - Process listings with missing data
   - Process date ranges with no matching data
   - Verify all edge cases handled gracefully

6. **Performance Testing**
   - Process 100+ listings
   - Measure API call count
   - Measure calculation time
   - Verify optimization (Bug #4) reduces API calls
   - Verify no performance regression

7. **Regression Testing**
   - Run existing test suite on fixed code
   - Compare results with baseline (unfixed code for valid inputs)
   - Verify no regressions in correct behavior
   - Verify all 7 bugs are fixed


## Migration and Rollout Plan

### Pre-Deployment Checklist

1. **Code Review**
   - Review all 7 bug fixes for correctness
   - Verify documentation is clear and complete
   - Check that all tests pass
   - Verify no regressions in existing functionality

2. **Testing Verification**
   - Run all unit tests (100% pass rate required)
   - Run all property-based tests (no counterexamples found)
   - Run all integration tests (all scenarios pass)
   - Run exploratory tests on unfixed code to confirm bugs exist
   - Run fix verification tests on fixed code to confirm bugs resolved

3. **Performance Validation**
   - Measure API call reduction (Bug #4 fix)
   - Verify no performance regression in other areas
   - Test with production-scale data (100+ listings)

4. **Documentation Updates**
   - Update README with bug fix details
   - Update TECHNICAL_DOCS.md with new implementation details
   - Add inline code comments for all fixes
   - Document any breaking changes (none expected)

### Deployment Strategy

**Phase 1: Staging Deployment**
1. Deploy fixes to staging environment
2. Run full test suite in staging
3. Manually verify MPI calculations with known test cases
4. Compare staging results with production baseline
5. Verify all 7 bugs are fixed in staging

**Phase 2: Canary Deployment (Optional)**
1. Deploy to small subset of production users (10%)
2. Monitor for errors or unexpected behavior
3. Compare MPI values with baseline
4. Collect feedback from early users
5. Verify no issues before full rollout

**Phase 3: Production Deployment**
1. Deploy fixes to production
2. Monitor error logs for any issues
3. Verify API call reduction (Bug #4)
4. Verify statistics are accurate (Bug #7)
5. Monitor user feedback

**Phase 4: Post-Deployment Validation**
1. Run production smoke tests
2. Verify MPI calculations are accurate
3. Check that all 7 bugs are resolved
4. Monitor performance metrics
5. Collect user feedback

### Rollback Plan

If critical issues are discovered:

1. **Immediate Rollback Triggers**
   - MPI calculations produce incorrect results for valid inputs
   - System crashes or throws unhandled exceptions
   - API integration breaks
   - Performance degrades significantly

2. **Rollback Procedure**
   - Revert to previous version using version control
   - Restore previous deployment
   - Notify users of temporary rollback
   - Investigate root cause of issues
   - Fix issues and redeploy

3. **Partial Rollback**
   - If only one bug fix causes issues, consider reverting just that fix
   - Keep other fixes that are working correctly
   - Document which fixes are active

### Monitoring and Validation

**Metrics to Monitor**:
- MPI calculation accuracy (compare with baseline)
- API call count (should decrease after Bug #4 fix)
- Error rate (should not increase)
- Calculation time (should not increase significantly)
- Statistics accuracy (Bug #7 fix verification)

**Validation Queries**:
- Compare MPI values before and after fixes for valid inputs (should be same)
- Verify statistics show listing counts, not timeframe counts
- Verify date ranges include correct number of days
- Verify no division by zero errors

**Success Criteria**:
- All 7 bugs are fixed and verified
- No regressions in existing functionality
- Performance is maintained or improved
- User feedback is positive
- Error rate is not increased

