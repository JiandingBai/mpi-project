import {
  Listing,
  ListingsData,
  MPISummary,
  CalculatedMPI,
  Timeframe,
  NeighborhoodData
} from '../../types';
import { OccupancyCalculator } from './OccupancyCalculator';

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
 */
const MPI_SCALE_FACTOR = 100;

/**
 * MPICalculator handles all MPI calculation logic
 * Uses OccupancyCalculator for occupancy calculations (dependency injection)
 */
export class MPICalculator {
  private occupancyCalculator: OccupancyCalculator;

  constructor(occupancyCalculator: OccupancyCalculator) {
    this.occupancyCalculator = occupancyCalculator;
  }

  /**
   * Calculate date range for a given timeframe (FUTURE-looking from today)
   * Returns an inclusive date range [start, end] covering exactly N days
   */
  getDateRangeForTimeframe(timeframe: Timeframe): { start: Date; end: Date } {
    const today = new Date();
    console.log(`📅 Today's date: ${today.toISOString().split('T')[0]}`);

    const start = new Date(today);
    const end = new Date(today);

    // For an N-day range starting today:
    // - Day 1 is today (start)
    // - Day N is today + (N-1) days (end)
    switch (timeframe) {
      case 7:
        end.setDate(start.getDate() + 6);
        break;
      case 30:
        end.setDate(start.getDate() + 29);
        break;
      case 60:
        end.setDate(start.getDate() + 59);
        break;
      case 90:
        end.setDate(start.getDate() + 89);
        break;
      case 120:
        end.setDate(start.getDate() + 119);
        break;
    }

    console.log(`📅 ${timeframe}-day range: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);

    return { start, end };
  }

  /**
   * Calculate MPI for a single listing for all timeframes
   */
  async calculateAllMPIs(
    listing: Listing,
    neighborhoodData: NeighborhoodData
  ): Promise<CalculatedMPI> {
    const getMPI = (timeframe: Timeframe): number => {
      const mpiField = `mpi_next_${timeframe}` as keyof Listing;
      const existingMPI = listing[mpiField] as number;

      // Priority 1: Use API MPI if available (including 0 as valid value)
      if (existingMPI !== undefined && existingMPI !== null) {
        const scaledMPI = existingMPI * MPI_SCALE_FACTOR;
        console.log(`📊 Using API MPI for ${timeframe}-day (listing ${listing.id}): ${scaledMPI.toFixed(2)}`);
        return scaledMPI;
      }

      // Priority 2: Calculate from neighborhood data
      console.log(`🔄 API MPI not available for ${timeframe}-day (listing ${listing.id}), calculating from neighborhood data...`);

      try {
        const dateRange = this.getDateRangeForTimeframe(timeframe);

        // Match listing to neighborhood category
        const categoryId = this.occupancyCalculator.matchListingToCategory(listing, neighborhoodData);
        if (categoryId) {
          // Calculate property occupancy
          const propertyOccupancy = this.occupancyCalculator.calculatePropertyOccupancy(
            listing,
            dateRange.start,
            dateRange.end
          );

          // Calculate market occupancy
          const marketOccupancy = this.occupancyCalculator.calculateMarketOccupancy(
            neighborhoodData,
            categoryId,
            dateRange.start,
            dateRange.end
          );

          // Validate market occupancy to prevent division by zero
          if (marketOccupancy === 0) {
            console.warn(`⚠️ Market occupancy is zero for ${timeframe}-day (listing ${listing.id}), cannot calculate MPI`);
            return 0;
          }

          // Calculate MPI: (property_occupancy / market_occupancy) * 100
          const calculatedMPI = (propertyOccupancy / marketOccupancy) * MPI_SCALE_FACTOR;
          console.log(`✅ Calculated MPI ${timeframe}-day for listing ${listing.id}: ${calculatedMPI.toFixed(2)}`);
          return calculatedMPI;
        }
      } catch (error) {
        console.log(`❌ Failed to calculate MPI ${timeframe}-day for listing ${listing.id}:`, error);
      }

      return 0;
    };

    const mpi_7 = getMPI(7);
    const mpi_30 = getMPI(30);
    const mpi_60 = getMPI(60);
    const mpi_90 = getMPI(90);
    const mpi_120 = getMPI(120);

    // Validate MPI values
    this.validateMPI(mpi_7, 7, listing.id);
    this.validateMPI(mpi_30, 30, listing.id);
    this.validateMPI(mpi_60, 60, listing.id);
    this.validateMPI(mpi_90, 90, listing.id);
    this.validateMPI(mpi_120, 120, listing.id);

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
   * Calculate group averages from individual MPI calculations
   */
  calculateGroupAverages(
    calculatedMPIs: CalculatedMPI[],
    grouping: string,
    listingsData: ListingsData
  ): MPISummary[] {
    const groupMap = new Map<string, CalculatedMPI[]>();

    calculatedMPIs.forEach(mpi => {
      const originalListing = listingsData.listings.find(listing => listing.id === mpi.listingId);
      if (originalListing) {
        const groupKey = this.getGroupKey(originalListing, grouping);
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
   * Get grouping key for a listing
   */
  private getGroupKey(listing: Listing, grouping: string): string {
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
   * Validate MPI value is in expected range
   */
  private validateMPI(value: number, timeframe: Timeframe, listingId: string): void {
    if (value < 0 || value > 500) {
      console.warn(`⚠️ MPI value out of expected range for ${timeframe}-day (listing ${listingId}): ${value.toFixed(2)} (expected 0-500)`);
    }
  }
}
