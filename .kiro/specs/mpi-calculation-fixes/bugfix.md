# Bugfix Requirements Document

## Introduction

This document specifies the requirements for fixing critical bugs in the Market Penetration Index (MPI) calculator for vacation rentals. The MPI formula is: `MPI = (property_occupancy / market_occupancy) × 100`, which compares a property's performance against the market average.

The current implementation contains seven distinct bugs that compromise the accuracy and reliability of MPI calculations:

1. **Property vs Market Occupancy Mismatch (CRITICAL)** - Comparing historical property data with future market forecasts
2. **Dead Code Path (HIGH)** - Neighborhood calculation fallback never executes
3. **Inconsistent Scaling Logic (MEDIUM)** - API MPI values scaled inconsistently
4. **Inefficient API Calls (MEDIUM)** - Redundant neighborhood API calls per listing
5. **Date Range Off-by-One Bug (LOW)** - Incorrect date range calculations
6. **Missing Validation (MEDIUM)** - No division-by-zero or data validation checks
7. **Misleading Statistics (LOW)** - Calculation statistics count timeframes instead of listings

These bugs affect the core business logic and must be fixed to ensure accurate MPI reporting for property managers.

## Bug Analysis

### Current Behavior (Defect)

#### 1. Property vs Market Occupancy Mismatch

1.1 WHEN calculating MPI for any timeframe (7, 30, 60, 90, or 120 days) THEN the system uses `adjusted_occupancy_past_30` (historical data) for property occupancy AND uses "Future Occ/New/Canc" section (future forecast data) for market occupancy, creating meaningless comparisons between past performance and future forecasts

1.2 WHEN `calculatePropertyOccupancy()` is called THEN the system always returns the same past 30-day occupancy value regardless of the requested date range (startDate, endDate parameters are ignored)

1.3 WHEN `calculateMarketOccupancy()` is called THEN the system uses future-looking occupancy data from the "Future Occ/New/Canc" section that corresponds to the requested date range

#### 2. Dead Code Path

2.1 WHEN `calculateListingMPI()` checks for existing MPI values THEN the condition `if (existingMPI !== undefined && existingMPI !== null && existingMPI >= 0)` always evaluates to true because all listings have `mpi_next_X` values in the API response

2.2 WHEN the neighborhood calculation fallback code (Priority 2) is reached THEN it never executes in production because Priority 1 always succeeds

2.3 WHEN `calculationStats` are generated THEN `neighborhoodCalculated` always shows 0 because the fallback path is never taken

#### 3. Inconsistent Scaling Logic

3.1 WHEN API MPI values are retrieved THEN the system multiplies them by 100 (`return existingMPI * 100`) without clear documentation of why this scaling is necessary

3.2 WHEN comparison mode calculates API MPI values THEN it scales them by 100 (`const api_mpi_7 = (listing.mpi_next_7 ?? 0) * 100`)

3.3 WHEN neighborhood-calculated MPI values are computed THEN they are already in the 0-200 range (formula: `(propertyOccupancy / marketOccupancy) * 100`) and may be compared against scaled API values inconsistently

#### 4. Inefficient API Calls

4.1 WHEN `calculateMPISummaries()` processes multiple listings THEN it calls `calculateListingMPI()` for each listing in `Promise.all()`

4.2 WHEN each `calculateListingMPI()` executes THEN it calls `loadNeighborhoodData(listing.id)` separately for each listing, potentially making 49 separate API calls

4.3 WHEN neighborhood data is the same for listings in the same area THEN the system does not reuse or batch the neighborhood data requests

#### 5. Date Range Off-by-One Bug

5.1 WHEN `getDateRangeForTimeframe(7)` is called THEN it calculates `end.setDate(start.getDate() + 7 - 1)`, resulting in only 6 days instead of 7

5.2 WHEN `getDateRangeForTimeframe(30)` is called THEN it calculates `end.setDate(start.getDate() + 30 - 1)`, resulting in only 29 days instead of 30

5.3 WHEN any timeframe calculation is performed THEN the `-1` adjustment incorrectly reduces the date range by one day

#### 6. Missing Validation

6.1 WHEN `calculateMarketOccupancy()` returns 0 THEN the MPI calculation `(propertyOccupancy / marketOccupancy) * 100` attempts division by zero without validation

6.2 WHEN date matching occurs in `calculateMarketOccupancyFromCategory()` THEN the system does not validate that the requested dates exist in the neighborhood data before attempting calculations

6.3 WHEN date strings are parsed THEN the system does not handle timezone differences, potentially causing date mismatches

6.4 WHEN occupancy values are extracted THEN the system does not validate that values are within expected ranges (0-100%)

#### 7. Misleading Statistics

7.1 WHEN `calculationStats` are generated in `calculateMPISummaries()` THEN the counters increment for each timeframe (5 times per listing) instead of once per listing

7.2 WHEN statistics are displayed THEN `existingMPIUsed` shows a count of timeframes (e.g., 245 for 49 listings × 5 timeframes) rather than the number of listings that used existing MPI

7.3 WHEN users view the statistics THEN they see misleading numbers that don't represent the actual number of listings processed

### Expected Behavior (Correct)

#### 1. Property vs Market Occupancy Mismatch - Fixed

2.1 WHEN calculating MPI for any timeframe THEN the system SHALL use consistent time periods for both property and market occupancy (either both historical or both future-looking)

2.2 WHEN future-looking MPI is calculated THEN the system SHALL use future occupancy projections for the property (if available) or clearly document that historical data is being used as a proxy

2.3 WHEN `calculatePropertyOccupancy()` is called with a date range THEN the system SHALL respect the startDate and endDate parameters and calculate occupancy for that specific period

