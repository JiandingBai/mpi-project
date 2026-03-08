# Implementation Plan - MPI Calculation Fixes

## Phase 1: Exploratory Bug Condition Testing (BEFORE Fixes)

### Bug #1: Property vs Market Occupancy Mismatch

- [x] 1.1 Write bug condition exploration test
  - **Property 1: Bug Condition** - Property Occupancy Ignores Date Range
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate property occupancy returns same value regardless of date range
  - **Scoped PBT Approach**: Test that `calculatePropertyOccupancy(listing, Aug8, Aug14)` === `calculatePropertyOccupancy(listing, Aug8, Nov8)` for any listing
  - Test implementation: Call `calculatePropertyOccupancy()` with different date ranges (7-day, 30-day, 120-day)
  - Assert: Function should use date range parameters but currently returns same value for all ranges
  - Run test on UNFIXED code in `lib/data-loader.ts`
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples: Same occupancy value returned for different date ranges
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

### Bug #2: Dead Code Path

- [x] 1.2 Write bug condition exploration test
  - **Property 1: Bug Condition** - Neighborhood Fallback Never Executes
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate neighborhood fallback code never runs
  - **Scoped PBT Approach**: Process listings and verify `calculationStats.neighborhoodCalculated` always equals 0
  - Test implementation: Mock API to return listings with `mpi_next_X` fields (even if 0)
  - Assert: Neighborhood fallback should execute when API values are invalid, but currently never runs
  - Run test on UNFIXED code in `lib/mpi-calculator.ts` (lines 60-91)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples: `calculationStats.neighborhoodCalculated` = 0 for all 49 listings
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.5, 2.6, 2.7_

### Bug #3: Inconsistent Scaling Logic

- [x] 1.3 Write bug condition exploration test
  - **Property 1: Bug Condition** - API and Calculated MPI Use Different Scales
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate inconsistent scaling between API and calculated values
  - **Scoped PBT Approach**: Compare API MPI (multiplied by 100) with calculated MPI (already in 0-200 range)
  - Test implementation: Get API MPI value (e.g., 1.73) and verify it's scaled by 100 (173)
  - Assert: Both API and calculated values should use same scale with clear documentation
  - Run test on UNFIXED code in `lib/mpi-calculator.ts` (lines 63, 186-190)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples: API value 1.73 → 173 (×100), calculated value already 173 (no scaling)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.8, 2.9, 2.10_

### Bug #4: Inefficient API Calls

- [ ] 1.4 Write bug condition exploration test
  - **Property 1: Bug Condition** - Redundant Neighborhood API Calls
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate redundant API calls for same neighborhood
  - **Scoped PBT Approach**: Process 49 listings and count `loadNeighborhoodData()` calls
  - Test implementation: Mock `loadNeighborhoodData()` to count invocations
  - Assert: Should make 1 call for shared neighborhood, but currently makes 49 calls
  - Run test on UNFIXED code in `lib/mpi-calculator.ts` (lines 54-104)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples: 49 listings → 49 API calls (should be 1 for same neighborhood)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.11, 2.12, 2.13_

### Bug #5: Date Range Off-by-One Bug

- [x] 1.5 Write bug condition exploration test
  - **Property 1: Bug Condition** - Date Ranges One Day Short
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate date ranges are one day shorter than requested
  - **Scoped PBT Approach**: For each timeframe (7, 30, 60, 90, 120), verify actual days in range
  - Test implementation: Call `getDateRangeForTimeframe(7)` and count days between start and end
  - Assert: Should return 7 days, but currently returns 6 days
  - Run test on UNFIXED code in `lib/mpi-calculator.ts` (lines 16-35)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples: Request 7 days → get Aug 8-13 (6 days), Request 30 days → get 29 days
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.14, 2.15, 2.16_

### Bug #6: Missing Validation

