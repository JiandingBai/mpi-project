# Technical Design Document: MPI Calculator Architecture Refactoring

## Overview

This design document specifies the technical architecture for refactoring the MPI (Market Penetration Index) Calculator from a functional programming approach to a professional object-oriented design. The refactoring transforms 952 lines of functional code across three files into a well-structured class-based architecture that demonstrates SOLID principles, separation of concerns, and enterprise-grade design patterns.

The current implementation consists of 11 functions in `mpi-calculator.ts`, 7 functions in `data-loader.ts`, and a simple logger utility. While functional, this approach lacks clear boundaries between concerns, making the code difficult to test in isolation, extend with new features, and maintain over time.

The refactored architecture introduces:

- **Class-based design** with single responsibility principle
- **Interface-driven contracts** for loose coupling
- **Database persistence layer** for API resilience
- **Dependency injection** for testability
- **Layered architecture** separating data access, business logic, and presentation

The design maintains 100% backward compatibility with existing tests and public APIs while providing a foundation for future enhancements.

## Architecture

### High-Level Architecture

The refactored system follows a layered architecture pattern with clear separation between concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  (Public API Functions - Backward Compatible Adapters)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                    │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  MPICalculator   │  │OccupancyCalculator│                │
│  │  - Calculate MPI │  │ - Property Occ.  │                │
│  │  - Group Averages│  │ - Market Occ.    │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Access Layer                       │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │   DataService    │  │  DatabaseLayer   │                │
│  │  - Load Data     │  │  - Persist Data  │                │
│  │  - Fallback      │  │  - Query Cache   │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Infrastructure Layer                     │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │   APIClient      │  │  FileDataSource  │                │
│  │  - HTTP Requests │  │  - JSON Files    │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles Applied

1. **Single Responsibility Principle (SRP)**: Each class has one reason to change
   - `MPICalculator`: MPI calculation logic only
   - `OccupancyCalculator`: Occupancy calculations only
   - `DataService`: Data orchestration only
   - `DatabaseLayer`: Persistence only
   - `APIClient`: HTTP communication only

2. **Open/Closed Principle (OCP)**: Open for extension, closed for modification
   - Interface-based design allows new implementations without changing existing code
   - Strategy pattern for data sources (API, Database, File)

3. **Liskov Substitution Principle (LSP)**: Interfaces are substitutable
   - Any `IDataSource` implementation can replace another
   - Any `IDatabase` implementation can replace another

4. **Interface Segregation Principle (ISP)**: Focused interfaces
   - `IDataSource`: Only data loading methods
   - `IDatabase`: Only persistence methods
   - `ICalculator`: Only calculation methods

5. **Dependency Inversion Principle (DIP)**: Depend on abstractions
   - High-level modules depend on interfaces, not concrete classes
   - Dependency injection provides concrete implementations

### Data Flow

The system follows a clear data flow from external sources through processing to results:

```
API/Database/File → DataService → OccupancyCalculator → MPICalculator → Results
                         ↓
                   DatabaseLayer (cache)
```

1. **Data Acquisition**: `DataService` attempts to load data from API, falls back to database, then JSON files
2. **Data Caching**: Successful API calls are persisted to database for future fallback
3. **Occupancy Calculation**: `OccupancyCalculator` processes raw data into occupancy rates
4. **MPI Calculation**: `MPICalculator` computes MPI values from occupancy data
5. **Aggregation**: Results are grouped and averaged according to user-specified grouping

## Components and Interfaces

### Core Interfaces

#### IDataSource

Defines the contract for loading listing and neighborhood data from any source.

```typescript
interface IDataSource {
  loadListings(): Promise<ListingsData>;
  loadNeighborhood(listingId: string): Promise<NeighborhoodData>;
}
```

**Implementations**:
- `APIClient`: Loads from PriceLabs API
- `FileDataSource`: Loads from JSON files
- `DatabaseDataSource`: Loads from database cache

#### IDatabase

Defines the contract for data persistence operations.

```typescript
interface IDatabase {
  saveListings(listings: Listing[]): Promise<void>;
  getListings(): Promise<Listing[] | null>;
  saveNeighborhood(listingId: string, data: NeighborhoodData): Promise<void>;
  getNeighborhood(listingId: string): Promise<NeighborhoodData | null>;
  isDataFresh(timestamp: Date, maxAgeHours: number): boolean;
  getLastUpdated(key: string): Promise<Date | null>;
}
```

**Implementations**:
- `SQLiteDatabase`: Development/testing with in-memory or file-based SQLite
- `PostgreSQLDatabase`: Production with PostgreSQL

#### ICalculator

Defines the contract for MPI calculation operations.

```typescript
interface ICalculator {
  calculateMPI(
    listing: Listing,
    neighborhoodData: NeighborhoodData,
    timeframe: Timeframe
  ): number;
  
  calculateGroupAverages(
    calculatedMPIs: CalculatedMPI[],
    grouping: string,
    listingsData: ListingsData
  ): MPISummary[];
}
```

**Implementation**:
- `MPICalculator`: Core MPI calculation logic

### Core Classes

#### DataService

**Responsibility**: Orchestrate data loading with fallback strategy (API → Database → File)

**Dependencies**:
- `IDataSource` (primary): API client
- `IDataSource` (fallback): File data source
- `IDatabase`: Database layer for caching
- `Logger`: Logging utility

**Key Methods**:
```typescript
class DataService {
  constructor(
    private apiClient: IDataSource,
    private fileSource: IDataSource,
    private database: IDatabase,
    private logger: Logger
  ) {}

  async loadListings(): Promise<ListingsData>
  async loadNeighborhood(listingId: string): Promise<NeighborhoodData>
  private async tryLoadFromAPI(): Promise<ListingsData | null>
  private async tryLoadFromDatabase(): Promise<ListingsData | null>
  private async tryLoadFromFile(): Promise<ListingsData>
}
```

**Design Rationale**: Centralizes the fallback strategy logic, making it easy to modify the priority order or add new data sources. Uses dependency injection to remain testable with mock data sources.

#### APIClient

**Responsibility**: Handle all HTTP communication with PriceLabs API

**Dependencies**:
- `Logger`: Logging utility
- `Config`: API configuration (base URL, API key)