2.4 WHEN `calculateMarketOccupancy()` is called THEN the system SHALL use occupancy data from the same time period as the property occupancy calculation

#### 2. Dead Code Path - Fixed

2.5 WHEN `calculateListingMPI()` checks for existing MPI values THEN the system SHALL properly detect when API values are missing or invalid and fall back to neighborhood calculations

2.6 WHEN neighborhood calculation fallback is needed THEN the system SHALL execute the Priority 2 code path and successfully calculate MPI from neighborhood data

2.7 WHEN `calculationStats` are generated THEN `neighborhoodCalculated` SHALL accurately reflect the number of calculations performed using neighborhood data

#### 3. Inconsistent Scaling Logic - Fixed

2.8 WHEN API MPI values are retrieved THEN the system SHALL apply consistent scaling with clear documentation explaining the scaling factor

2.9 WHEN comparing API MPI values with calculated MPI values THEN the system SHALL ensure both are on the same scale before comparison

2.10 WHEN MPI values are displayed THEN the system SHALL use a consistent scale (e.g., 100 = market average) across all calculation methods

#### 4. Inefficient API Calls - Fixed

2.11 WHEN processing multiple listings in the same neighborhood THEN the system SHALL reuse neighborhood data instead of making redundant API calls

2.12 WHEN `calculateMPISummaries()` is called THEN the system SHALL load neighborhood data once and share it across all listings in the same area

2.13 WHEN API rate limits or performance are concerns THEN the system SHALL minimize the number of neighborhood data requests

#### 5. Date Range Off-by-One Bug - Fixed

2.14 WHEN `getDateRangeForTimeframe(7)` is called THEN the system SHALL calculate `end.setDate(start.getDate() + 7)` to include exactly 7 days

2.15 WHEN `getDateRangeForTimeframe(30)` is called THEN the system SHALL calculate `end.setDate(start.getDate() + 30)` to include exactly 30 days

2.16 WHEN any timeframe calculation is performed THEN the system SHALL include the correct number of days as specified by the timeframe parameter

#### 6. Missing Validation - Fixed

2.17 WHEN `marketOccupancy` is 0 THEN the system SHALL check for division by zero before calculating MPI and return an appropriate value (e.g., 0 or null) with a warning

2.18 WHEN date matching occurs THEN the system SHALL validate that requested dates exist in the neighborhood data and handle missing dates gracefully

2.19 WHEN date strings are parsed THEN the system SHALL handle timezone conversions consistently to avoid date mismatches

2.20 WHEN occupancy values are extracted THEN the system SHALL validate that values are within expected ranges and handle invalid values appropriately

#### 7. Misleading Statistics - Fixed

2.21 WHEN `calculationStats` are generated THEN the system SHALL count each listing once, not once per timeframe

2.22 WHEN statistics are displayed THEN `existingMPIUsed` SHALL show the number of listings that used existing MPI values, not the total number of timeframe calculations

2.23 WHEN users view the statistics THEN they SHALL see accurate counts that represent the number of listings processed by each calculation method

### Unchanged Behavior (Regression Prevention)

#### Core MPI Calculation Formula

3.1 WHEN MPI is calculated THEN the system SHALL CONTINUE TO use the formula `MPI = (property_occupancy / market_occupancy) × 100`

3.2 WHEN property occupancy is higher than market occupancy THEN the system SHALL CONTINUE TO return MPI values greater than 100

3.3 WHEN property occupancy is lower than market occupancy THEN the system SHALL CONTINUE TO return MPI values less than 100

#### API Integration

3.4 WHEN listings data is loaded THEN the system SHALL CONTINUE TO try the PriceLabs API first with fallback to local files

3.5 WHEN neighborhood data is loaded THEN the system SHALL CONTINUE TO use the PriceLabs API endpoint format `https://api.pricelabs.co/v1/neighborhood_data?pms=hostaway&listing_id={listingId}&api_key={apiKey}`

3.6 WHEN API calls fail THEN the system SHALL CONTINUE TO fall back to local JSON files in the public directory

#### Data Structure and Types

3.7 WHEN processing listings THEN the system SHALL CONTINUE TO use the existing `Listing` interface with all current fields

3.8 WHEN processing neighborhood data THEN the system SHALL CONTINUE TO support the existing `NeighborhoodData` structure with "Market KPI", "Future Percentile Prices", and "Future Occ/New/Canc" sections

3.9 WHEN calculating MPI for multiple timeframes THEN the system SHALL CONTINUE TO support 7, 30, 60, 90, and 120-day timeframes

#### Grouping and Aggregation

3.10 WHEN grouping listings THEN the system SHALL CONTINUE TO support grouping by 'bedrooms', 'city', 'city-bedrooms', and custom 'group' fields

3.11 WHEN calculating group averages THEN the system SHALL CONTINUE TO average MPI values across all listings in each group

3.12 WHEN sorting results THEN the system SHALL CONTINUE TO sort groups alphabetically by group name

#### Comparison Mode

3.13 WHEN comparison mode is enabled THEN the system SHALL CONTINUE TO provide both API MPI values and calculated MPI values side-by-side

3.14 WHEN displaying comparisons THEN the system SHALL CONTINUE TO show which calculation method was used for each timeframe

3.15 WHEN calculating comparison summaries THEN the system SHALL CONTINUE TO aggregate both API and calculated values by group

#### Logging and Debugging

3.16 WHEN calculations are performed THEN the system SHALL CONTINUE TO log detailed information about data sources, calculations, and results

3.17 WHEN errors occur THEN the system SHALL CONTINUE TO log error messages with context about what failed

3.18 WHEN fallbacks are used THEN the system SHALL CONTINUE TO log which fallback was triggered and why