- [ ] 1.6 Write bug condition exploration test
  - **Property 1: Bug Condition** - No Division by Zero Check
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate missing validation causes crashes or invalid results
  - **Scoped PBT Approach**: Test with marketOccupancy = 0, invalid dates, out-of-range occupancy values
  - Test implementation: Call MPI calculation with `marketOccupancy = 0`
  - Assert: Should handle gracefully with warning, but currently produces Infinity or NaN
  - Run test on UNFIXED code in `lib/mpi-calculator.ts` (line 82) and `lib/data-loader.ts` (lines 107-167)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples: `(0.85 / 0) * 100` = Infinity, invalid dates cause silent failures
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.17, 2.18, 2.19, 2.20_

### Bug #7: Misleading Statistics

- [ ] 1.7 Write bug condition exploration test
  - **Property 1: Bug Condition** - Statistics Count Timeframes Not Listings
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate statistics count timeframes instead of listings
  - **Scoped PBT Approach**: Process 49 listings and verify `existingMPIUsed` count
  - Test implementation: Process 49 listings with 5 timeframes each
  - Assert: Should show 49 listings, but currently shows 245 (49 × 5)
  - Run test on UNFIXED code in `lib/mpi-calculator.ts` (lines 268-285)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples: 49 listings → stats show 245 (counting timeframes not listings)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.21, 2.22, 2.23_

## Phase 2: Preservation Property Tests (BEFORE Fixes)

- [ ] 2.1 Write preservation property tests (BEFORE implementing fixes)
  - **Property 2: Preservation** - Core MPI Formula and Valid Calculations
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Run UNFIXED code with valid inputs (non-zero occupancy, valid dates, proper data alignment)
  - Observe: MPI formula `(property / market) * 100` produces correct results for valid data
  - Observe: API integration, grouping logic, comparison mode work correctly
  - Write property-based tests capturing these behaviors:
    - For any valid property occupancy (0-1) and market occupancy (>0), MPI = (property / market) * 100
    - For any valid API response, data loading and parsing work correctly
    - For any valid grouping method (city, bedrooms, city-bedrooms), aggregation produces consistent results
    - For any valid date range with matching data, occupancy calculations work correctly
    - For any valid occupancy values in [0, 100] range, value extraction works correctly
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17, 3.18_

## Phase 3: Implementation

### Bug #1: Property vs Market Occupancy Mismatch (CRITICAL)

- [ ] 3.1 Fix property occupancy calculation to acknowledge timeframe

  - [x] 3.1.1 Update `calculatePropertyOccupancy()` in `lib/data-loader.ts`
    - Add JSDoc comment explaining current limitation (using historical data as proxy)
    - Add console.log warning when using historical data as proxy for future occupancy
    - Add TODO comment for future enhancement with actual future occupancy data
    - Keep using `adjusted_occupancy_past_30` for now (best available proxy)
    - Document that this assumes recent performance predicts near-term future performance
    - _Bug_Condition: isBugCondition_1(calculation) where propertyOccupancy.source == "adjusted_occupancy_past_30" AND marketOccupancy.source == "Future Occ/New/Canc"_
    - _Expected_Behavior: Function acknowledges timeframe parameter and documents limitation_
    - _Preservation: Core MPI formula unchanged, API integration unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.1.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Property Occupancy Documents Limitation
    - **IMPORTANT**: Re-run the SAME test from task 1.1 - do NOT write a new test
    - The test from task 1.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed with proper documentation)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.1.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Core MPI Formula Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2.1 - do NOT write new tests
    - Run preservation property tests from step 2.1
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

### Bug #2: Dead Code Path (HIGH)

