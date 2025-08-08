# MPI (Market Penetration Index) Project

A Next.js application that calculates and displays Market Penetration Index statistics for property listings.

## Features

- **MPI Calculation**: Automatically calculates MPI values for each listing using the formula: `MPI = (property_occupancy / market_occupancy) * 100`
- **Group Aggregation**: Groups listings by location and calculates average MPI for each group
- **Multiple Timeframes**: Supports 7, 30, 60, 90, and 120-day MPI calculations
- **Clean UI**: Displays results in a responsive, clean table format
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
│   ├── mpi-calculator.ts    # Core MPI calculation logic
│   ├── data-loader.ts       # Data loading utilities
│   └── test-mpi.ts          # Test script for MPI calculations
├── types/
│   └── index.ts             # TypeScript type definitions
├── pages/
│   ├── index.tsx            # Main UI page
│   └── api/
│       └── mpi.ts           # API endpoint
├── public/
│   ├── listings.json        # Mock listings data
│   └── neighborhood.json    # Mock neighborhood data
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
    "totalGroups": 6
  }
}
```

## MPI Calculation Logic

The application processes each listing as follows:

1. **Check for existing MPI values**: If `mpi_next_X` fields exist, use them directly
2. **Calculate missing MPI values**: Use the formula `MPI = (property_occupancy / market_occupancy) * 100`
3. **Group by location**: Aggregate listings by their `group` field
4. **Calculate averages**: Compute average MPI for each timeframe within each group

### Data Sources

- **Property Occupancy**: From `adjusted_occupancy_past_30` and `adjusted_occupancy_past_90` fields
- **Market Occupancy**: From `market_adjusted_occupancy_past_30` and `market_adjusted_occupancy_past_90` fields
- **Existing MPI**: From `mpi_next_7`, `mpi_next_30`, `mpi_next_60`, `mpi_next_90`, `mpi_next_120` fields

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
3. Ensure your data structure matches the `Listing` interface in `types/index.ts`

### Customizing Calculations

Modify the MPI calculation logic in `lib/mpi-calculator.ts`:

- `calculateListingMPI()`: Individual listing MPI calculation
- `calculateGroupAverages()`: Group aggregation logic
- `extractPercentage()`: Helper for parsing percentage strings

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

## Data Format

The application expects listing data in the following format:

```json
{
  "listings": [
    {
      "id": "string",
      "group": "string",
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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the MIT License.
