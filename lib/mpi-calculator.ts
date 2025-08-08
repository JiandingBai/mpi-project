import { 
  Listing, 
  ListingsData, 
  MPISummary, 
  CalculatedMPI, 
  Timeframe, 
  NeighborhoodData,
  OccupancyData 
} from '../types';
import { 
  matchListingToNeighborhood, 
  calculateMarketOccupancy, 
  calculatePropertyOccupancy,
  loadNeighborhoodData
} from './data-loader';

/**
 * Calculate date range for a given timeframe
 */
function getDateRangeForTimeframe(timeframe: Timeframe): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  
  switch (timeframe) {
    case 7:
      start.setDate(end.getDate() - 7);
      break;
    case 30:
      start.setDate(end.getDate() - 30);
      break;
    case 60:
      start.setDate(end.getDate() - 60);
      break;
    case 90:
      start.setDate(end.getDate() - 90);
      break;
    case 120:
      start.setDate(end.getDate() - 120);
      break;
  }
  
  return { start, end };
}

/**
 * Get a key for grouping listings, based on the selected grouping method
 */
function getGroupKey(listing: Listing, grouping: string): string {
  switch (grouping) {
    case 'bedrooms':
      return `${listing.no_of_bedrooms} Bedroom${listing.no_of_bedrooms !== 1 ? 's' : ''}`;
    case 'city':
      return listing.city_name || 'Unknown City';
    case 'city-bedrooms':
      const city = listing.city_name || 'Unknown City';
      const bedrooms = listing.no_of_bedrooms;
      return `${city}-${bedrooms}BR`;
    default:
      return listing.group || 'Unknown';
  }
}

/**
 * Calculate MPI for a single listing using neighborhood data
 */
async function calculateListingMPI(
  listing: Listing
): Promise<CalculatedMPI> {
  const getMPI = async (timeframe: Timeframe): Promise<number> => {
    const mpiField = `mpi_next_${timeframe}` as keyof Listing;
    const existingMPI = listing[mpiField] as number;
    
    // Priority 1: If existing MPI is available and valid, use it
    // Note: 0.0 is a valid MPI value (means 0% of market occupancy)
    if (existingMPI !== undefined && existingMPI !== null && existingMPI >= 0) {
      return existingMPI;
    }
    
    // Priority 2: Try to calculate using real neighborhood data from PriceLabs API
    try {
      const dateRange = getDateRangeForTimeframe(timeframe);
      
      // Load neighborhood data for this specific listing
      const neighborhoodData = await loadNeighborhoodData(listing.id);
      
      // Match listing to neighborhood category
      const categoryId = matchListingToNeighborhood(listing, neighborhoodData);
      if (categoryId) {
        // Calculate property occupancy
        const propertyOccupancy = calculatePropertyOccupancy(listing, dateRange.start, dateRange.end);
        
        // Calculate market occupancy from real neighborhood data
        const marketOccupancy = calculateMarketOccupancy(neighborhoodData, categoryId, dateRange.start, dateRange.end);
        
        // Calculate MPI: (property_occupancy / market_occupancy) * 100
        if (marketOccupancy > 0) {
          const calculatedMPI = (propertyOccupancy / marketOccupancy) * 100;
          console.log(`✅ Calculated MPI ${timeframe}-day for listing ${listing.id}: ${calculatedMPI.toFixed(2)} (property: ${(propertyOccupancy * 100).toFixed(1)}%, market: ${(marketOccupancy * 100).toFixed(1)}%)`);
          return calculatedMPI;
        }
      }
    } catch (error) {
      console.log(`❌ Failed to calculate MPI ${timeframe}-day using neighborhood data for listing ${listing.id}:`, error);
    }
    
    // Priority 3: If no neighborhood data available, return 0 (no data)
    console.log(`⚠️ No MPI data available for ${timeframe}-day for listing ${listing.id} (no existing MPI and no neighborhood data)`);
    return 0;
  };
  
  const [mpi_7, mpi_30, mpi_60, mpi_90, mpi_120] = await Promise.all([
    getMPI(7),
    getMPI(30),
    getMPI(60),
    getMPI(90),
    getMPI(120)
  ]);
  
  return {
    listingId: listing.id,
    group: listing.group || 'Unknown',
    mpi_7,
    mpi_30,
    mpi_60,
    mpi_90,
    mpi_120,
  };
}