- [ ] 3.2 Fix neighborhood fallback condition logic

  - [x] 3.2.1 Update `calculateListingMPI()` in `lib/mpi-calculator.ts`
    - Change condition to properly detect when API MPI is genuinely unavailable
    - Consider 0 as a valid MPI value (property has 0% occupancy)
    - Only fall back to neighborhood calculation if API value is truly missing (undefined/null)
    - Update return type to include calculation method: `{ value: number; method: 'api' | 'neighborhood' | 'none' }`
    - Add console.log when neighborhood calculation is used
    - Remove dead code or make it reachable for testing
    - _Bug_Condition: isBugCondition_2(listing, existingMPI) where existingMPI always defined and fallback never executes_
    - _Expected_Behavior: Neighborhood fallback executes when API values genuinely missing_
    - _Preservation: Core MPI formula unchanged, API integration unchanged_
    - _Requirements: 2.5, 2.6, 2.7_

  - [ ] 3.2.2 Update statistics tracking in `calculateMPISummaries()`
    - Track calculation method returned from `calculateListingMPI()`
    - Update statistics to accurately reflect which method was used
    - Ensure `calculationStats.neighborhoodCalculated` increments when fallback used
    - _Requirements: 2.5, 2.6, 2.7_

  - [ ] 3.2.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Neighborhood Fallback Executes
    - **IMPORTANT**: Re-run the SAME test from task 1.2 - do NOT write a new test
    - The test from task 1.2 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1.2
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.5, 2.6, 2.7_

  - [ ] 3.2.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Core MPI Formula Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2.1 - do NOT write new tests
    - Run preservation property tests from step 2.1
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

### Bug #3: Inconsistent Scaling Logic (MEDIUM)

- [ ] 3.3 Fix MPI scaling consistency

  - [ ] 3.3.1 Document scaling convention in `lib/mpi-calculator.ts`
    - Add constant `MPI_SCALE_FACTOR = 100` with clear comment
    - Document that API returns MPI in 0-2 range (1.0 = market average)
    - Document that display uses 0-200 range (100 = market average)
    - Add comments at each scaling point explaining the conversion
    - _Bug_Condition: isBugCondition_3(apiMPI, calculatedMPI) where scales are inconsistent_
    - _Expected_Behavior: All MPI values use consistent 0-200 scale with clear documentation_
    - _Preservation: Core MPI formula unchanged, API integration unchanged_
    - _Requirements: 2.8, 2.9, 2.10_

  - [ ] 3.3.2 Add scale validation
    - Add warning log if MPI values seem out of expected range (< 0 or > 500)
    - Add comments explaining why API values are multiplied by 100
    - Verify calculated values already in 0-200 range from formula
    - _Requirements: 2.8, 2.9, 2.10_

  - [ ] 3.3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Consistent MPI Scaling
    - **IMPORTANT**: Re-run the SAME test from task 1.3 - do NOT write a new test
    - The test from task 1.3 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1.3
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.8, 2.9, 2.10_

  - [ ] 3.3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Core MPI Formula Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2.1 - do NOT write new tests
    - Run preservation property tests from step 2.1
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

### Bug #4: Inefficient API Calls (MEDIUM)

- [ ] 3.4 Optimize neighborhood data loading

  - [ ] 3.4.1 Update `calculateMPISummaries()` in `lib/mpi-calculator.ts`
    - Load neighborhood data once before processing listings
    - Use first listing's ID to load shared neighborhood data
    - Add console.log indicating shared data will be reused
    - Handle errors gracefully if shared loading fails
    - _Bug_Condition: isBugCondition_4(listings, apiCalls) where each listing triggers separate API call_
    - _Expected_Behavior: Neighborhood data loaded once and shared across all listings_
    - _Preservation: Core MPI formula unchanged, API integration unchanged_
    - _Requirements: 2.11, 2.12, 2.13_

  - [ ] 3.4.2 Update `calculateListingMPI()` function signature
    - Add optional parameter `sharedNeighborhoodData?: NeighborhoodData | null`
    - Use shared data if provided, otherwise load per listing
    - Add helper function `getNeighborhoodData()` to handle logic
    - _Requirements: 2.11, 2.12, 2.13_

  - [ ] 3.4.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Efficient Neighborhood Loading
    - **IMPORTANT**: Re-run the SAME test from task 1.4 - do NOT write a new test
    - The test from task 1.4 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1.4
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - only 1 API call for 49 listings)
    - _Requirements: 2.11, 2.12, 2.13_

  - [ ] 3.4.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Core MPI Formula Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2.1 - do NOT write new tests
    - Run preservation property tests from step 2.1
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

