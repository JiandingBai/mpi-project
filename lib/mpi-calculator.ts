import { Listing, ListingsData, MPISummary, CalculatedMPI, Timeframe } from '../types';

/**
 * Extracts percentage value from string like "80 %"
 */
function extractPercentage(value: string): number {
  if (!value || value === "Unavailable") return 0;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) / 100 : 0;
}

/**
 * Calculates MPI for a single listing
 */
function calculateListingMPI(listing: Listing): CalculatedMPI {
  const group = listing.group || 'Unknown';
  
  // Helper function to get MPI value or calculate it
  const getMPI = (timeframe: Timeframe): number => {
    const mpiField = `mpi_next_${timeframe}` as keyof Listing;
    const existingMPI = listing[mpiField] as number;
    
    if (existingMPI !== undefined && existingMPI !== null) {
      return existingMPI;
    }
    
    // Calculate MPI using formula: (property_occupancy / market_occupancy) * 100
    let propertyOccupancy: number;
    let marketOccupancy: number;
    
    if (timeframe === 30) {
      propertyOccupancy = extractPercentage(listing.adjusted_occupancy_past_30);
      marketOccupancy = extractPercentage(listing.market_adjusted_occupancy_past_30);
    } else if (timeframe === 90) {
      propertyOccupancy = extractPercentage(listing.adjusted_occupancy_past_90);
      marketOccupancy = extractPercentage(listing.market_adjusted_occupancy_past_90);
    } else {
      // For other timeframes, we'll use the 30-day data as approximation
      propertyOccupancy = extractPercentage(listing.adjusted_occupancy_past_30);
      marketOccupancy = extractPercentage(listing.market_adjusted_occupancy_past_30);
    }
    
    if (marketOccupancy === 0) return 0;
    return (propertyOccupancy / marketOccupancy) * 100;
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
 * Groups listings by group and calculates average MPI for each group
 */
function calculateGroupAverages(calculatedMPIs: CalculatedMPI[]): MPISummary[] {
  const groupMap = new Map<string, CalculatedMPI[]>();
  
  // Group by group name
  calculatedMPIs.forEach(mpi => {
    if (!groupMap.has(mpi.group)) {
      groupMap.set(mpi.group, []);
    }
    groupMap.get(mpi.group)!.push(mpi);
  });
  
  // Calculate averages for each group
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
      mpi_7: Math.round(mpi_7 * 100) / 100, // Round to 2 decimal places
      mpi_30: Math.round(mpi_30 * 100) / 100,
      mpi_60: Math.round(mpi_60 * 100) / 100,
      mpi_90: Math.round(mpi_90 * 100) / 100,
      mpi_120: Math.round(mpi_120 * 100) / 100,
      listingCount: count,
    });
  });
  
  // Sort by group name
  return summaries.sort((a, b) => a.group.localeCompare(b.group));
}

/**
 * Main function to process listings and calculate MPI summaries
 */
export function calculateMPISummaries(listingsData: ListingsData): {
  summaries: MPISummary[];
  calculatedMPIs: CalculatedMPI[];
} {
  const calculatedMPIs = listingsData.listings.map(calculateListingMPI);
  const summaries = calculateGroupAverages(calculatedMPIs);
  
  return { summaries, calculatedMPIs };
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