**Key Methods**:
```typescript
class APIClient implements IDataSource {
  constructor(
    private config: APIConfig,
    private logger: Logger
  ) {}

  async loadListings(): Promise<ListingsData>
  async loadNeighborhood(listingId: string): Promise<NeighborhoodData>
  private async makeRequest<T>(url: string, method: string): Promise<T>
  private handleAPIError(error: any, context: string): never
}
```

**Design Rationale**: Isolates all API-specific logic (authentication, error handling, retries) in one place. Implements `IDataSource` to be interchangeable with other data sources.

#### DatabaseLayer

**Responsibility**: Persist and retrieve data from database with freshness tracking

**Dependencies**:
- Database connection (SQLite or PostgreSQL)
- `Logger`: Logging utility

**Key Methods**:
```typescript
class DatabaseLayer implements IDatabase {
  constructor(
    private connection: DatabaseConnection,
    private logger: Logger
  ) {}

  async saveListings(listings: Listing[]): Promise<void>
  async getListings(): Promise<Listing[] | null>
  async saveNeighborhood(listingId: string, data: NeighborhoodData): Promise<void>
  async getNeighborhood(listingId: string): Promise<NeighborhoodData | null>
  isDataFresh(timestamp: Date, maxAgeHours: number): boolean
  async getLastUpdated(key: string): Promise<Date | null>
  async initialize(): Promise<void>
  private async createTables(): Promise<void>
}
```

**Design Rationale**: Abstracts database operations behind an interface, allowing easy switching between SQLite (dev) and PostgreSQL (prod). Tracks data freshness to support intelligent cache invalidation.

#### OccupancyCalculator

**Responsibility**: Calculate property and market occupancy rates from raw data

**Dependencies**:
- `Logger`: Logging utility

**Key Methods**:
```typescript
class OccupancyCalculator {
  constructor(private logger: Logger) {}

  calculatePropertyOccupancy(
    listing: Listing,
    dateRange: { start: Date; end: Date }
  ): number

  calculateMarketOccupancy(
    neighborhoodData: NeighborhoodData,
    listing: Listing,
    dateRange: { start: Date; end: Date }
  ): number

  getDateRangeForTimeframe(timeframe: Timeframe): { start: Date; end: Date }
  
  private matchListingToCategory(
    listing: Listing,
    neighborhoodData: NeighborhoodData
  ): string | null
  
  private extractPercentage(value: string): number
}
```

**Design Rationale**: Separates occupancy calculation logic from MPI calculation, making each easier to test and modify independently. Contains all date range and category matching logic.

#### MPICalculator

**Responsibility**: Calculate MPI values and group averages

**Dependencies**:
- `OccupancyCalculator`: For occupancy data
- `Logger`: Logging utility

**Key Methods**:
```typescript
class MPICalculator implements ICalculator {
  constructor(
    private occupancyCalculator: OccupancyCalculator,
    private logger: Logger
  ) {}

  calculateMPI(
    listing: Listing,
    neighborhoodData: NeighborhoodData,
    timeframe: Timeframe
  ): number

  async calculateAllMPIs(
    listing: Listing,
    neighborhoodData: NeighborhoodData
  ): Promise<CalculatedMPI>

  calculateGroupAverages(
    calculatedMPIs: CalculatedMPI[],
    grouping: string,
    listingsData: ListingsData
  ): MPISummary[]

  private scaleMPI(propertyOcc: number, marketOcc: number): number
  private getGroupKey(listing: Listing, grouping: string): string
}
```

**Design Rationale**: Focuses solely on MPI calculation logic. Delegates occupancy calculations to `OccupancyCalculator`. Uses dependency injection for testability.

#### FileDataSource

**Responsibility**: Load data from JSON files as fallback

**Dependencies**:
- `Logger`: Logging utility

**Key Methods**:
```typescript
class FileDataSource implements IDataSource {
  constructor(
    private basePath: string,
    private logger: Logger
  ) {}

  async loadListings(): Promise<ListingsData>
  async loadNeighborhood(listingId: string): Promise<NeighborhoodData>
  private async readJSONFile<T>(filename: string): Promise<T>
}
```

**Design Rationale**: Implements `IDataSource` to be interchangeable with API client. Provides reliable fallback when external services are unavailable.

### Adapter Layer (Backward Compatibility)

To maintain backward compatibility with existing tests and code, adapter functions wrap the new class-based architecture:

```typescript
// Public API adapters
export async function calculateMPISummaries(
  grouping: string = 'city_name'
): Promise<MPISummary[]> {
  const container = createDependencyContainer();
  const dataService = container.get<DataService>('DataService');
  const mpiCalculator = container.get<MPICalculator>('MPICalculator');
  
  const listingsData = await dataService.loadListings();
  const calculatedMPIs: CalculatedMPI[] = [];
  
  for (const listing of listingsData.listings) {
    const neighborhoodData = await dataService.loadNeighborhood(listing.id);
    const mpi = await mpiCalculator.calculateAllMPIs(listing, neighborhoodData);
    calculatedMPIs.push(mpi);
  }
  
  return mpiCalculator.calculateGroupAverages(calculatedMPIs, grouping, listingsData);
}

export async function loadListingsData(): Promise<ListingsData> {
  const container = createDependencyContainer();
  const dataService = container.get<DataService>('DataService');
  return dataService.loadListings();
}

export async function loadNeighborhoodData(listingId: string): Promise<NeighborhoodData> {
  const container = createDependencyContainer();
  const dataService = container.get<DataService>('DataService');
  return dataService.loadNeighborhood(listingId);
}
```

**Design Rationale**: Existing code continues to work without modification. Tests pass unchanged. New code can use the class-based API directly for better testability and flexibility.

## Data Models

### Database Schema

The database schema supports both SQLite (development) and PostgreSQL (production) with appropriate type mappings.

#### listings Table

Stores cached listing data from the PriceLabs API.