### Bug #5: Date Range Off-by-One Bug (LOW)

- [ ] 3.5 Fix date range calculation

  - [ ] 3.5.1 Update `getDateRangeForTimeframe()` in `lib/mpi-calculator.ts`
    - Change `end.setDate(start.getDate() + timeframe - 1)` to create correct inclusive range
    - For 7-day range: `end.setDate(start.getDate() + 6)` (today + 6 more days = 7 days total)
    - For 30-day range: `end.setDate(start.getDate() + 29)` (today + 29 more days = 30 days total)
    - Add clear comments explaining inclusive range logic
    - Add console.log showing calculated date range
    - Document that range is inclusive: [start, end] covering exactly N days
    - _Bug_Condition: isBugCondition_5(timeframe, actualDays) where actualDays = timeframe - 1_
    - _Expected_Behavior: Date ranges include exactly the specified number of days_
    - _Preservation: Core MPI formula unchanged, API integration unchanged_
    - _Requirements: 2.14, 2.15, 2.16_

  - [ ] 3.5.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Correct Date Range Length
    - **IMPORTANT**: Re-run the SAME test from task 1.5 - do NOT write a new test
    - The test from task 1.5 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1.5
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - 7 days returns 7 days)
    - _Requirements: 2.14, 2.15, 2.16_

  - [ ] 3.5.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Core MPI Formula Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2.1 - do NOT write new tests
    - Run preservation property tests from step 2.1
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

### Bug #6: Missing Validation (MEDIUM)

- [ ] 3.6 Add comprehensive validation

  - [ ] 3.6.1 Add division-by-zero check in `calculateListingMPI()`
    - Check if `marketOccupancy === 0` before calculating MPI
    - Return 0 with console.warn message if market occupancy is zero
    - Log listing ID and timeframe for debugging
    - _Bug_Condition: isBugCondition_6(marketOccupancy, dates, values) where validation is missing_
    - _Expected_Behavior: Graceful handling of invalid inputs with appropriate warnings_
    - _Preservation: Core MPI formula unchanged for valid inputs_
    - _Requirements: 2.17, 2.18, 2.19, 2.20_

  - [ ] 3.6.2 Add date validation in `calculateMarketOccupancyFromCategory()`
    - Validate date strings before parsing
    - Use UTC timezone for consistent date handling: `new Date(dateStr + 'T00:00:00Z')`
    - Check if parsed date is valid using `isNaN(date.getTime())`
    - Log warning and skip invalid dates
    - Check if any relevant dates found in range
    - Log warning and return 0 if no dates match
    - _Requirements: 2.17, 2.18, 2.19, 2.20_

  - [ ] 3.6.3 Add occupancy range validation
    - Validate occupancy values are in [0, 100] range (or [0, 1] depending on format)
    - Log warning for out-of-range values
    - Clamp values to valid range: `Math.max(0, Math.min(100, occupancyValue))`
    - Add final sanity check on calculated average occupancy
    - _Requirements: 2.17, 2.18, 2.19, 2.20_

  - [ ] 3.6.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Robust Validation
    - **IMPORTANT**: Re-run the SAME test from task 1.6 - do NOT write a new test
    - The test from task 1.6 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1.6
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - no crashes, graceful handling)
    - _Requirements: 2.17, 2.18, 2.19, 2.20_

  - [ ] 3.6.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Core MPI Formula Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2.1 - do NOT write new tests
    - Run preservation property tests from step 2.1
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

