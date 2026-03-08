# Requirements Document

## Introduction

This document specifies requirements for refactoring the MPI (Market Penetration Index) Calculator from a functional programming approach to an object-oriented architecture. The refactoring addresses interviewer feedback to demonstrate professional software design skills while maintaining all existing functionality and test coverage.

The current implementation uses 952 lines of functional code across three files (mpi-calculator.ts, data-loader.ts, logger.ts) with no clear separation of concerns. The refactored system will introduce class-based architecture, improve cohesion and coupling, add database persistence for API resilience, and maintain backward compatibility with 8 existing tests.

## Glossary

- **MPI_Calculator**: The system responsible for calculating Market Penetration Index values
- **Data_Loader**: Component responsible for loading listing and neighborhood data from APIs or fallback sources
- **Database_Layer**: Persistence layer for storing data to handle API downtime
- **API_Client**: Component that communicates with PriceLabs API
- **Listing**: A property/rental unit with occupancy and pricing data
- **Neighborhood_Data**: Market-level occupancy data for a geographic area
- **Timeframe**: A period of days (7, 30, 60, 90, or 120) for MPI calculation
- **Occupancy_Calculator**: Component that calculates property and market occupancy rates
- **MPI_Value**: Market Penetration Index score in 0-200 range (100 = at market average)
- **Fallback_Strategy**: Mechanism to use local JSON files when API is unavailable
- **Test_Suite**: The 8 existing Vitest tests that verify bug fixes and functionality

## Requirements

### Requirement 1: Class-Based Architecture

**User Story:** As a developer, I want the codebase organized into classes with single responsibilities, so that the code is easier to understand, maintain, and extend.

#### Acceptance Criteria

1. THE MPI_Calculator SHALL implement a class-based architecture using TypeScript classes
2. WHEN organizing code into classes, THE MPI_Calculator SHALL ensure each class has a single, well-defined responsibility
3. THE MPI_Calculator SHALL replace the 11 functions in mpi-calculator.ts with appropriate class methods
4. THE Data_Loader SHALL replace the 7 functions in data-loader.ts with appropriate class methods
5. THE MPI_Calculator SHALL organize classes into logical modules (calculation, data access, persistence)

### Requirement 2: Separation of Concerns

**User Story:** As a developer, I want clear separation between data loading, calculation logic, and persistence, so that I can modify one concern without affecting others.

#### Acceptance Criteria

1. THE API_Client SHALL handle all external API communication with PriceLabs
2. THE Database_Layer SHALL handle all data persistence operations independently from API communication
3. THE Occupancy_Calculator SHALL handle occupancy calculations independently from data loading
4. THE MPI_Calculator SHALL handle MPI calculations independently from data sources
5. WHEN a component needs data, THE MPI_Calculator SHALL use dependency injection rather than direct imports

### Requirement 3: Database Integration

**User Story:** As a system operator, I want listing and neighborhood data persisted in a database, so that the application remains functional during API downtime.

#### Acceptance Criteria

1. THE Database_Layer SHALL store listing data retrieved from the PriceLabs API
2. THE Database_Layer SHALL store neighborhood data retrieved from the PriceLabs API
3. WHEN the PriceLabs API is unavailable, THE Database_Layer SHALL provide cached data as fallback
4. THE Database_Layer SHALL track data freshness with timestamps
5. THE Database_Layer SHALL support both SQLite (development) and PostgreSQL (production) databases
6. WHEN data is older than 24 hours, THE Database_Layer SHALL attempt to refresh from the API

### Requirement 4: Improved Cohesion

**User Story:** As a developer, I want related functionality grouped together in classes, so that I can find and modify related code easily.

#### Acceptance Criteria

1. THE Occupancy_Calculator SHALL contain all occupancy-related calculations (property occupancy, market occupancy, date range logic)
2. THE API_Client SHALL contain all API communication logic (request formatting, response parsing, error handling)
3. THE Database_Layer SHALL contain all persistence operations (save, retrieve, update, delete)
4. THE MPI_Calculator SHALL contain all MPI calculation logic (scaling, averaging, grouping)
5. WHEN a class contains methods, THE MPI_Calculator SHALL ensure those methods operate on related data

### Requirement 5: Reduced Coupling

**User Story:** As a developer, I want minimal dependencies between classes, so that changes to one class don't cascade to many others.

#### Acceptance Criteria

1. THE MPI_Calculator SHALL use interfaces to define contracts between components
2. WHEN a class depends on another class, THE MPI_Calculator SHALL depend on interfaces rather than concrete implementations
3. THE MPI_Calculator SHALL use dependency injection to provide dependencies to classes
4. THE MPI_Calculator SHALL limit each class to depending on at most 3 other classes
5. WHEN data flows between components, THE MPI_Calculator SHALL use data transfer objects (DTOs) rather than exposing internal structures

### Requirement 6: Backward Compatibility

**User Story:** As a developer, I want all existing tests to pass after refactoring, so that I can verify no functionality was broken.

#### Acceptance Criteria

1. WHEN the Test_Suite runs, THE MPI_Calculator SHALL pass all 8 existing tests without modification
2. THE MPI_Calculator SHALL maintain the same public API for calculateMPISummaries function
3. THE MPI_Calculator SHALL maintain the same public API for calculateMPIComparisons function
4. THE MPI_Calculator SHALL maintain the same public API for loadListingsData function
5. THE MPI_Calculator SHALL maintain the same public API for loadNeighborhoodData function
6. THE MPI_Calculator SHALL produce identical calculation results to the current implementation

### Requirement 7: Fallback Strategy Preservation