```sql
CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  pms TEXT NOT NULL,
  name TEXT NOT NULL,
  latitude TEXT NOT NULL,
  longitude TEXT NOT NULL,
  country TEXT NOT NULL,
  city_name TEXT NOT NULL,
  state TEXT NOT NULL,
  no_of_bedrooms INTEGER NOT NULL,
  min REAL,
  base REAL,
  max REAL,
  group_name TEXT,
  subgroup TEXT,
  tags TEXT,
  notes TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT 0,
  push_enabled BOOLEAN NOT NULL DEFAULT 0,
  last_date_pushed TEXT,
  revenue_ytd TEXT NOT NULL,
  stly_revenue_ytd TEXT NOT NULL,
  revenue_past_60 TEXT NOT NULL,
  stly_revenue_past_60 TEXT NOT NULL,
  last_booked_date TEXT NOT NULL,
  booking_pickup_unique_past_7 TEXT NOT NULL,
  booking_pickup_unique_past_30 TEXT NOT NULL,
  mpi_next_90 REAL NOT NULL,
  revenue_past_30 TEXT NOT NULL,
  stly_revenue_past_30 TEXT NOT NULL,
  adjusted_occupancy_past_30 TEXT NOT NULL,
  market_adjusted_occupancy_past_30 TEXT NOT NULL,
  adjusted_occupancy_past_90 TEXT NOT NULL,
  market_adjusted_occupancy_past_90 TEXT NOT NULL,
  revenue_past_90 TEXT NOT NULL,
  stly_revenue_past_90 TEXT NOT NULL,
  mpi_next_7 REAL NOT NULL,
  mpi_next_30 REAL NOT NULL,
  mpi_next_60 REAL NOT NULL,
  mpi_next_120 REAL NOT NULL,
  min_prices_next_30 TEXT NOT NULL,
  min_prices_next_60 TEXT NOT NULL,
  revpar_next_60 TEXT NOT NULL,
  stly_revpar_next_60 TEXT NOT NULL,
  revpar_next_30 TEXT NOT NULL,
  stly_revpar_next_30 TEXT NOT NULL,
  recommended_base_price TEXT NOT NULL,
  last_refreshed_at TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_listings_city ON listings(city_name);
CREATE INDEX idx_listings_bedrooms ON listings(no_of_bedrooms);
CREATE INDEX idx_listings_group ON listings(group_name);
CREATE INDEX idx_listings_updated ON listings(updated_at);
```

**Design Notes**:
- `id` is the primary key matching the PriceLabs listing ID
- Indexes on `city_name`, `no_of_bedrooms`, and `group_name` support fast grouping queries
- Index on `updated_at` supports freshness checks
- `created_at` and `updated_at` track data lifecycle
- TEXT type used for fields that may contain numeric or string values (API inconsistency)
- BOOLEAN mapped to INTEGER (0/1) for SQLite compatibility

#### neighborhood_data Table

Stores cached neighborhood data from the PriceLabs API.

```sql
CREATE TABLE neighborhood_data (
  listing_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX idx_neighborhood_updated ON neighborhood_data(updated_at);
```

**Design Notes**:
- `listing_id` is the primary key and foreign key to listings table
- `data_json` stores the entire NeighborhoodData object as JSON (complex nested structure)
- Index on `updated_at` supports freshness checks
- Foreign key ensures referential integrity (neighborhood data deleted when listing deleted)
- JSON storage chosen because neighborhood data structure is complex and query patterns don't require relational decomposition

#### metadata Table

Stores system metadata for cache management.

