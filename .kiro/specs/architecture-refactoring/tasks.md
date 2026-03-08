# Implementation Plan: Simplified Architecture Refactoring (Portfolio-Focused)

## Overview

This is a **simplified, portfolio-focused refactoring** that addresses the interviewer's feedback in 1-2 days instead of 2 weeks. The goal is to demonstrate OOP understanding and architectural thinking without over-engineering.

**What we're doing:**
- Convert functional code to 3 simple classes
- Add SQLite database for API resilience
- Keep all 8 existing tests passing
- Create a great interview story

**What we're NOT doing:**
- PostgreSQL (SQLite is enough)
- Property-based testing (overkill)
- Dependency injection containers (over-engineering)
- Multiple interfaces (YAGNI)
- 17 correctness properties (academic)

**Timeline:** 1-2 days (vs 11-16 days in original plan)

## Tasks

- [x] 1. Set up SQLite database (30 minutes)
  - [x] 1.1 Install better-sqlite3 package
    - Run: `npm install better-sqlite3`
    - Run: `npm install --save-dev @types/better-sqlite3`

  - [x] 1.2 Create database schema file
    - Create `lib/database/schema.sql`
    - Define listings table (id, data_json, created_at, updated_at)
    - Define neighborhood_data table (listing_id, data_json, created_at, updated_at)
    - Keep it simple - store JSON blobs, not normalized tables

  - [x] 1.3 Create database initialization script
    - Create `lib/database/init.ts`
    - Function to create tables if they don't exist
    - Use in-memory database for tests, file-based for production

- [x] 2. Create DataRepository class (1-2 hours)
  - [x] 2.1 Create lib/classes/DataRepository.ts
    - Handles all data loading with fallback strategy
    - Methods: `loadListings()`, `loadNeighborhood(listingId)`
    - Private methods: `tryAPI()`, `tryDatabase()`, `tryJSONFile()`
    - Implements fallback: API → Database → JSON files
    - Caches API responses to database automatically

  - [x] 2.2 Extract API logic from data-loader.ts
    - Move PriceLabs API calls into DataRepository
    - Keep error handling simple
    - Log which data source was used

  - [x] 2.3 Extract database logic
    - Add methods: `saveToCache()`, `getFromCache()`, `isCacheFresh()`
    - Simple 24-hour cache expiry
    - Store entire objects as JSON (no complex schema)

  - [x] 2.4 Extract file loading logic
    - Move JSON file reading into DataRepository
    - Keep as final fallback

- [x] 3. Create MPICalculator class (1-2 hours)
  - [x] 3.1 Create lib/classes/MPICalculator.ts
    - Handles all MPI calculation logic
    - Methods: `calculateMPI()`, `calculateAllMPIs()`, `calculateGroupAverages()`
    - Extract from mpi-calculator.ts functional code
    - Keep calculation logic pure (no side effects)

  - [x] 3.2 Move calculation functions into class
    - Move `getDateRangeForTimeframe()` as class method
    - Move `getGroupKey()` as class method
    - Move `calculateListingMPI()` logic into class
    - Move `calculateGroupAverages()` logic into class

  - [x] 3.3 Add simple dependency injection
    - Constructor takes DataRepository as parameter
    - No fancy DI container, just pass dependencies

- [x] 4. Create OccupancyCalculator class (1 hour)
  - [x] 4.1 Create lib/classes/OccupancyCalculator.ts
    - Handles occupancy calculations
    - Methods: `calculatePropertyOccupancy()`, `calculateMarketOccupancy()`
    - Extract from data-loader.ts functional code

  - [x] 4.2 Move occupancy functions into class
    - Move `calculatePropertyOccupancy()` as class method
    - Move `calculateMarketOccupancy()` as class method
    - Move `matchListingToNeighborhood()` as class method
    - Move `extractPercentage()` as class method

- [x] 5. Update public API to use new classes (1 hour)
  - [x] 5.1 Update lib/mpi-calculator.ts
    - Keep same function signatures (backward compatibility)
    - Internally use new classes
    - Example: `calculateMPISummaries()` creates instances and delegates

  - [x] 5.2 Update lib/data-loader.ts
    - Keep same function signatures
    - Internally use DataRepository class
    - Example: `loadListingsData()` delegates to DataRepository

  - [x] 5.3 Ensure all 8 existing tests still pass
    - Run: `npm test`
    - Fix any issues
    - Tests should pass without modification

- [ ] 6. Add simple documentation (30 minutes)
  - [ ] 6.1 Add JSDoc comments to classes
    - Document purpose of each class
    - Document key methods
    - Keep it concise

  - [ ] 6.2 Create architecture diagram
    - Simple diagram showing 3 classes and their relationships
    - Show fallback strategy (API → DB → JSON)
    - Can use ASCII art or draw.io

  - [ ] 6.3 Update BUGFIX_CASE_STUDY.md
    - Add "Architecture Refactoring" section
    - Explain the 3 classes and their responsibilities
    - Explain database caching strategy
    - Mention this addresses interviewer feedback

- [ ] 7. Final validation (30 minutes)
  - [ ] 7.1 Run all tests
    - Verify all 8 tests pass: `npm test`
    - No test modifications needed

  - [ ] 7.2 Test database caching manually
    - Run app with API key
    - Verify data cached to SQLite
    - Remove API key, verify fallback to database works
    - Verify final fallback to JSON files works

  - [ ] 7.3 Commit with good message
    - Commit: "refactor: convert to OOP architecture with 3 classes and SQLite caching"
    - Push to GitHub

## File Structure After Refactoring

```
lib/
├── mpi-calculator.ts          # Public API (uses classes internally)
├── data-loader.ts             # Public API (uses classes internally)
├── logger.ts                  # Unchanged
├── classes/
│   ├── DataRepository.ts      # Data loading with fallback (API → DB → JSON)
│   ├── MPICalculator.ts       # MPI calculation logic
│   └── OccupancyCalculator.ts # Occupancy calculation logic
└── database/
    ├── schema.sql             # Database schema
    └── init.ts                # Database initialization
```

## Interview Story

"After receiving feedback from the interviewer about improving the architecture, I refactored the codebase from functional programming to object-oriented design. I created three classes with clear responsibilities:

1. **DataRepository** - Handles all data loading with a three-tier fallback strategy (API → Database → JSON files). This addresses the interviewer's feedback about adding a database for API downtime resilience.

2. **MPICalculator** - Contains all MPI calculation logic, making it easy to test and modify independently.

3. **OccupancyCalculator** - Handles occupancy calculations, demonstrating separation of concerns.

I added SQLite for caching API responses, which improves resilience and reduces API calls. The refactoring maintained 100% backward compatibility - all 8 existing tests pass without modification. This demonstrates my ability to refactor legacy code while maintaining functionality."

## Success Criteria

✅ All 8 existing tests pass without modification  
✅ 3 classes with clear single responsibilities  
✅ SQLite database caching working  
✅ Fallback strategy working (API → DB → JSON)  
✅ Good documentation and architecture diagram  
✅ Commit history shows the refactoring  
✅ Great story for interviews  

## Notes

- This is a **pragmatic refactoring** focused on portfolio value, not academic perfection
- Estimated time: **4-6 hours of actual coding** (can be done in 1-2 days)
- Much simpler than the original 46-task, 11-16 day plan
- Still demonstrates OOP understanding and architectural thinking
- Addresses all interviewer feedback (classes, cohesion/coupling, database)
- Low risk - tests keep passing throughout
