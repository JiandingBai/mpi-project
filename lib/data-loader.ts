import { ListingsData, NeighborhoodData } from '../types';
import { initializeDatabase } from './database/init';
import { DataRepository } from './classes/DataRepository';
import { OccupancyCalculator } from './classes/OccupancyCalculator';

// Initialize database and repository
const db = initializeDatabase(':memory:');
const dataRepository = new DataRepository(db);
const occupancyCalculator = new OccupancyCalculator();

/**
 * Load listings data from PriceLabs API with fallback to database and local files
 * This is the public API - maintains backward compatibility
 */
export async function loadListingsData(): Promise<ListingsData> {
  return dataRepository.loadListings();
}

/**
 * Load neighborhood data from PriceLabs API for a specific listing
 * This is the public API - maintains backward compatibility
 */
export async function loadNeighborhoodData(listingId: string): Promise<NeighborhoodData> {
  return dataRepository.loadNeighborhood(listingId);
}

/**
 * Legacy function exports for backward compatibility
 * These delegate to the OccupancyCalculator class
 */
export function matchListingToNeighborhood(listing: any, neighborhoodData: NeighborhoodData): string | null {
  return occupancyCalculator.matchListingToNeighborhood(listing, neighborhoodData);
}

export function calculateMarketOccupancy(
  neighborhoodData: NeighborhoodData,
  categoryId: string,
  startDate: Date,
  endDate: Date
): number {
  return occupancyCalculator.calculateMarketOccupancy(neighborhoodData, categoryId, startDate, endDate);
}

export function calculatePropertyOccupancy(listing: any, startDate: Date, endDate: Date): number {
  return occupancyCalculator.calculatePropertyOccupancy(listing, startDate, endDate);
}