```sql
CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Design Notes**:
- Generic key-value store for system metadata
- Used to track last successful API fetch, cache invalidation times, etc.
- `key` examples: `listings_last_fetch`, `cache_max_age_hours`

### Data Transfer Objects (DTOs)

DTOs define the shape of data passed between layers, decoupling internal representations from external interfaces.

#### ListingDTO

```typescript
interface ListingDTO {
  id: string;
  name: string;
  cityName: string;
  bedrooms: number;
  group: string | null;
  mpiValues: {
    mpi_7: number;
    mpi_30: number;
    mpi_60: number;
    mpi_90: number;
    mpi_120: number;
  };
}
```

**Usage**: Simplified listing representation for API responses, avoiding exposure of internal database fields.

#### OccupancyDTO

```typescript
interface OccupancyDTO {
  propertyOccupancy: number;
  marketOccupancy: number;
  timeframe: Timeframe;
  dateRange: {
    start: string; // ISO 8601 date
    end: string;   // ISO 8601 date
  };
}
```

**Usage**: Encapsulates occupancy calculation results for passing between calculator components.

### Type Mappings

The system handles type conversions between different layers:

| TypeScript Type | Database Type (SQLite) | Database Type (PostgreSQL) |
|----------------|------------------------|----------------------------|
| string         | TEXT                   | TEXT                       |
| number         | REAL                   | NUMERIC                    |
| boolean        | INTEGER (0/1)          | BOOLEAN                    |
| Date           | TEXT (ISO 8601)        | TIMESTAMP                  |
| object         | TEXT (JSON)            | JSONB                      |

**Design Rationale**: SQLite has limited type support, so we use TEXT for dates and JSON. PostgreSQL supports native types, providing better performance and query capabilities in production.


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

For this refactoring project, correctness properties focus on two key areas:
1. **Behavioral Equivalence**: The refactored system must produce identical results to the original implementation
2. **Resilience and Reliability**: The new architecture must handle failures gracefully with proper fallback mechanisms

### Property 1: Database Persistence Round-Trip

*For any* listing data retrieved from the API, storing it to the database and then retrieving it should produce equivalent data.

**Validates: Requirements 3.1, 12.6**

**Rationale**: This property ensures that the database layer correctly persists and retrieves listing data without loss or corruption. It's a fundamental round-trip property that validates serialization/deserialization.

### Property 2: Neighborhood Data Persistence Round-Trip

*For any* neighborhood data retrieved from the API, storing it to the database and then retrieving it should produce equivalent data (including complex nested JSON structures).

**Validates: Requirements 3.2, 12.6**

**Rationale**: Neighborhood data has complex nested structures (Market KPI, Future Percentile Prices, etc.). This property ensures JSON serialization preserves all data integrity.

### Property 3: Database Fallback on API Failure

*For any* data request when the API is unavailable, if cached data exists in the database, the system should return that cached data successfully.

**Validates: Requirements 3.3**

**Rationale**: This property validates the primary resilience mechanism - using database cache when the API fails.

### Property 4: Data Freshness Tracking

*For any* data stored in the database, there should be an associated timestamp, and the system should be able to determine if the data is fresh (less than configured max age).

**Validates: Requirements 3.4**

**Rationale**: This property ensures the cache invalidation mechanism works correctly, preventing stale data from being used indefinitely.

### Property 5: Stale Data Refresh

*For any* data older than the configured maximum age (default 24 hours), when requested, the system should attempt to refresh from the API before returning cached data.

**Validates: Requirements 3.6**

**Rationale**: This property ensures the system maintains data freshness by proactively refreshing stale cache entries.

### Property 6: Backward Compatibility - Calculation Results

*For any* valid input (listings data and neighborhood data), the refactored implementation should produce identical MPI calculation results to the original functional implementation.

**Validates: Requirements 6.6**

**Rationale**: This is the most critical property for the refactoring. It ensures no regression in calculation logic. This property subsumes individual API compatibility checks (6.2-6.5) since identical results imply API compatibility.

### Property 7: Backward Compatibility - Test Suite

*For any* test in the existing test suite (8 tests), the refactored implementation should pass without modification to the test code.

**Validates: Requirements 6.1, 15.2**

**Rationale**: This property validates that the public API remains unchanged and all existing functionality is preserved.

### Property 8: Fallback Priority Order

*For any* data request, the system should attempt data sources in the correct priority order: API first, then database cache, then JSON files, logging each attempt.

**Validates: Requirements 7.2, 7.3**

**Rationale**: This property ensures the fallback strategy follows the correct priority and provides observability through logging.

### Property 9: JSON Fallback Functionality

*For any* data request when both API and database are unavailable, the system should successfully load data from JSON files and produce valid MPI calculations.

**Validates: Requirements 7.1, 7.4**

**Rationale**: This property validates the last-resort fallback mechanism, ensuring the system remains functional even in complete infrastructure failure.

### Property 10: JSON Format Compatibility

*For any* JSON file in the current format, the refactored system should parse it correctly and produce the same data structures as the original implementation.

**Validates: Requirements 7.5**

**Rationale**: This property ensures backward compatibility with existing JSON fallback files.

### Property 11: Configuration Fallback

*For any* missing environment variable, the system should log a warning and use a sensible default value, allowing the system to continue operating.

**Validates: Requirements 8.4**

**Rationale**: This property ensures the system is resilient to configuration errors and provides clear feedback about missing configuration.

### Property 12: Error Logging with Context

*For any* API call failure, the system should log an error message containing the URL, HTTP method, and error details.

**Validates: Requirements 9.2**

**Rationale**: This property ensures errors are diagnosable by providing sufficient context in logs.

### Property 13: Database Error Fallback

*For any* database operation failure, the system should log the error and attempt the next fallback strategy (e.g., JSON files) rather than failing completely.

**Validates: Requirements 9.3**

**Rationale**: This property ensures database failures don't cause complete system failure - the fallback chain continues.

### Property 14: Data Source Logging

*For any* MPI calculation, the system should log which data source was used (API, database cache, or JSON file).

**Validates: Requirements 9.4**

**Rationale**: This property provides observability into the system's behavior, making it clear when fallbacks are being used.

### Property 15: Actionable Error Messages

*For any* error condition, the error message should include enough information to identify the failure point (component name, operation, and context).

**Validates: Requirements 9.5**

**Rationale**: This property ensures errors are actionable, reducing debugging time.

### Property 16: Neighborhood Data Caching

*For any* set of listings sharing the same neighborhood, the neighborhood data should be loaded only once and reused across all listings in that neighborhood.

**Validates: Requirements 10.1**

**Rationale**: This property ensures performance optimization by avoiding redundant API calls for the same neighborhood data.

### Property 17: Performance Threshold

*For any* set of 100 listings with available data, the complete MPI calculation (all timeframes, all groupings) should complete in under 5 seconds.

**Validates: Requirements 10.5**

**Rationale**: This property ensures the refactored system maintains acceptable performance characteristics.

## Error Handling

The refactored architecture implements comprehensive error handling at each layer with clear recovery strategies.

### Error Handling Strategy

1. **Fail Gracefully**: Errors should not crash the application; instead, use fallback mechanisms
2. **Log Comprehensively**: Every error should be logged with sufficient context for debugging
3. **Provide Context**: Error messages should indicate which component failed and why
4. **Chain Fallbacks**: When one data source fails, automatically try the next in priority order

### Error Categories and Handling

#### API Errors

**Error Types**:
- Network failures (timeout, connection refused)
- HTTP errors (401 Unauthorized, 404 Not Found, 500 Server Error)
- Invalid response format (malformed JSON)

**Handling Strategy**:
```typescript
try {
  const data = await apiClient.loadListings();
  await database.saveListings(data.listings);
  return data;
} catch (error) {
  logger.apiFailure('GET', '/listings', error);
  logger.fallbackUsed('database', 'API unavailable');
  return await database.getListings();
}
```

**Recovery**: Fall back to database cache, then JSON files

#### Database Errors

**Error Types**:
- Connection failures (database unavailable)
- Query errors (syntax errors, constraint violations)
- Transaction failures (deadlocks, timeouts)

**Handling Strategy**:
```typescript
try {
  return await database.getListings();
} catch (error) {
  logger.error('Database query failed', error);
  logger.fallbackUsed('JSON files', 'Database unavailable');
  return await fileSource.loadListings();
}
```

**Recovery**: Fall back to JSON files (last resort)

#### Calculation Errors

**Error Types**:
- Missing data (no neighborhood data for listing)
- Invalid data (negative occupancy, null values)
- Division by zero (market occupancy is zero)

**Handling Strategy**:
```typescript
try {
  const mpi = calculator.calculateMPI(listing, neighborhoodData, timeframe);
  return mpi;
} catch (error) {
  logger.error(`MPI calculation failed for listing ${listing.id}`, error);
  return 0; // Return neutral MPI value
}
```

**Recovery**: Return neutral value (MPI = 0 or 100 depending on context) and log the issue

#### Configuration Errors

**Error Types**:
- Missing environment variables
- Invalid configuration values (negative timeouts, invalid URLs)

**Handling Strategy**:
```typescript
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mpi_dev'
};

