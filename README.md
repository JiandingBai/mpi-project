# MPI (Market Penetration Index) Project

A Next.js application that calculates and displays Market Penetration Index statistics for property listings using neighborhood market data.

## Features

- **Neighborhood-Based MPI Calculation**: Uses historical neighborhood occupancy data as the market baseline
- **Date-Range Calculations**: Supports accurate MPI calculations for 7, 30, 60, 90, and 120-day periods
- **Real Market Data**: Leverages neighborhood.json for market occupancy rates instead of listing-level approximations
- **Fallback Logic**: Gracefully falls back to listing-level data when neighborhood matching fails
- **Group Aggregation**: Groups listings by location and calculates average MPI for each group
- **Clean UI**: Displays results in a responsive, clean table format with neighborhood information
- **API Endpoint**: RESTful API endpoint for programmatic access to MPI data
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Tech Stack

- **Next.js 15** with TypeScript
- **Tailwind CSS** for styling
- **React 19** for UI components
- **Node.js** for server-side processing

## Project Structure

```
mpi-project/
├── lib/
│   ├── mpi-calculator.ts    # Core MPI calculation logic using neighborhood data
│   ├── data-loader.ts       # Data loading and neighborhood matching utilities
│   └── test-mpi.ts          # Test script for MPI calculations
├── types/
│   └── index.ts             # TypeScript type definitions including neighborhood data
├── pages/
│   ├── index.tsx            # Main UI page with neighborhood info display
│   └── api/
│       └── mpi.ts           # API endpoint loading both datasets
├── public/
│   ├── listings.json        # Mock listings data
│   └── neighborhood.json    # Mock neighborhood data with historical occupancy
└── mock/                    # Original mock data files
```

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** and navigate to `http://localhost:3000`

## API Usage

### Get MPI Summaries

```bash
GET /api/mpi
```

**Response**:
```json
{
  "success": true,
  "data": {
    "summaries": [
      {
        "group": "Colorado",
        "mpi_7": 0.93,
        "mpi_30": 0.88,
        "mpi_60": 0.89,
        "mpi_90": 1.09,
        "mpi_120": 1.29,
        "listingCount": 15
      }
    ],
    "calculatedMPIs": [...],
    "totalListings": 49,
    "totalGroups": 6,
    "neighborhoodInfo": {
      "categories": 10,
      "location": {
        "lat": 42.7645,
        "lng": -76.1467
      },
      "source": "airbnb"
    }
  }
}
```

## MPI Calculation Logic

The application now uses a sophisticated approach that combines listing and neighborhood data:

### 1. **Data Sources**
- **Listings Data**: Property-specific occupancy and booking information
- **Neighborhood Data**: Historical market occupancy by month and category
- **Location Matching**: Geographic proximity and property type matching

### 2. **Calculation Process**
For each listing and timeframe (7, 30, 60, 90, 120 days):

1. **Check Existing MPI**: If `mpi_next_X` exists and is valid, use it
2. **Match to Neighborhood**: Find corresponding neighborhood category based on location/bedroom count
3. **Calculate Date Range**: Determine the specific date range for the timeframe
4. **Extract Market Data**: Get average market occupancy from neighborhood data for that date range
5. **Calculate Property Occupancy**: Use listing's historical occupancy data for the same period
6. **Compute MPI**: `MPI = (property_occupancy / market_occupancy) × 100`
7. **Fallback**: If neighborhood matching fails, use listing-level market occupancy fields

### 3. **Neighborhood Data Structure**
The neighborhood.json contains:
- **Market KPI**: Historical occupancy data by month
- **Categories**: Different property types/bedroom counts
- **Geographic Data**: Latitude/longitude for location matching
- **Time Series**: Monthly occupancy values from Aug 2023 to present

### 4. **Date-Based Calculations**
- **7-day**: Last 7 days from current date
- **30-day**: Last 30 days from current date
- **60-day**: Last 60 days from current date
- **90-day**: Last 90 days from current date
- **120-day**: Last 120 days from current date

## Development

### Running Tests

The project includes a test script to verify MPI calculations:

```bash
# The test script runs automatically when imported
node -e "require('./lib/test-mpi.ts')"
```

### Adding New Data

1. Place your JSON data files in the `public/` directory
2. Update the data loading functions in `lib/data-loader.ts` if needed
3. Ensure your data structure matches the interfaces in `types/index.ts`

### Customizing Calculations

Modify the MPI calculation logic in `lib/mpi-calculator.ts`:

- `calculateListingMPI()`: Individual listing MPI calculation with neighborhood data
- `calculateGroupAverages()`: Group aggregation logic
- `getDateRangeForTimeframe()`: Date range calculation for each timeframe
- `calculateFallbackMPI()`: Fallback logic when neighborhood data is unavailable

### Neighborhood Matching

The `matchListingToNeighborhood()` function in `lib/data-loader.ts` handles:
- Geographic proximity matching
- Bedroom count matching
- Property type matching
- Market segment classification

## Data Format

### Listings Data
```json
{
  "listings": [
    {
      "id": "string",
      "group": "string",
      "latitude": "string",
      "longitude": "string",
      "no_of_bedrooms": "number",
      "mpi_next_7": "number",
      "mpi_next_30": "number",
      "mpi_next_60": "number",
      "mpi_next_90": "number",
      "mpi_next_120": "number",
      "adjusted_occupancy_past_30": "string (e.g., '80 %')",
      "market_adjusted_occupancy_past_30": "string (e.g., '80 %')",
      "adjusted_occupancy_past_90": "string (e.g., '81 %')",
      "market_adjusted_occupancy_past_90": "string (e.g., '76 %')"
    }
  ]
}
```

### Neighborhood Data
```json
{
  "data": {
    "Listings Used": 120,
    "currency": "USD",
    "lat": 42.7645,
    "lng": -76.1467,
    "source": "airbnb",
    "Market KPI": {
      "Category": {
        "0": {
          "X_values": ["Aug 2023", "Sep 2023", ...],
          "Y_values": [[72, 89, 84, ...]]
        }
      }
    }
  }
}
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically

### Other Platforms

Build the project for production:

```bash
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the MIT License.
