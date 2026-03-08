import {
  Listing,
  ListingsData,
  MPISummary,
  CalculatedMPI,
  MPIComparison,
  MPISummaryComparison,
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
 * MPI Scaling Factor
 * 
 * The PriceLabs API returns MPI values in the range 0-2 (e.g., 1.73):
 * - 0.0 = 0% of market average (no occupancy)
 * - 1.0 = 100% of market average (at market)
 * - 2.0 = 200% of market average (double the market)
 * 
 * For display purposes, we multiply by 100 to convert to 0-200 range:
 * - 0 = 0% of market average
 * - 100 = 100% of market average (at market)
 * - 200 = 200% of market average
 * 
 * This makes the values more intuitive for users (173 instead of 1.73).
 */
const MPI_SCALE_FACTOR = 100;

/**
 * Calculate date range for a given timeframe (FUTURE-looking from today)
 * 
 * Returns an inclusive date range [start, end] covering exactly N days.
 * For example, a 7-day range from March 8 includes: Mar 8, 9, 10, 11, 12, 13, 14 (7 days total)
 */
function getDateRangeForTimeframe(timeframe: Timeframe): { start: Date; end: Date } {
  const today = new Date();
  console.log(`📅 Today's date: ${today.toISOString().split('T')[0]}`);
  
  const start = new Date(today); // Start from today (day 1)
  const end = new Date(today);
  
  // For an N-day range starting today:
  // - Day 1 is today (start)
  // - Day N is today + (N-1) days (end)
  // This creates an inclusive range covering exactly N days
  switch (timeframe) {
    case 7:
      end.setDate(start.getDate() + 6); // Today + 6 more days = 7 days total
      break;
    case 30:
      end.setDate(start.getDate() + 29); // Today + 29 more days = 30 days total
      break;
    case 60:
      end.setDate(start.getDate() + 59); // Today + 59 more days = 60 days total
      break;
    case 90:
      end.setDate(start.getDate() + 89); // Today + 89 more days = 90 days total
      break;
    case 120:
      end.setDate(start.getDate() + 119); // Today + 119 more days = 120 days total
      break;
  }
  
  console.log(`📅 ${timeframe}-day range: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);
  
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
 * @param listing - The listing to calculate MPI for
 * @param sharedNeighborhoodData - Optional pre-loaded neighborhood data to avoid redundant API calls
 */
async function calculateListingMPI(
  listing: Listing,
  sharedNeighborhoodData?: NeighborhoodData | null
): Promise<CalculatedMPI> {
  const getMPI = async (timeframe: Timeframe): Promise<number> => {
    const mpiField = `mpi_next_${timeframe}` as keyof Listing;
    const existingMPI = listing[mpiField] as number;
    
    // Priority 1: Use API MPI if available (including 0 as valid value)
    // API returns MPI in 0-2 range, multiply by MPI_SCALE_FACTOR to convert to 0-200 display range
    if (existingMPI !== undefined && existingMPI !== null) {
      const scaledMPI = existingMPI * MPI_SCALE_FACTOR;
      console.log(`📊 Using API MPI for ${timeframe}-day (listing ${listing.id}): ${scaledMPI.toFixed(2)}`);
      return scaledMPI;
    }
    
    // Priority 2: Calculate from neighborhood data if API value missing
    console.log(`🔄 API MPI not available for ${timeframe}-day (listing ${listing.id}), calculating from neighborhood data...`);
    
    try {
      const dateRange = getDateRangeForTimeframe(timeframe);
      
      // Use shared neighborhood data if provided, otherwise load for this specific listing
      const neighborhoodData = sharedNeighborhoodData ?? await loadNeighborhoodData(listing.id);
      
      // Match listing to neighborhood category
      const categoryId = matchListingToNeighborhood(listing, neighborhoodData);
      if (categoryId) {
        // Calculate property occupancy
        const propertyOccupancy = calculatePropertyOccupancy(listing, dateRange.start, dateRange.end);
        
        // Calculate market occupancy from real neighborhood data
        const marketOccupancy = calculateMarketOccupancy(neighborhoodData, categoryId, dateRange.start, dateRange.end);
        
        // Validate market occupancy to prevent division by zero
        if (marketOccupancy === 0) {
          console.warn(`⚠️ Market occupancy is zero for ${timeframe}-day (listing ${listing.id}), cannot calculate MPI`);
          return 0;
        }
        
        // Calculate MPI: (property_occupancy / market_occupancy) * 100
        // Note: Result is already in 0-200 range (same scale as API values after MPI_SCALE_FACTOR)
        if (marketOccupancy > 0) {
          const calculatedMPI = (propertyOccupancy / marketOccupancy) * MPI_SCALE_FACTOR;
          console.log(`✅ Calculated MPI ${timeframe}-day from neighborhood data for listing ${listing.id}: ${calculatedMPI.toFixed(2)} (property: ${(propertyOccupancy * 100).toFixed(1)}%, market: ${(marketOccupancy * 100).toFixed(1)}%)`);
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
  
  // Validate MPI values are in expected range (0-500 is reasonable, >500 suggests data issue)
  const validateMPI = (value: number, timeframe: Timeframe) => {
    if (value < 0 || value > 500) {
      console.warn(`⚠️ MPI value out of expected range for ${timeframe}-day (listing ${listing.id}): ${value.toFixed(2)} (expected 0-500)`);
    }
  };
  
  validateMPI(mpi_7, 7);
  validateMPI(mpi_30, 30);
  validateMPI(mpi_60, 60);
  validateMPI(mpi_90, 90);
  validateMPI(mpi_120, 120);
  
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
 * Calculate MPI using neighborhood data (simplified version using shared neighborhood data)
 */
function calculateListingMPIFromNeighborhood(listing: Listing, neighborhoodData: NeighborhoodData): CalculatedMPI {
  const getMPIFromNeighborhood = (timeframe: Timeframe): number => {
    try {
      const dateRange = getDateRangeForTimeframe(timeframe);
      
      // Match listing to neighborhood category
      const categoryId = matchListingToNeighborhood(listing, neighborhoodData);
      if (categoryId) {
        // Calculate property occupancy
        const propertyOccupancy = calculatePropertyOccupancy(listing, dateRange.start, dateRange.end);
        
        // Calculate market occupancy from real neighborhood data
        const marketOccupancy = calculateMarketOccupancy(neighborhoodData, categoryId, dateRange.start, dateRange.end);
        
        // Calculate MPI: (property_occupancy / market_occupancy) * 100
        // Note: Result is already in 0-200 range (same scale as API values after MPI_SCALE_FACTOR)
        if (marketOccupancy > 0) {
          const calculatedMPI = (propertyOccupancy / marketOccupancy) * MPI_SCALE_FACTOR;
          console.log(`✅ Calculated MPI ${timeframe}-day for listing ${listing.id}: ${calculatedMPI.toFixed(2)} (property: ${(propertyOccupancy * 100).toFixed(1)}%, market: ${(marketOccupancy * 100).toFixed(1)}%)`);
          return calculatedMPI;
        }
      }
    } catch (error) {
      console.log(`❌ Failed to calculate MPI ${timeframe}-day using neighborhood data for listing ${listing.id}:`, error);
    }
    
    return 0;
  };

  const mpi_7 = getMPIFromNeighborhood(7);
  const mpi_30 = getMPIFromNeighborhood(30);
  const mpi_60 = getMPIFromNeighborhood(60);
  const mpi_90 = getMPIFromNeighborhood(90);
  const mpi_120 = getMPIFromNeighborhood(120);

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
 * Calculate MPI comparison between API values and neighborhood calculations
 */
function calculateListingMPIComparison(listing: Listing, neighborhoodData: NeighborhoodData): MPIComparison {
  // Get API MPI values and scale by MPI_SCALE_FACTOR to convert to 0-200 display range
  const api_mpi_7 = (listing.mpi_next_7 ?? 0) * MPI_SCALE_FACTOR;
  const api_mpi_30 = (listing.mpi_next_30 ?? 0) * MPI_SCALE_FACTOR;
  const api_mpi_60 = (listing.mpi_next_60 ?? 0) * MPI_SCALE_FACTOR;
  const api_mpi_90 = (listing.mpi_next_90 ?? 0) * MPI_SCALE_FACTOR;
  const api_mpi_120 = (listing.mpi_next_120 ?? 0) * MPI_SCALE_FACTOR;

  // Calculate MPI from neighborhood data
  const calculated = calculateListingMPIFromNeighborhood(listing, neighborhoodData);

  // Determine calculation methods
  const getCalculationMethod = (apiValue: number, calculatedValue: number): 'api' | 'neighborhood' | 'none' => {
    if (apiValue !== undefined && apiValue !== null && apiValue >= 0) return 'api';
    if (calculatedValue > 0) return 'neighborhood';
    return 'none';
  };

  return {
    listingId: listing.id,
    group: listing.group || 'Unknown',
    api_mpi_7,
    api_mpi_30,
    api_mpi_60,
    api_mpi_90,
    api_mpi_120,
    calculated_mpi_7: calculated.mpi_7,
    calculated_mpi_30: calculated.mpi_30,
    calculated_mpi_60: calculated.mpi_60,
    calculated_mpi_90: calculated.mpi_90,
    calculated_mpi_120: calculated.mpi_120,
    calculation_method_7: getCalculationMethod(api_mpi_7, calculated.mpi_7),
    calculation_method_30: getCalculationMethod(api_mpi_30, calculated.mpi_30),
    calculation_method_60: getCalculationMethod(api_mpi_60, calculated.mpi_60),
    calculation_method_90: getCalculationMethod(api_mpi_90, calculated.mpi_90),
    calculation_method_120: getCalculationMethod(api_mpi_120, calculated.mpi_120),
  };
}

/**
 * Calculate group averages for comparison data
 */
function calculateGroupAveragesComparison(comparisons: MPIComparison[], grouping: string, listingsData: ListingsData): MPISummaryComparison[] {
  const groupMap = new Map<string, MPIComparison[]>();
  
  comparisons.forEach(comparison => {
    // Find the original listing to get the grouping data
    const originalListing = listingsData.listings.find(listing => listing.id === comparison.listingId);
    if (originalListing) {
      const groupKey = getGroupKey(originalListing, grouping);
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(comparison);
    }
  });
  
  const summaries: MPISummaryComparison[] = [];
  groupMap.forEach((comparisons, groupName) => {
    const count = comparisons.length;
    
    const api_mpi_7 = comparisons.reduce((sum, comp) => sum + comp.api_mpi_7, 0) / count;
    const api_mpi_30 = comparisons.reduce((sum, comp) => sum + comp.api_mpi_30, 0) / count;
    const api_mpi_60 = comparisons.reduce((sum, comp) => sum + comp.api_mpi_60, 0) / count;
    const api_mpi_90 = comparisons.reduce((sum, comp) => sum + comp.api_mpi_90, 0) / count;
    const api_mpi_120 = comparisons.reduce((sum, comp) => sum + comp.api_mpi_120, 0) / count;
    
    const calculated_mpi_7 = comparisons.reduce((sum, comp) => sum + comp.calculated_mpi_7, 0) / count;
    const calculated_mpi_30 = comparisons.reduce((sum, comp) => sum + comp.calculated_mpi_30, 0) / count;
    const calculated_mpi_60 = comparisons.reduce((sum, comp) => sum + comp.calculated_mpi_60, 0) / count;
    const calculated_mpi_90 = comparisons.reduce((sum, comp) => sum + comp.calculated_mpi_90, 0) / count;
    const calculated_mpi_120 = comparisons.reduce((sum, comp) => sum + comp.calculated_mpi_120, 0) / count;
    
    summaries.push({
      group: groupName,
      api_mpi_7: Math.round(api_mpi_7 * 100) / 100,
      api_mpi_30: Math.round(api_mpi_30 * 100) / 100,
      api_mpi_60: Math.round(api_mpi_60 * 100) / 100,
      api_mpi_90: Math.round(api_mpi_90 * 100) / 100,
      api_mpi_120: Math.round(api_mpi_120 * 100) / 100,
      calculated_mpi_7: Math.round(calculated_mpi_7 * 100) / 100,
      calculated_mpi_30: Math.round(calculated_mpi_30 * 100) / 100,
      calculated_mpi_60: Math.round(calculated_mpi_60 * 100) / 100,
      calculated_mpi_90: Math.round(calculated_mpi_90 * 100) / 100,
      calculated_mpi_120: Math.round(calculated_mpi_120 * 100) / 100,
      listingCount: count,
    });
  });
  return summaries.sort((a, b) => a.group.localeCompare(b.group));
}

/**
 * Main function to calculate MPI comparisons
 */
export async function calculateMPIComparisons(
  listingsData: ListingsData, 
  grouping: string = 'city'
): Promise<{
  summaries: MPISummaryComparison[];
  comparisons: MPIComparison[];
}> {
  console.log(`Starting MPI comparison calculations for ${listingsData.listings.length} listings...`);
  
  // Load shared neighborhood data once
  const { loadNeighborhoodData } = await import('./data-loader');
  let neighborhoodData;
  try {
    // Use a sample listing ID for shared neighborhood data
    neighborhoodData = await loadNeighborhoodData(listingsData.listings[0]?.id || '90587');
  } catch (error) {
    console.log('Failed to load neighborhood data for comparison:', error);
    // Use empty neighborhood data as fallback
    neighborhoodData = {
      data: {
        "Listings Used": 0,
        currency: "USD",
        lat: 0,
        lng: 0,
        source: "fallback",
        "Market KPI": {
          Category: {}
        },
        "Future Percentile Prices": {
          Category: {}
        },
        "Future Occ/New/Canc": {
          Category: {}
        }
      }
    };
  }
  
  const comparisons = listingsData.listings.map((listing) => {
    return calculateListingMPIComparison(listing, neighborhoodData);
  });
  
  const summaries = calculateGroupAveragesComparison(comparisons, grouping, listingsData);
  
  console.log(`✅ Completed MPI comparison calculations for ${summaries.length} groups`);
  
  return { 
    summaries, 
    comparisons
  };
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
  
  // Optimization: Load neighborhood data once and share across all listings
  // This reduces API calls from N (one per listing) to 1 (shared for all)
  let sharedNeighborhoodData: NeighborhoodData | null = null;
  
  if (listingsData.listings.length > 0) {
    try {
      // Use first listing's ID to load shared neighborhood data
      const firstListingId = listingsData.listings[0].id;
      console.log(`🔄 Loading shared neighborhood data using listing ${firstListingId}...`);
      sharedNeighborhoodData = await loadNeighborhoodData(firstListingId);
      console.log(`✅ Shared neighborhood data loaded successfully, will be reused for all ${listingsData.listings.length} listings`);
    } catch (error) {
      console.warn(`⚠️ Failed to load shared neighborhood data:`, error);
      console.log(`📝 Will fall back to per-listing neighborhood data loading if needed`);
    }
  }
  
  const calculatedMPIs = await Promise.all(
    listingsData.listings.map(async (listing) => {
      const mpi = await calculateListingMPI(listing, sharedNeighborhoodData);
      
      // Count calculation methods used PER LISTING (not per timeframe)
      // Check if this listing used API values, neighborhood calculation, or had no data
      const timeframes: Timeframe[] = [7, 30, 60, 90, 120];
      
      let hasAnyAPIValue = false;
      let hasAnyNeighborhoodValue = false;
      let hasAnyData = false;
      
      // Check each timeframe to determine the primary calculation method for this listing
      timeframes.forEach(timeframe => {
        const mpiField = `mpi_next_${timeframe}` as keyof Listing;
        const existingMPI = listing[mpiField] as number;
        
        if (existingMPI !== undefined && existingMPI !== null) {
          hasAnyAPIValue = true;
          hasAnyData = true;
        }
        
        // Check if we calculated from neighborhood data
        // (In practice, if API value exists, we use it; otherwise we calculate)
        if (existingMPI === undefined || existingMPI === null) {
          // Would have used neighborhood calculation
          hasAnyNeighborhoodValue = true;
          hasAnyData = true;
        }
      });
      
      // Increment counters ONCE per listing based on primary method
      if (hasAnyAPIValue) {
        existingMPIUsed++;
      } else if (hasAnyNeighborhoodValue) {
        neighborhoodCalculated++;
      } else if (!hasAnyData) {
        noDataAvailable++;
      }
      
      return mpi;
    })
  );
  
  const summaries = calculateGroupAverages(calculatedMPIs, grouping, listingsData);
  
  console.log(`✅ Completed MPI calculations:`);
  console.log(`  - Listings using existing API MPI: ${existingMPIUsed}`);
  console.log(`  - Listings using neighborhood calculation: ${neighborhoodCalculated}`);
  console.log(`  - Listings with no data available: ${noDataAvailable}`);
  console.log(`  - Total listings processed: ${listingsData.listings.length}`);
  console.log(`  - Verification: ${existingMPIUsed + neighborhoodCalculated + noDataAvailable} listings accounted for`);
  
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
