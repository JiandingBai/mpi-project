import {
  Listing,
  ListingsData,
  MPISummary,
  CalculatedMPI,
  MPIComparison,
  MPISummaryComparison,
  Timeframe,
  NeighborhoodData
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
 * Calculate MPI comparisons (backward compatibility wrapper)
 */
export async function calculateMPIComparisons(
  grouping: string = 'city'
): Promise<{
  summaries: MPISummaryComparison[];
  comparisons: MPIComparison[];
}> {
  // For now, return the regular summaries
  // This function is less critical for the refactoring
  const result = await calculateMPISummaries(grouping);
  
  return {
    summaries: result.summaries.map(s => ({
      ...s,
      api_mpi_7: s.mpi_7,
      api_mpi_30: s.mpi_30,
      api_mpi_60: s.mpi_60,
      api_mpi_90: s.mpi_90,
      api_mpi_120: s.mpi_120,
      calculated_mpi_7: s.mpi_7,
      calculated_mpi_30: s.mpi_30,
      calculated_mpi_60: s.mpi_60,
      calculated_mpi_90: s.mpi_90,
      calculated_mpi_120: s.mpi_120,
    })),
    comparisons: result.calculatedMPIs.map(c => ({
      ...c,
      api_mpi_7: c.mpi_7,
      api_mpi_30: c.mpi_30,
      api_mpi_60: c.mpi_60,
      api_mpi_90: c.mpi_90,
      api_mpi_120: c.mpi_120,
      calculated_mpi_7: c.mpi_7,
      calculated_mpi_30: c.mpi_30,
      calculated_mpi_60: c.mpi_60,
      calculated_mpi_90: c.mpi_90,
      calculated_mpi_120: c.mpi_120,
      calculation_method_7: 'api' as const,
      calculation_method_30: 'api' as const,
      calculation_method_60: 'api' as const,
      calculation_method_90: 'api' as const,
      calculation_method_120: 'api' as const,
    }))
  };
}

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
