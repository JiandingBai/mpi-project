# Technical Documentation

## 🏗 System Architecture

### **Data Flow**
```
PriceLabs API → Data Processing → MPI Calculation → UI Display
     ↓              ↓               ↓               ↓
- Listings      - Neighborhood   - Property     - Table
- Neighborhood  - Data parsing   - Market       - Grouping
- API calls     - Y_values       - Occupancy    - Statistics
                - Date ranges    - MPI formula
```

### **Core Components**

#### **1. Data Loader (`lib/data-loader.ts`)**
```typescript
// API Integration with Fallbacks
loadListingsData(): API → Public files → Sample data
loadNeighborhoodData(listingId): API per listing → Local fallback

// Key Functions
calculateMarketOccupancy(): Extracts occupancy from "Future Occ/New/Canc"
calculatePropertyOccupancy(): Uses most recent property occupancy (past 30 days) as best predictor for all timeframes
```

#### **2. MPI Calculator (`lib/mpi-calculator.ts`)**
```typescript
// Core Calculation
calculateListingMPI(listing): 
  1. Check existing mpi_next_X values
  2. Scale API values (decimal → percentage)
  3. Fallback to neighborhood calculation if needed

// Grouping Logic
getGroupKey(listing, grouping):
  - 'city': listing.city_name
  - 'bedrooms': `${listing.no_of_bedrooms} Bed(s)`
  - 'city-bedrooms': `${city_name}-${bedrooms}BR`
```

#### **3. API Endpoint (`pages/api/mpi.ts`)**
```typescript
// Query Parameters
?grouping=city|bedrooms|city-bedrooms
?compare=true  // Enables comparison mode

// Response Format
{
  summaries: [{ group, mpi_7, mpi_30, mpi_60, mpi_90, mpi_120, listingCount }],
  calculationStats: { existingMPIUsed, neighborhoodCalculated, noDataAvailable }
}
```

---

## 🔧 Key Technical Implementations

### **Neighborhood Data Processing**
```typescript
// Data Structure Understanding
"Future Occ/New/Canc": {
  "X_values": ["2025-08-07", "2025-08-08", ...],  // Daily dates
  "Y_values": [
    [75, 80, 85, ...],  // Y_values[0] = Occupancy percentages
    [5, 3, 7, ...],     // Y_values[1] = New bookings
    [2, 1, 4, ...]      // Y_values[2] = Cancellations
  ]
}

// Processing Logic
1. Parse daily dates within specified range
2. Extract occupancy from Y_values[0] 
3. Convert percentages to decimals (÷ 100)
4. Calculate average for timeframe
```

### **MPI Calculation Formula**
```typescript
// Standard MPI Calculation
MPI = (Property Occupancy / Market Occupancy) × 100

// Implementation with Scaling
const propertyOcc = extractPercentage(listing.adjusted_occupancy_past_30); // Always use most recent
const marketOcc = calculateMarketOccupancy(neighborhoodData, startDate, endDate); // Future-looking
const mpi = (propertyOcc / marketOcc) * 100;

// API Value Scaling (decimal to percentage)
const scaledMPI = existingMPI < 10 ? existingMPI * 100 : existingMPI;
```

### **Date Range Calculations**
```typescript
// Future-looking Date Ranges
function getDateRangeForTimeframe(timeframe: number) {
  const start = new Date();  // Today
  const end = new Date();
  end.setDate(start.getDate() + timeframe);
  return { start, end };
}

// Precise Date Matching
const relevantIndices = X_values
  .map((dateStr, i) => {
    const date = new Date(dateStr);
    return date >= startDate && date <= endDate ? i : -1;
  })
  .filter(i => i !== -1);
```

---

## 🚀 Production Configuration

### **Environment Variables**
```bash
# .env.local
PRICELABS_API_KEY=your_api_key_here

# Vercel Environment
PRICELABS_API_KEY=**** (set in Vercel dashboard)
```

### **API Endpoints**
```typescript
// PriceLabs Integration
GET https://api.pricelabs.co/v1/listings?api_key=${apiKey}
GET https://api.pricelabs.co/v1/neighborhood_data?pms=hostaway&listing_id=${listingId}&api_key=${apiKey}

// Application Endpoints
GET /api/mpi?grouping=city&compare=false
GET /                                     // Main UI
```

### **Deployment Structure**
```
Vercel Production:
├── Environment Variables: PRICELABS_API_KEY
├── Build Command: npm run build
├── Output Directory: .next
├── Domain: mpi-project.vercel.app
└── Node Version: 22.x
```

---

## 🔍 Debugging & Monitoring

### **Calculation Statistics**
```typescript
// Production Monitoring
calculationStats: {
  existingMPIUsed: 245,      // API values used
  neighborhoodCalculated: 0,  // Fallback calculations
  noDataAvailable: 0,        // Missing data
  totalListings: 49
}
```

### **Error Handling**
```typescript
// Fallback Strategy
1. Try PriceLabs API
2. Load from /public/listings.json
3. Use minimal sample data

// Logging
logger.apiCall('GET', url);
logger.apiSuccess('GET', url, dataLength);
logger.apiFailure('GET', url, error);
```

### **Data Validation**
```typescript
// Occupancy Data Validation
if (Y_values[0].every(val => val === 0)) {
  console.log('⚠️ Future Occ/New/Canc has all zeros');
  return 0;
}

// Scale Detection
const isDecimal = avgValue < 10;  // API format
const isPercentage = avgValue >= 10;  // Standard format
```

---

## 📊 Performance Characteristics

### **Response Times**
- **API Calls**: 200-600ms per endpoint
- **Data Processing**: 50-100ms for 49 listings
- **UI Rendering**: <100ms table updates
- **Comparison Mode**: 3-5s (per-listing neighborhood calls)

### **Data Efficiency**
- **Bundle Size**: 95.6 kB optimized
- **Build Time**: ~20 seconds
- **Memory Usage**: Efficient JSON parsing
- **Cache Strategy**: Browser caching for static assets

---

## 🔄 Future Enhancement Considerations

### **Performance Optimizations**
- Batch neighborhood API calls
- Implement Redis caching layer
- Add request debouncing

### **Feature Extensions**
- Historical MPI trending
- CSV export functionality
- Advanced filtering options
- Real-time data refresh

### **Technical Improvements**
- Database integration (Neon PostgreSQL)
- API rate limiting
- Enhanced error boundaries
- Comprehensive test suite

---

*Technical documentation for MPI Calculator - Production deployment at https://mpi-project.vercel.app*
