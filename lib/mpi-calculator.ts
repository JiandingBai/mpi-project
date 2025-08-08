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
  calculatePropertyOccupancy 
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
function calculateListingMPI(
  listing: Listing, 
  neighborhoodData: NeighborhoodData
): CalculatedMPI {
  const group = listing.group || 'Unknown';
  
  // Helper function to get MPI value or calculate it
  const getMPI = (timeframe: Timeframe): number => {
    const mpiField = `mpi_next_${timeframe}` as keyof Listing;
    const existingMPI = listing[mpiField] as number;
    
    // Priority 1: If existing MPI is available and valid, use it
    if (existingMPI !== undefined && existingMPI !== null && existingMPI > 0) {
      return existingMPI;
    }
    
    // Priority 2: Try to calculate using neighborhood data
    const dateRange = getDateRangeForTimeframe(timeframe);
    
    // Match listing to neighborhood category
    const categoryId = matchListingToNeighborhood(listing, neighborhoodData);
    if (categoryId) {
      // Calculate property occupancy
      const propertyOccupancy = calculatePropertyOccupancy(listing, dateRange.start, dateRange.end);
      
      // Calculate market occupancy from neighborhood data
      const marketOccupancy = calculateMarketOccupancy(neighborhoodData, categoryId, dateRange.start, dateRange.end);
      
      // Calculate MPI: (property_occupancy / market_occupancy) * 100
      if (marketOccupancy > 0) {
        return (propertyOccupancy / marketOccupancy) * 100;
      }
    }
    
    // Priority 3: Fallback to using listing-level market occupancy
    return calculateFallbackMPI(listing, timeframe);
  };
  
  return {
    listingId: listing.id,
    group,
    mpi_7: getMPI(7),
    mpi_30: getMPI(30),
    mpi_60: getMPI(60),
    mpi_90: getMPI(90),
    mpi_120: getMPI(120),
  };
}

/**
 * Fallback MPI calculation using listing-level market occupancy data
 * Used when neighborhood data is not available or doesn't match
 */
function calculateFallbackMPI(listing: Listing, timeframe: Timeframe): number {
  // Extract percentage value from string like "80 %"
  function extractPercentage(value: string): number {
    if (!value || value === "Unavailable") return 0;
    const match = value.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) / 100 : 0;
  }
  
  let propertyOccupancy: number;
  let marketOccupancy: number;
  
  if (timeframe === 30) {
    propertyOccupancy = extractPercentage(listing.adjusted_occupancy_past_30);
    marketOccupancy = extractPercentage(listing.market_adjusted_occupancy_past_30);
  } else if (timeframe === 90) {
    propertyOccupancy = extractPercentage(listing.adjusted_occupancy_past_90);
    marketOccupancy = extractPercentage(listing.market_adjusted_occupancy_past_90);
  } else {
    // For other timeframes, use the 30-day data as approximation
    propertyOccupancy = extractPercentage(listing.adjusted_occupancy_past_30);
    marketOccupancy = extractPercentage(listing.market_adjusted_occupancy_past_30);
  }
  
  if (marketOccupancy === 0) return 0;
  return (propertyOccupancy / marketOccupancy) * 100;
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
export function calculateMPISummaries(
  listingsData: ListingsData, 
  neighborhoodData: NeighborhoodData,
  grouping: string = 'city'
): {
  summaries: MPISummary[];
  calculatedMPIs: CalculatedMPI[];
  calculationStats: {
    existingMPIUsed: number;
    neighborhoodCalculated: number;
    fallbackUsed: number;
    totalListings: number;
  };
} {
  let existingMPIUsed = 0;
  let neighborhoodCalculated = 0;
  let fallbackUsed = 0;
  
  const calculatedMPIs = listingsData.listings.map(listing => {
    const mpi = calculateListingMPI(listing, neighborhoodData);
    
    // Count calculation methods used
    const timeframes: Timeframe[] = [7, 30, 60, 90, 120];
    timeframes.forEach(timeframe => {
      const mpiField = `mpi_next_${timeframe}` as keyof Listing;
      const existingMPI = listing[mpiField] as number;
      
      if (existingMPI !== undefined && existingMPI !== null && existingMPI > 0) {
        existingMPIUsed++;
      } else {
        // Check if neighborhood calculation was used
        const categoryId = matchListingToNeighborhood(listing, neighborhoodData);
        if (categoryId) {
          const dateRange = getDateRangeForTimeframe(timeframe);
          const marketOccupancy = calculateMarketOccupancy(neighborhoodData, categoryId, dateRange.start, dateRange.end);
          if (marketOccupancy > 0) {
            neighborhoodCalculated++;
          } else {
            fallbackUsed++;
          }
        } else {
          fallbackUsed++;
        }
      }
    });
    
    return mpi;
  });
  
  const summaries = calculateGroupAverages(calculatedMPIs, grouping, listingsData);
  
  return { 
    summaries, 
    calculatedMPIs,
    calculationStats: {
      existingMPIUsed,
      neighborhoodCalculated,
      fallbackUsed,
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
