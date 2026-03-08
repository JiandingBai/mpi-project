import {
  Listing,
  ListingsData,
  MPISummary,
  CalculatedMPI,
  MPIComparison,
  MPISummaryComparison,
  Timeframe,
  NeighborhoodData,
  ReservationsData
} from '../types';
import { initializeDatabase } from './database/init';
import { DataRepository } from './classes/DataRepository';
import { OccupancyCalculator } from './classes/OccupancyCalculator';
import { MPICalculator } from './classes/MPICalculator';

// Initialize database (in-memory for now, can be file-based in production)
const db = initializeDatabase(':memory:');
const dataRepository = new DataRepository(db);
const occupancyCalculator = new OccupancyCalculator();
const mpiCalculator = new MPICalculator(occupancyCalculator);

/**
 * Main function to process listings and calculate MPI summaries
 * This is the public API - maintains backward compatibility
 */
export async function calculateMPISummaries(
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
  // Load listings using DataRepository (with fallback strategy)
  const listingsData = await dataRepository.loadListings();
  
  console.log(`Starting MPI calculations for ${listingsData.listings.length} listings...`);
  
  // Load shared neighborhood data once (optimization)
  let sharedNeighborhoodData: NeighborhoodData | null = null;
  if (listingsData.listings.length > 0) {
    try {
      const firstListingId = listingsData.listings[0].id;
      console.log(`🔄 Loading shared neighborhood data using listing ${firstListingId}...`);
      sharedNeighborhoodData = await dataRepository.loadNeighborhood(firstListingId);
      console.log(`✅ Shared neighborhood data loaded successfully, will be reused for all ${listingsData.listings.length} listings`);
    } catch (error) {
      console.warn(`⚠️ Failed to load shared neighborhood data:`, error);
    }
  }
  
  // Calculate MPIs for all listings
  const calculatedMPIs: CalculatedMPI[] = [];
  for (const listing of listingsData.listings) {
    const neighborhoodData = sharedNeighborhoodData || await dataRepository.loadNeighborhood(listing.id);
    
    // Load reservations data for future occupancy calculation (with fallback to historical)
    const reservationsData = await dataRepository.loadReservations(listing.id);
    
    const mpi = await mpiCalculator.calculateAllMPIs(listing, neighborhoodData, reservationsData);
    calculatedMPIs.push(mpi);
  }
  
  // Calculate group averages
  const summaries = mpiCalculator.calculateGroupAverages(calculatedMPIs, grouping, listingsData);
  
  // Calculate statistics
  let existingMPIUsed = 0;
  let neighborhoodCalculated = 0;
  let noDataAvailable = 0;
  
  listingsData.listings.forEach(listing => {
    const timeframes: Timeframe[] = [7, 30, 60, 90, 120];
    let hasAnyAPIValue = false;
    let hasAnyNeighborhoodValue = false;
    let hasAnyData = false;
    
    timeframes.forEach(timeframe => {
      const mpiField = `mpi_next_${timeframe}` as keyof Listing;
      const existingMPI = listing[mpiField] as number;
      
      if (existingMPI !== undefined && existingMPI !== null) {
        hasAnyAPIValue = true;
        hasAnyData = true;
      } else {
        hasAnyNeighborhoodValue = true;
        hasAnyData = true;
      }
    });
    
    if (hasAnyAPIValue) {
      existingMPIUsed++;
    } else if (hasAnyNeighborhoodValue) {
      neighborhoodCalculated++;
    } else if (!hasAnyData) {
      noDataAvailable++;
    }
  });
  
  console.log(`✅ Completed MPI calculations:`);
  console.log(`  - Listings using existing API MPI: ${existingMPIUsed}`);
  console.log(`  - Listings using neighborhood calculation: ${neighborhoodCalculated}`);
  console.log(`  - Listings with no data available: ${noDataAvailable}`);
  console.log(`  - Total listings processed: ${listingsData.listings.length}`);
  
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
 * Calculate MPI comparisons showing API values vs our calculations
 * This allows comparing PriceLabs API MPI with our neighborhood-based calculations
 */
export async function calculateMPIComparisons(
  grouping: string = 'city'
): Promise<{
  summaries: MPISummaryComparison[];
  comparisons: MPIComparison[];
}> {
  // Load listings using DataRepository (with fallback strategy)
  const listingsData = await dataRepository.loadListings();
  
  console.log(`Starting MPI comparison calculations for ${listingsData.listings.length} listings...`);
  
  // Load shared neighborhood data once (optimization)
  let sharedNeighborhoodData: NeighborhoodData | null = null;
  if (listingsData.listings.length > 0) {
    try {
      const firstListingId = listingsData.listings[0].id;
      console.log(`🔄 Loading shared neighborhood data using listing ${firstListingId}...`);
      sharedNeighborhoodData = await dataRepository.loadNeighborhood(firstListingId);
      console.log(`✅ Shared neighborhood data loaded successfully`);
    } catch (error) {
      console.warn(`⚠️ Failed to load shared neighborhood data:`, error);
    }
  }
  
  // Calculate comparisons for all listings
  const comparisons: MPIComparison[] = [];
  for (const listing of listingsData.listings) {
    const neighborhoodData = sharedNeighborhoodData || await dataRepository.loadNeighborhood(listing.id);
    
    // Load reservations data for future occupancy calculation
    const reservationsData = await dataRepository.loadReservations(listing.id);
    
    // Get API MPI values (raw from PriceLabs, scaled by 100)
    const api_mpi_7 = (listing.mpi_next_7 ?? 0) * MPI_SCALE_FACTOR;
    const api_mpi_30 = (listing.mpi_next_30 ?? 0) * MPI_SCALE_FACTOR;
    const api_mpi_60 = (listing.mpi_next_60 ?? 0) * MPI_SCALE_FACTOR;
    const api_mpi_90 = (listing.mpi_next_90 ?? 0) * MPI_SCALE_FACTOR;
    const api_mpi_120 = (listing.mpi_next_120 ?? 0) * MPI_SCALE_FACTOR;
    
    // Calculate MPI using neighborhood data (force calculation even if API values exist)
    const calculated_mpi_7 = calculateMPIFromNeighborhood(listing, neighborhoodData, 7, reservationsData);
    const calculated_mpi_30 = calculateMPIFromNeighborhood(listing, neighborhoodData, 30, reservationsData);
    const calculated_mpi_60 = calculateMPIFromNeighborhood(listing, neighborhoodData, 60, reservationsData);
    const calculated_mpi_90 = calculateMPIFromNeighborhood(listing, neighborhoodData, 90, reservationsData);
    const calculated_mpi_120 = calculateMPIFromNeighborhood(listing, neighborhoodData, 120, reservationsData);
    
    comparisons.push({
      listingId: listing.id,
      group: listing.group || 'Unknown',
      api_mpi_7,
      api_mpi_30,
      api_mpi_60,
      api_mpi_90,
      api_mpi_120,
      calculated_mpi_7,
      calculated_mpi_30,
      calculated_mpi_60,
      calculated_mpi_90,
      calculated_mpi_120,
      calculation_method_7: api_mpi_7 > 0 ? 'api' : 'neighborhood',
      calculation_method_30: api_mpi_30 > 0 ? 'api' : 'neighborhood',
      calculation_method_60: api_mpi_60 > 0 ? 'api' : 'neighborhood',
      calculation_method_90: api_mpi_90 > 0 ? 'api' : 'neighborhood',
      calculation_method_120: api_mpi_120 > 0 ? 'api' : 'neighborhood',
    });
  }
  
  // Calculate group averages for both API and calculated values
  const summaries = calculateComparisonGroupAverages(comparisons, grouping, listingsData);
  
  console.log(`✅ Completed MPI comparison calculations for ${comparisons.length} listings`);
  
  return {
    summaries,
    comparisons
  };
}

/**
 * Calculate MPI from neighborhood data (helper for comparison mode)
 */
function calculateMPIFromNeighborhood(
  listing: Listing,
  neighborhoodData: NeighborhoodData,
  timeframe: Timeframe,
  reservationsData?: ReservationsData | null
): number {
  try {
    const dateRange = mpiCalculator.getDateRangeForTimeframe(timeframe);
    
    // Match listing to neighborhood category
    const categoryId = occupancyCalculator.matchListingToCategory(listing, neighborhoodData);
    if (!categoryId) {
      return 0;
    }
    
    // Calculate property occupancy (with reservations data if available)
    const propertyOccupancy = occupancyCalculator.calculatePropertyOccupancy(
      listing,
      dateRange.start,
      dateRange.end,
      reservationsData
    );
    
    // Calculate market occupancy
    const marketOccupancy = occupancyCalculator.calculateMarketOccupancy(
      neighborhoodData,
      categoryId,
      dateRange.start,
      dateRange.end
    );
    
    // Validate market occupancy to prevent division by zero
    if (marketOccupancy === 0) {
      return 0;
    }
    
    // Calculate MPI: (property_occupancy / market_occupancy) * 100
    const calculatedMPI = (propertyOccupancy / marketOccupancy) * MPI_SCALE_FACTOR;
    return calculatedMPI;
  } catch (error) {
    console.log(`❌ Failed to calculate MPI ${timeframe}-day for listing ${listing.id}:`, error);
    return 0;
  }
}

/**
 * Calculate group averages for comparison data
 */
function calculateComparisonGroupAverages(
  comparisons: MPIComparison[],
  grouping: string,
  listingsData: ListingsData
): MPISummaryComparison[] {
  const groupMap = new Map<string, MPIComparison[]>();
  
  comparisons.forEach(comparison => {
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
    
    // Average API MPI values
    const api_mpi_7 = comparisons.reduce((sum, c) => sum + c.api_mpi_7, 0) / count;
    const api_mpi_30 = comparisons.reduce((sum, c) => sum + c.api_mpi_30, 0) / count;
    const api_mpi_60 = comparisons.reduce((sum, c) => sum + c.api_mpi_60, 0) / count;
    const api_mpi_90 = comparisons.reduce((sum, c) => sum + c.api_mpi_90, 0) / count;
    const api_mpi_120 = comparisons.reduce((sum, c) => sum + c.api_mpi_120, 0) / count;
    
    // Average calculated MPI values
    const calculated_mpi_7 = comparisons.reduce((sum, c) => sum + c.calculated_mpi_7, 0) / count;
    const calculated_mpi_30 = comparisons.reduce((sum, c) => sum + c.calculated_mpi_30, 0) / count;
    const calculated_mpi_60 = comparisons.reduce((sum, c) => sum + c.calculated_mpi_60, 0) / count;
    const calculated_mpi_90 = comparisons.reduce((sum, c) => sum + c.calculated_mpi_90, 0) / count;
    const calculated_mpi_120 = comparisons.reduce((sum, c) => sum + c.calculated_mpi_120, 0) / count;
    
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
 * Get grouping key for a listing (helper function)
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

// MPI Scaling Factor constant (used in comparison calculations)
const MPI_SCALE_FACTOR = 100;

/**
 * Log MPI summaries to console
 */
export function logMPISummaries(summaries: MPISummary[]): void {
  console.table(
    summaries.map(s => ({
      Group: s.group,
      '7-day': s.mpi_7.toFixed(2),
      '30-day': s.mpi_30.toFixed(2),
      '60-day': s.mpi_60.toFixed(2),
      '90-day': s.mpi_90.toFixed(2),
      '120-day': s.mpi_120.toFixed(2),
      Listings: s.listingCount
    }))
  );
}