**User Story:** As a system operator, I want the existing JSON fallback mechanism preserved, so that the application works even without database or API access.

#### Acceptance Criteria

1. WHEN both API and database are unavailable, THE Fallback_Strategy SHALL load data from JSON files in the public directory
2. THE Fallback_Strategy SHALL maintain the current priority: API first, then database, then JSON files
3. THE Fallback_Strategy SHALL log which data source was used for each request
4. WHEN using fallback data, THE MPI_Calculator SHALL continue to produce valid MPI calculations
5. THE Fallback_Strategy SHALL support the same data formats as the current JSON files

### Requirement 8: Configuration Management

**User Story:** As a developer, I want database and API configuration externalized, so that I can change settings without modifying code.

#### Acceptance Criteria

1. THE MPI_Calculator SHALL read database connection settings from environment variables
2. THE MPI_Calculator SHALL read API keys from environment variables
3. THE MPI_Calculator SHALL provide sensible defaults for development (SQLite in-memory database)
4. WHEN environment variables are missing, THE MPI_Calculator SHALL log warnings and use fallback configuration
5. THE MPI_Calculator SHALL support configuration for data refresh intervals

### Requirement 9: Error Handling and Logging

**User Story:** As a developer, I want consistent error handling and logging across all classes, so that I can diagnose issues quickly.

#### Acceptance Criteria

1. THE MPI_Calculator SHALL use the existing Logger class for all logging operations
2. WHEN an API call fails, THE API_Client SHALL log the error with context (URL, method, error message)
3. WHEN a database operation fails, THE Database_Layer SHALL log the error and attempt fallback strategies
4. THE MPI_Calculator SHALL log which data source was used for each calculation (API, database, or JSON)
5. WHEN errors occur, THE MPI_Calculator SHALL provide actionable error messages that indicate the failure point

### Requirement 10: Performance Optimization

**User Story:** As a system operator, I want the refactored system to maintain or improve performance, so that calculations remain fast.

#### Acceptance Criteria

1. THE MPI_Calculator SHALL continue to load neighborhood data once and share across all listings
2. THE Database_Layer SHALL use connection pooling for database operations
3. THE MPI_Calculator SHALL calculate MPI values in parallel using Promise.all
4. WHEN calculating group averages, THE MPI_Calculator SHALL process listings in a single pass
5. THE MPI_Calculator SHALL complete calculations for 100 listings in under 5 seconds

### Requirement 11: Type Safety

**User Story:** As a developer, I want strong TypeScript typing throughout the refactored code, so that I catch errors at compile time.

#### Acceptance Criteria

1. THE MPI_Calculator SHALL define interfaces for all data structures (Listing, NeighborhoodData, MPISummary)
2. THE MPI_Calculator SHALL define interfaces for all service contracts (IDataLoader, IDatabase, ICalculator)
3. THE MPI_Calculator SHALL avoid using 'any' type except where absolutely necessary
4. WHEN defining class methods, THE MPI_Calculator SHALL specify parameter types and return types
5. THE MPI_Calculator SHALL use TypeScript strict mode

### Requirement 12: Database Schema Design

**User Story:** As a database administrator, I want a well-designed schema for storing listing and neighborhood data, so that queries are efficient and data integrity is maintained.

#### Acceptance Criteria

1. THE Database_Layer SHALL create a 'listings' table with columns for all Listing properties
2. THE Database_Layer SHALL create a 'neighborhood_data' table with columns for neighborhood information
3. THE Database_Layer SHALL create indexes on frequently queried columns (listing_id, city_name, no_of_bedrooms)
4. THE Database_Layer SHALL store timestamps for data freshness tracking (created_at, updated_at)
5. THE Database_Layer SHALL use appropriate data types (numeric for MPI values, text for names, timestamp for dates)
6. WHEN storing neighborhood data, THE Database_Layer SHALL serialize complex JSON structures appropriately

### Requirement 13: Migration Path

**User Story:** As a developer, I want a clear migration path from the old code to the new architecture, so that I can refactor incrementally if needed.

#### Acceptance Criteria

1. THE MPI_Calculator SHALL provide adapter functions that wrap new classes with old function signatures
2. THE MPI_Calculator SHALL allow both old and new implementations to coexist during migration
3. THE MPI_Calculator SHALL document which functions map to which classes and methods
4. WHEN migrating, THE MPI_Calculator SHALL provide a feature flag to switch between old and new implementations
5. THE MPI_Calculator SHALL include migration documentation in the codebase

### Requirement 14: Code Documentation

**User Story:** As a developer, I want comprehensive documentation for the new architecture, so that I can understand the design decisions and class relationships.

#### Acceptance Criteria

1. THE MPI_Calculator SHALL include JSDoc comments for all public classes and methods
2. THE MPI_Calculator SHALL document the purpose and responsibility of each class
3. THE MPI_Calculator SHALL include class diagrams showing relationships between components
4. THE MPI_Calculator SHALL document the data flow from API through database to calculations
5. THE MPI_Calculator SHALL include examples of how to use the new classes

### Requirement 15: Testing Strategy

**User Story:** As a developer, I want a testing strategy for the new architecture, so that I can verify each component works correctly in isolation.

#### Acceptance Criteria

1. THE MPI_Calculator SHALL support unit testing of individual classes with mocked dependencies
2. THE MPI_Calculator SHALL maintain the existing integration tests that verify end-to-end functionality
3. THE Database_Layer SHALL support in-memory database for testing without external dependencies
4. WHEN testing calculations, THE MPI_Calculator SHALL allow injection of mock data sources
5. THE MPI_Calculator SHALL achieve at least 80% code coverage with the Test_Suite