if (!process.env.DB_HOST) {
  logger.warn('DB_HOST not set, using default: localhost');
}
```

**Recovery**: Use sensible defaults and log warnings

### Error Propagation

Errors are handled at the appropriate level:

- **Infrastructure Layer** (API, Database): Catch and log errors, throw custom exceptions
- **Data Access Layer** (DataService): Catch infrastructure errors, attempt fallbacks, throw if all sources fail
- **Business Logic Layer** (Calculators): Catch data access errors, return neutral values or partial results
- **Presentation Layer** (Adapters): Catch all errors, return user-friendly error responses

### Custom Exception Types

```typescript
class APIError extends Error {
  constructor(
    message: string,
    public url: string,
    public method: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class DatabaseError extends Error {
  constructor(
    message: string,
    public operation: string,
    public originalError: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

class CalculationError extends Error {
  constructor(
    message: string,
    public listingId: string,
    public timeframe: Timeframe
  ) {
    super(message);
    this.name = 'CalculationError';
  }
}
```

**Design Rationale**: Custom exception types provide structured error information, making it easier to handle different error scenarios appropriately and log relevant context.

## Testing Strategy

The testing strategy for the refactored architecture employs a dual approach: unit tests for isolated component verification and property-based tests for comprehensive behavioral validation.

### Testing Approach

#### Unit Testing

Unit tests verify specific examples, edge cases, and error conditions for individual components in isolation.

**Focus Areas**:
- Individual class methods with mocked dependencies
- Edge cases (empty data, null values, boundary conditions)
- Error handling paths
- Configuration scenarios

**Example Unit Tests**:
```typescript
describe('OccupancyCalculator', () => {
  it('should calculate property occupancy from listing data', () => {
    const calculator = new OccupancyCalculator(mockLogger);
    const listing = createMockListing({ adjusted_occupancy_past_30: '75.5%' });
    const dateRange = { start: new Date('2024-01-01'), end: new Date('2024-01-30') };
    
    const occupancy = calculator.calculatePropertyOccupancy(listing, dateRange);
    
    expect(occupancy).toBe(75.5);
  });

  it('should handle missing occupancy data gracefully', () => {
    const calculator = new OccupancyCalculator(mockLogger);
    const listing = createMockListing({ adjusted_occupancy_past_30: null });
    const dateRange = { start: new Date('2024-01-01'), end: new Date('2024-01-30') };
    
    const occupancy = calculator.calculatePropertyOccupancy(listing, dateRange);
    
    expect(occupancy).toBe(0);
  });
});
```

**Unit Test Guidelines**:
- Use dependency injection to provide mock dependencies
- Test one behavior per test case
- Use descriptive test names that explain the scenario
- Avoid testing implementation details; focus on observable behavior
- Keep tests fast (no real API calls, no real database operations)

#### Property-Based Testing

Property-based tests verify universal properties across many generated inputs, providing comprehensive coverage of the input space.

**Property Testing Library**: We will use **fast-check** for TypeScript property-based testing.

**Configuration**: Each property test will run a minimum of 100 iterations to ensure thorough coverage.

**Focus Areas**:
- Behavioral equivalence between old and new implementations
- Round-trip properties (serialize/deserialize, store/retrieve)
- Invariants (data freshness, fallback order)
- Performance characteristics

**Example Property Tests**:

```typescript
import fc from 'fast-check';

describe('Property Tests: Database Persistence', () => {
  it('Property 1: Database Persistence Round-Trip for Listings', async () => {
    // Feature: architecture-refactoring, Property 1: For any listing data retrieved from the API, storing it to the database and then retrieving it should produce equivalent data
    
    await fc.assert(
      fc.asyncProperty(
        listingArbitrary(), // Generator for random valid listings
        async (listing) => {
          const database = new DatabaseLayer(testConnection, mockLogger);
          
          await database.saveListings([listing]);
          const retrieved = await database.getListings();
          
          expect(retrieved).toHaveLength(1);
          expect(retrieved[0]).toEqual(listing);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Backward Compatibility - Calculation Results', async () => {
    // Feature: architecture-refactoring, Property 6: For any valid input, the refactored implementation should produce identical MPI calculation results to the original implementation
    
    await fc.assert(
      fc.asyncProperty(
        listingArbitrary(),
        neighborhoodDataArbitrary(),
        timeframeArbitrary(),
        async (listing, neighborhoodData, timeframe) => {
          // Original implementation
          const originalMPI = await originalCalculateListingMPI(
            listing,
            neighborhoodData,
            timeframe
          );
          
          // Refactored implementation
          const calculator = new MPICalculator(
            new OccupancyCalculator(mockLogger),
            mockLogger
          );
          const refactoredMPI = calculator.calculateMPI(
            listing,
            neighborhoodData,
            timeframe
          );
          
          expect(refactoredMPI).toBeCloseTo(originalMPI, 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Property Test Guidelines**:
- Tag each test with the property number and description from this design document
- Use custom arbitraries (generators) that produce valid domain objects
- Run at least 100 iterations per property
- Use appropriate equality checks (exact for integers, approximate for floats)
- Test properties, not examples

#### Integration Testing

Integration tests verify end-to-end functionality with real components (but may use test databases or mock APIs).

**Focus Areas**:
- Complete data flow from API through database to calculations
- Fallback strategy execution (API → Database → JSON)
- Multi-component interactions
- Backward compatibility with existing tests

**Existing Tests**: The 8 existing Vitest tests serve as integration tests and must pass without modification:
- `bug-1-data-mismatch.test.ts`: Validates data consistency
- `bug-2-dead-code.test.ts`: Validates code path coverage
- `bug-3-scaling.test.ts`: Validates MPI scaling logic
- `bug-5-date-range.test.ts`: Validates date range calculations

**Integration Test Guidelines**:
- Use in-memory SQLite database for fast, isolated tests
- Mock external API calls to avoid flakiness
- Test realistic scenarios with real data structures
- Verify logging output for observability

### Test Data Generation

For property-based testing, we need generators (arbitraries) for domain objects:

```typescript
// Arbitrary for generating valid Listings
function listingArbitrary(): fc.Arbitrary<Listing> {
  return fc.record({
    id: fc.uuid(),
    pms: fc.constantFrom('guesty', 'hostaway', 'lodgify'),
    name: fc.string({ minLength: 5, maxLength: 50 }),
    city_name: fc.constantFrom('Austin', 'Denver', 'Nashville'),
    no_of_bedrooms: fc.integer({ min: 1, max: 6 }),
    adjusted_occupancy_past_30: fc.float({ min: 0, max: 100 }).map(n => `${n.toFixed(1)}%`),
    adjusted_occupancy_past_90: fc.float({ min: 0, max: 100 }).map(n => `${n.toFixed(1)}%`),
    // ... other fields
  });
}

// Arbitrary for generating valid Timeframes
function timeframeArbitrary(): fc.Arbitrary<Timeframe> {
  return fc.constantFrom(7, 30, 60, 90, 120);
}

// Arbitrary for generating valid NeighborhoodData
function neighborhoodDataArbitrary(): fc.Arbitrary<NeighborhoodData> {
  return fc.record({
    data: fc.record({
      'Listings Used': fc.integer({ min: 10, max: 100 }),
      currency: fc.constant('USD'),
      lat: fc.float({ min: -90, max: 90 }),
      lng: fc.float({ min: -180, max: 180 }),
      source: fc.constant('pricelabs'),
      'Market KPI': fc.record({
        Category: fc.dictionary(
          fc.string(),
          fc.record({
            X_values: fc.array(fc.string(), { minLength: 12, maxLength: 12 }),
            Y_values: fc.array(fc.array(fc.float({ min: 0, max: 100 })))
          })
        )
      }),
      // ... other fields
    })
  });
}
```

### Test Coverage Goals

- **Unit Test Coverage**: 80%+ of all class methods
- **Property Test Coverage**: All 17 correctness properties implemented
- **Integration Test Coverage**: All 8 existing tests passing + new end-to-end scenarios
- **Edge Case Coverage**: Null values, empty arrays, boundary conditions, error states

### Testing Tools

- **Test Framework**: Vitest (already in use)
- **Property Testing**: fast-check
- **Mocking**: Vitest's built-in mocking capabilities
- **Database Testing**: In-memory SQLite
- **Coverage**: Vitest coverage reporter (c8)

### Continuous Integration

Tests should run automatically on:
- Every commit (unit tests + fast property tests)
- Pull requests (full test suite including 100-iteration property tests)
- Pre-deployment (full test suite + performance benchmarks)

**CI Configuration**:
```yaml
test:
  unit: vitest run --coverage
  property: vitest run --grep "Property Tests" --minRuns=100
  integration: vitest run --grep "Integration"
  all: vitest run --coverage --minRuns=100
```


## Refactoring Strategy

The refactoring will follow an incremental approach that maintains system functionality at every step, allowing for continuous testing and validation.

### Migration Approach

The refactoring follows a **Strangler Fig Pattern**: gradually replace the old implementation with the new one while maintaining backward compatibility throughout the process.

```
Phase 1: Foundation
  ↓
Phase 2: Infrastructure Layer
  ↓
Phase 3: Data Access Layer
  ↓
Phase 4: Business Logic Layer
  ↓
Phase 5: Integration & Cleanup
```

### Phase 1: Foundation (Interfaces and Types)

**Goal**: Establish the architectural foundation without changing existing functionality.

**Tasks**:
1. Define all interfaces (`IDataSource`, `IDatabase`, `ICalculator`)
2. Create DTOs for data transfer between layers
3. Set up dependency injection container
4. Create database schema definitions
5. Set up testing infrastructure (fast-check, test utilities)

**Validation**: All existing tests still pass (no functional changes yet)

**Estimated Effort**: 1-2 days

### Phase 2: Infrastructure Layer

**Goal**: Implement the lowest-level components that have no dependencies on business logic.

**Tasks**:
1. Implement `APIClient` class (extract from current data-loader.ts)
2. Implement `FileDataSource` class (extract from current data-loader.ts)
3. Implement `DatabaseLayer` class (new functionality)
   - SQLite implementation for development
   - PostgreSQL implementation for production
4. Create database migration scripts
5. Write unit tests for each infrastructure component
6. Write property tests for database persistence (Properties 1, 2)

**Validation**: 
- Infrastructure components work in isolation
- Database round-trip properties pass
- Existing tests still pass (using adapter layer)

**Estimated Effort**: 3-4 days

### Phase 3: Data Access Layer

**Goal**: Implement the data orchestration layer with fallback strategy.

**Tasks**:
1. Implement `DataService` class
2. Implement fallback strategy (API → Database → File)
3. Implement data caching logic
4. Implement data freshness checking
5. Write unit tests for DataService
6. Write property tests for fallback behavior (Properties 3, 5, 8, 9)

**Validation**:
- Fallback strategy works correctly
- Data caching and freshness properties pass
- Existing tests still pass

**Estimated Effort**: 2-3 days

### Phase 4: Business Logic Layer

**Goal**: Refactor calculation logic into classes.

**Tasks**:
1. Implement `OccupancyCalculator` class (extract from data-loader.ts)
2. Implement `MPICalculator` class (extract from mpi-calculator.ts)
3. Implement calculation methods with dependency injection
4. Write unit tests for calculators
5. Write property tests for calculation equivalence (Property 6)
6. Write property tests for performance (Property 17)

**Validation**:
- Calculation results match original implementation
- All existing tests pass
- Property 6 (backward compatibility) passes

**Estimated Effort**: 3-4 days

### Phase 5: Integration & Cleanup

**Goal**: Complete the migration and remove old code.

**Tasks**:
1. Update adapter functions to use new classes
2. Add comprehensive logging throughout
3. Write property tests for error handling (Properties 12-15)
4. Write property tests for configuration (Property 11)
5. Run full test suite (unit + property + integration)
6. Performance benchmarking
7. Documentation updates
8. Remove old functional code (optional, can keep for reference)

**Validation**:
- All 17 correctness properties pass
- All 8 existing tests pass
- Performance meets requirements
- Code coverage ≥ 80%

**Estimated Effort**: 2-3 days

### Backward Compatibility Strategy

Throughout the refactoring, backward compatibility is maintained through adapter functions:

```typescript
// lib/mpi-calculator.ts (public API - unchanged)

import { createDependencyContainer } from './di-container';
import { DataService } from './services/data-service';
import { MPICalculator } from './calculators/mpi-calculator';

// Adapter function - maintains old API signature
export async function calculateMPISummaries(
  grouping: string = 'city_name'
): Promise<MPISummary[]> {
  const container = createDependencyContainer();
  const dataService = container.get<DataService>('DataService');
  const mpiCalculator = container.get<MPICalculator>('MPICalculator');
  
  const listingsData = await dataService.loadListings();
  const calculatedMPIs: CalculatedMPI[] = [];
  
  for (const listing of listingsData.listings) {
    const neighborhoodData = await dataService.loadNeighborhood(listing.id);
    const mpi = await mpiCalculator.calculateAllMPIs(listing, neighborhoodData);
    calculatedMPIs.push(mpi);
  }
  
  return mpiCalculator.calculateGroupAverages(calculatedMPIs, grouping, listingsData);
}

// Other adapter functions...
export async function loadListingsData(): Promise<ListingsData> { /* ... */ }
export async function loadNeighborhoodData(listingId: string): Promise<NeighborhoodData> { /* ... */ }
```

**Benefits**:
- Existing code continues to work without modification
- Tests don't need to be updated
- Migration can be done incrementally
- Old and new implementations can coexist during transition

### Feature Flag Strategy (Optional)

For extra safety during migration, a feature flag can control which implementation is used:

```typescript
const USE_NEW_ARCHITECTURE = process.env.USE_NEW_ARCHITECTURE === 'true';

export async function calculateMPISummaries(
  grouping: string = 'city_name'
): Promise<MPISummary[]> {
  if (USE_NEW_ARCHITECTURE) {
    return calculateMPISummariesNew(grouping);
  } else {
    return calculateMPISummariesOld(grouping);
  }
}
```

This allows:
- A/B testing in production
- Quick rollback if issues are discovered
- Gradual rollout to users
- Performance comparison between implementations

### Risk Mitigation

**Risk**: Database adds latency to calculations
**Mitigation**: 
- Use connection pooling
- Implement caching at multiple levels
- Make database operations async and non-blocking
- Benchmark performance continuously

**Risk**: Database failures cause system downtime
**Mitigation**:
- Implement comprehensive fallback strategy
- Use JSON files as last resort
- Log all fallback usage for monitoring
- Test failure scenarios explicitly

**Risk**: Refactoring introduces bugs
**Mitigation**:
- Maintain backward compatibility throughout
- Run existing tests continuously
- Implement property-based tests for equivalence
- Use feature flags for safe rollout

**Risk**: Complex nested data structures cause serialization issues
**Mitigation**:
- Test round-trip properties extensively
- Use JSON for complex structures (NeighborhoodData)
- Validate serialization with property tests
- Keep serialization logic isolated and testable

### Code Organization

The refactored code will be organized into a clear directory structure:

```
lib/
├── mpi-calculator.ts          # Public API (adapters)
├── data-loader.ts             # Public API (adapters)
├── logger.ts                  # Existing logger (unchanged)
├── interfaces/
│   ├── IDataSource.ts
│   ├── IDatabase.ts
│   └── ICalculator.ts
├── models/
│   ├── DTOs.ts
│   └── Errors.ts
├── infrastructure/
│   ├── APIClient.ts
│   ├── FileDataSource.ts
│   ├── DatabaseLayer.ts
│   ├── SQLiteDatabase.ts
│   └── PostgreSQLDatabase.ts
├── services/
│   └── DataService.ts
├── calculators/
│   ├── OccupancyCalculator.ts
│   └── MPICalculator.ts
├── config/
│   ├── Config.ts
│   └── DIContainer.ts
└── utils/
    ├── DateUtils.ts
    └── ValidationUtils.ts
```

**Design Rationale**: 
- Clear separation by layer (infrastructure, services, calculators)
- Interfaces in dedicated directory for easy reference
- Public API files remain at top level for backward compatibility
- Configuration and DI isolated for easy testing

### Documentation Requirements

Each phase should include:

1. **Code Documentation**:
   - JSDoc comments for all public classes and methods
   - Inline comments for complex logic
   - Examples in JSDoc for common use cases

2. **Architecture Documentation**:
   - Class diagrams showing relationships
   - Sequence diagrams for key flows (data loading, fallback strategy)
   - Decision records for major design choices

3. **Migration Documentation**:
   - Mapping of old functions to new classes
   - Examples of using new API directly
   - Troubleshooting guide for common issues

4. **Testing Documentation**:
   - How to run different test suites
   - How to add new property tests
   - How to mock dependencies for testing

### Success Criteria

The refactoring is considered successful when:

1. ✅ All 8 existing tests pass without modification
2. ✅ All 17 correctness properties pass with 100+ iterations
3. ✅ Code coverage ≥ 80%
4. ✅ Performance: 100 listings calculated in < 5 seconds
5. ✅ All classes follow SOLID principles (verified by code review)
6. ✅ Database integration works with both SQLite and PostgreSQL
7. ✅ Fallback strategy works correctly (verified by property tests)
8. ✅ Comprehensive documentation completed
9. ✅ No TypeScript errors in strict mode
10. ✅ Logging provides clear observability into system behavior

## Implementation Notes

### Dependency Injection Container

The system uses a simple dependency injection container to manage object creation and dependencies:

```typescript
// config/DIContainer.ts

type Constructor<T> = new (...args: any[]) => T;

class DIContainer {
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();

  register<T>(name: string, factory: () => T): void {
    this.factories.set(name, factory);
  }

  get<T>(name: string): T {
    if (this.services.has(name)) {
      return this.services.get(name);
    }

    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Service not registered: ${name}`);
    }

    const instance = factory();
    this.services.set(name, instance);
    return instance;
  }

  clear(): void {
    this.services.clear();
  }
}

export function createDependencyContainer(): DIContainer {
  const container = new DIContainer();
  const config = loadConfig();
  const logger = new Logger();

  // Infrastructure layer
  container.register('Logger', () => logger);
  container.register('Config', () => config);
  container.register('APIClient', () => new APIClient(config, logger));
  container.register('FileDataSource', () => new FileDataSource('./public', logger));
  container.register('DatabaseLayer', () => {
    const db = config.database.type === 'postgres'
      ? new PostgreSQLDatabase(config.database, logger)
      : new SQLiteDatabase(config.database, logger);
    return new DatabaseLayer(db, logger);
  });

  // Services layer
  container.register('DataService', () => new DataService(
    container.get('APIClient'),
    container.get('FileDataSource'),
    container.get('DatabaseLayer'),
    logger
  ));

  // Calculators layer
  container.register('OccupancyCalculator', () => new OccupancyCalculator(logger));
  container.register('MPICalculator', () => new MPICalculator(
    container.get('OccupancyCalculator'),
    logger
  ));

  return container;
}
```

**Design Rationale**: 
- Simple, lightweight DI container (no external dependencies)
- Singleton pattern for services (created once, reused)
- Easy to override for testing (register mock implementations)
- Clear dependency graph visible in one place

### Configuration Management

Configuration is loaded from environment variables with sensible defaults:

```typescript
// config/Config.ts

export interface DatabaseConfig {
  type: 'sqlite' | 'postgres';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  maxConnections?: number;
}

export interface APIConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
}

export interface AppConfig {
  database: DatabaseConfig;
  api: APIConfig;
  cache: {
    maxAgeHours: number;
  };
}

export function loadConfig(): AppConfig {
  const logger = new Logger();

  const config: AppConfig = {
    database: {
      type: (process.env.DB_TYPE as 'sqlite' | 'postgres') || 'sqlite',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || ':memory:',
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    },
    api: {
      baseUrl: process.env.API_BASE_URL || 'https://api.pricelabs.co',
      apiKey: process.env.API_KEY || '',
      timeout: parseInt(process.env.API_TIMEOUT || '30000'),
      retries: parseInt(process.env.API_RETRIES || '3'),
    },
    cache: {
      maxAgeHours: parseInt(process.env.CACHE_MAX_AGE_HOURS || '24'),
    },
  };

  // Validate and warn about missing configuration
  if (!config.api.apiKey) {
    logger.warn('API_KEY not set, API calls will likely fail');
  }

  if (config.database.type === 'postgres' && !config.database.password) {
    logger.warn('DB_PASSWORD not set for PostgreSQL');
  }

  return config;
}
```

**Design Rationale**:
- Environment variables for all configurable values
- Sensible defaults for development (SQLite in-memory)
- Validation with warnings for missing critical config
- Type-safe configuration object

### Database Connection Management

Database connections are managed with connection pooling for performance:

```typescript
// infrastructure/DatabaseLayer.ts

export class DatabaseLayer implements IDatabase {
  private pool: ConnectionPool;

  constructor(
    private config: DatabaseConfig,
    private logger: Logger
  ) {
    this.pool = this.createConnectionPool();
  }

  private createConnectionPool(): ConnectionPool {
    if (this.config.type === 'postgres') {
      return new PostgreSQLPool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        max: this.config.maxConnections,
      });
    } else {
      return new SQLitePool({
        filename: this.config.database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      });
    }
  }

  async initialize(): Promise<void> {
    await this.createTables();
    this.logger.info('Database initialized successfully');
  }

  async close(): Promise<void> {
    await this.pool.close();
    this.logger.info('Database connections closed');
  }

  // ... other methods
}
```

**Design Rationale**:
- Connection pooling for performance
- Lazy initialization (tables created on first use)
- Graceful shutdown (close connections properly)
- Abstraction over SQLite vs PostgreSQL differences

### Performance Optimization Techniques

1. **Parallel Processing**: Use `Promise.all()` for independent operations
   ```typescript
   const mpiPromises = listings.map(listing => 
     calculateMPIForListing(listing, neighborhoodData)
   );
   const results = await Promise.all(mpiPromises);
   ```

2. **Caching**: Cache neighborhood data to avoid redundant API calls
   ```typescript
   private neighborhoodCache = new Map<string, NeighborhoodData>();
   
   async loadNeighborhood(listingId: string): Promise<NeighborhoodData> {
     if (this.neighborhoodCache.has(listingId)) {
       return this.neighborhoodCache.get(listingId)!;
     }
     const data = await this.fetchNeighborhood(listingId);
     this.neighborhoodCache.set(listingId, data);
     return data;
   }
   ```

3. **Single-Pass Algorithms**: Process data in one pass when possible
   ```typescript
   // Calculate group averages in single pass
   const groups = new Map<string, { sum: number; count: number }>();
   for (const mpi of calculatedMPIs) {
     const key = this.getGroupKey(mpi, grouping);
     const existing = groups.get(key) || { sum: 0, count: 0 };
     groups.set(key, {
       sum: existing.sum + mpi.mpi_30,
       count: existing.count + 1
     });
   }
   ```

4. **Database Indexing**: Create indexes on frequently queried columns
   ```sql
   CREATE INDEX idx_listings_city ON listings(city_name);
   CREATE INDEX idx_listings_bedrooms ON listings(no_of_bedrooms);
   ```

### Logging Strategy

Comprehensive logging provides observability into system behavior:

```typescript
// Example logging throughout the system

// Data loading
logger.info('Loading listings data');
logger.apiCall('GET', '/listings');
logger.apiSuccess('GET', '/listings', listings.length);
logger.info(`Loaded ${listings.length} listings from API`);

// Fallback usage
logger.fallbackUsed('database', 'API timeout after 30s');
logger.info(`Loaded ${listings.length} listings from database cache`);

// Calculations
logger.mpiCalculation(listing.id, 30, mpi);
logger.debug(`Property occupancy: ${propertyOcc}%, Market occupancy: ${marketOcc}%`);

// Performance
const startTime = Date.now();
// ... operation ...
logger.performance('calculateMPISummaries', Date.now() - startTime);

// Errors
logger.error('Failed to load neighborhood data', error);
logger.warn('Using stale data (48 hours old)');
```

**Log Levels**:
- **DEBUG**: Detailed information for debugging (only in development)
- **INFO**: General information about system operation
- **WARN**: Warning conditions that should be investigated
- **ERROR**: Error conditions that need immediate attention

### Migration Checklist

Before considering the refactoring complete, verify:

- [ ] All interfaces defined and documented
- [ ] All classes implemented with single responsibilities
- [ ] Dependency injection container configured
- [ ] Database schema created and tested
- [ ] SQLite implementation working
- [ ] PostgreSQL implementation working
- [ ] API client implemented and tested
- [ ] File data source implemented and tested
- [ ] Data service with fallback strategy implemented
- [ ] Occupancy calculator implemented and tested
- [ ] MPI calculator implemented and tested
- [ ] All adapter functions working
- [ ] All 8 existing tests passing
- [ ] All 17 property tests implemented and passing
- [ ] Unit test coverage ≥ 80%
- [ ] Performance benchmarks meeting requirements
- [ ] Error handling comprehensive
- [ ] Logging comprehensive
- [ ] Configuration management working
- [ ] Documentation complete
- [ ] Code review completed
- [ ] TypeScript strict mode enabled with no errors

---

## Summary

This design document specifies a comprehensive refactoring of the MPI Calculator from functional to object-oriented architecture. The refactored system demonstrates professional software engineering practices including:

- **SOLID principles** applied throughout
- **Layered architecture** with clear separation of concerns
- **Interface-driven design** for loose coupling and testability
- **Database integration** for resilience and caching
- **Comprehensive error handling** with fallback strategies
- **Property-based testing** for correctness guarantees
- **Backward compatibility** maintained throughout migration

The refactoring will be executed in five phases over approximately 11-16 days, with continuous validation at each step to ensure no regression in functionality. The result will be a maintainable, extensible, and professional codebase that serves as a strong portfolio piece demonstrating advanced software design skills.