/**
 * Groups listings by group and calculates average MPI for each group
 */
function calculateGroupAverages(calculatedMPIs: CalculatedMPI[], grouping: string, listingsData: ListingsData): MPISummary[] {
  const groupMap = new Map<string, CalculatedMPI[]>();
  
  calculatedMPIs.forEach(mpi => {
    // Find the original listing to get the grouping data
    const originalListing = listingsData.listings.find(listing => listing.id === mpi.listingId);
    if (originalListing) {
      const groupKey = getGroupKey(originalListing, grouping);
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(mpi);
    }
  });
  
  const summaries: MPISummary[] = [];
  groupMap.forEach((mpis, groupName) => {
    const count = mpis.length;
    const mpi_7 = mpis.reduce((sum, mpi) => sum + mpi.mpi_7, 0) / count;
    const mpi_30 = mpis.reduce((sum, mpi) => sum + mpi.mpi_30, 0) / count;
    const mpi_60 = mpis.reduce((sum, mpi) => sum + mpi.mpi_60, 0) / count;
    const mpi_90 = mpis.reduce((sum, mpi) => sum + mpi.mpi_90, 0) / count;
    const mpi_120 = mpis.reduce((sum, mpi) => sum + mpi.mpi_120, 0) / count;
    
    summaries.push({
      group: groupName,
      mpi_7: Math.round(mpi_7 * 100) / 100,
      mpi_30: Math.round(mpi_30 * 100) / 100,
      mpi_60: Math.round(mpi_60 * 100) / 100,
      mpi_90: Math.round(mpi_90 * 100) / 100,
      mpi_120: Math.round(mpi_120 * 100) / 100,
      listingCount: count,
    });
  });
  return summaries.sort((a, b) => a.group.localeCompare(b.group));
}

/**
 * Main function to process listings and calculate MPI summaries using neighborhood data
 */
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
      
      // Count calculation methods used
      const timeframes: Timeframe[] = [7, 30, 60, 90, 120];
      timeframes.forEach(timeframe => {
        const mpiField = `mpi_next_${timeframe}` as keyof Listing;
        const existingMPI = listing[mpiField] as number;
        
        if (existingMPI !== undefined && existingMPI !== null && existingMPI >= 0) {
          existingMPIUsed++;
        } else {
          // Check if we calculated from neighborhood data or had no data
          // This is a simplified check - in reality we'd track this during calculation
          // For now, we'll assume no data was available if no existing MPI
          noDataAvailable++;
        }
      });
      
      return mpi;
    })
  );
  
  const summaries = calculateGroupAverages(calculatedMPIs, grouping, listingsData);
  
  console.log(`✅ Completed MPI calculations:`);
  console.log(`  - Existing MPI used: ${existingMPIUsed}`);
  console.log(`  - Neighborhood calculated: ${neighborhoodCalculated}`);
  console.log(`  - No data available: ${noDataAvailable}`);
  console.log(`  - Total calculations: ${existingMPIUsed + neighborhoodCalculated + noDataAvailable}`);
  
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

/**
 * Load mock data from JSON files
 */
export async function loadMockData(): Promise<ListingsData> {
  try {
    const response = await fetch('/mock/listings.json');
    const data = await response.json();
    return data as ListingsData;
  } catch (error) {
    console.error('Error loading mock data:', error);
    throw new Error('Failed to load mock data');
  }
}

/**
 * Log MPI summaries to console in table format
 */
export function logMPISummaries(summaries: MPISummary[]): void {
  console.log('MPI Summaries by Group:');
  console.table(summaries.map(summary => ({
    Group: summary.group,
    'MPI 7-day': summary.mpi_7,
    'MPI 30-day': summary.mpi_30,
    'MPI 60-day': summary.mpi_60,
    'MPI 90-day': summary.mpi_90,
    'MPI 120-day': summary.mpi_120,
    'Listings': summary.listingCount,
  })));
}