### Bug #7: Misleading Statistics (LOW)

- [ ] 3.7 Fix statistics counting logic

  - [ ] 3.7.1 Update statistics tracking in `calculateMPISummaries()`
    - Move counter increments outside the timeframes loop
    - Count each listing once based on primary calculation method
    - Determine method by checking if any timeframe used API vs neighborhood
    - Track: `hasAnyAPIValue`, `hasAnyNeighborhoodValue`, `hasAnyData`
    - Increment counters once per listing, not per timeframe
    - _Bug_Condition: isBugCondition_7(stats, listings, timeframes) where stats count timeframes not listings_
    - _Expected_Behavior: Statistics count listings, not timeframes_
    - _Preservation: Core MPI formula unchanged, API integration unchanged_
    - _Requirements: 2.21, 2.22, 2.23_

  - [ ] 3.7.2 Update console.log output
    - Log statistics showing listing counts, not timeframe counts
    - Make it clear what each statistic represents
    - Verify sum of all method counts equals total listings
    - _Requirements: 2.21, 2.22, 2.23_

  - [ ] 3.7.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Accurate Statistics
    - **IMPORTANT**: Re-run the SAME test from task 1.7 - do NOT write a new test
    - The test from task 1.7 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1.7
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - 49 listings shows 49, not 245)
    - _Requirements: 2.21, 2.22, 2.23_

  - [ ] 3.7.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Core MPI Formula Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2.1 - do NOT write new tests
    - Run preservation property tests from step 2.1
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

## Phase 4: Integration and Validation

- [ ] 4.1 Run full test suite
  - Run all unit tests (expect 100% pass rate)
  - Run all property-based tests (expect no counterexamples)
  - Run all integration tests (expect all scenarios pass)
  - Verify all 7 bug condition tests now pass
  - Verify all preservation tests still pass

- [ ] 4.2 End-to-end validation
  - Test full MPI calculation flow with real data
  - Verify all 7 bugs are fixed in complete flow
  - Test comparison mode with API vs calculated values
  - Test fallback scenarios (API failure, missing data)
  - Test multi-neighborhood scenario
  - Test edge cases (0% occupancy, 100% occupancy, missing data)

- [ ] 4.3 Performance validation
  - Process 100+ listings and measure API call count
  - Verify Bug #4 fix reduces API calls significantly
  - Measure calculation time and verify no performance regression
  - Verify statistics are accurate (Bug #7 fix)

- [ ] 4.4 Documentation updates
  - Update README with bug fix details
  - Update TECHNICAL_DOCS.md with new implementation details
  - Verify all inline code comments are clear and accurate
  - Document any breaking changes (none expected)

## Phase 5: Version Control and Deployment

- [ ] 5.1 Create meaningful commits
  - Commit Bug #1 fix: "fix: property occupancy now acknowledges timeframe with documentation"
  - Commit Bug #2 fix: "fix: neighborhood fallback now executes when API values missing"
  - Commit Bug #3 fix: "fix: consistent MPI scaling with clear documentation"
  - Commit Bug #4 fix: "perf: optimize neighborhood data loading to reduce API calls"
  - Commit Bug #5 fix: "fix: correct date range calculation to include all requested days"
  - Commit Bug #6 fix: "fix: add comprehensive validation for division by zero and invalid data"
  - Commit Bug #7 fix: "fix: statistics now count listings instead of timeframes"
  - Commit tests: "test: add exploration and preservation tests for all 7 bugs"

- [ ] 5.2 Final checkpoint
  - Ensure all tests pass
  - Verify all 7 bugs are fixed
  - Verify no regressions in existing functionality
  - Review code changes for quality and clarity
  - Ask user if any questions arise before deployment

- [ ] 5.3 Deployment preparation
  - Create deployment checklist
  - Plan staging deployment
  - Plan production deployment with monitoring
  - Prepare rollback plan if issues arise
