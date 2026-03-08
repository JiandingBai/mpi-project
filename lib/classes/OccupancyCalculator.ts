import { NeighborhoodData } from '../../types';

/**
 * OccupancyCalculator handles all occupancy-related calculations
 * Separates occupancy logic from MPI calculation logic
 */
export class OccupancyCalculator {
  /**
   * Calculate property occupancy for a given date range.
   *
   * LIMITATION: Currently uses historical data as a proxy for future occupancy.
   * Ideally, we would calculate future occupancy from the property's calendar/reservations
   * for the specified date range. However, this data is not currently available in the API response.
   *
   * ASSUMPTION: Recent performance (past 30 days) is a reasonable predictor of near-term future performance.
   * This is a common industry practice when actual future booking data is unavailable.
   *
   * TODO: Enhance this function to use actual future occupancy data when available:
   * - Option 1: Use PriceLabs reservations API if available
   * - Option 2: Calculate from property's booking calendar
   * - Option 3: Use booking_pickup_unique fields to estimate future occupancy
   */
  calculatePropertyOccupancy(
    listing: any,
    startDate: Date,
    endDate: Date
  ): number {
    // Use adjusted_occupancy_past_30 as the best available proxy for future performance
    const historicalOccupancy = this.extractPercentage(listing.adjusted_occupancy_past_30);

    // Log warning to make the limitation visible
    console.log(
      `⚠️ Using historical occupancy (${(historicalOccupancy * 100).toFixed(1)}%) as proxy for future occupancy ` +
      `for listing ${listing.id} (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`
    );

    return historicalOccupancy;
  }

  /**
   * Calculate market occupancy from neighborhood data for a given date range
   */
  calculateMarketOccupancy(
    neighborhoodData: NeighborhoodData,
    categoryId: string,
    startDate: Date,
    endDate: Date
  ): number {
    // Only use Future Occ/New/Canc section for occupancy data
    const category = neighborhoodData.data["Future Occ/New/Canc"]?.Category?.[categoryId];

    if (!category) {
      console.log(`❌ No Future Occ/New/Canc data available for category ${categoryId}`);
      // Try to find any available category
      const allCategories = Object.keys(neighborhoodData.data["Future Occ/New/Canc"]?.Category || {});
      if (allCategories.length > 0) {
        const firstCategory = neighborhoodData.data["Future Occ/New/Canc"].Category[allCategories[0]];
        console.log(`🔄 Using first available category: ${allCategories[0]}`);
        return this.calculateMarketOccupancyFromCategory(firstCategory, startDate, endDate, allCategories[0]);
      }
      return 0;
    }

    console.log(`🔍 Using Future Occ/New/Canc section, category: ${categoryId}`);
    return this.calculateMarketOccupancyFromCategory(category, startDate, endDate, categoryId);
  }

  /**
   * Match listing to neighborhood category
   */
  matchListingToCategory(
    listing: any,
    neighborhoodData: NeighborhoodData
  ): string | null {
    const categories = Object.keys(neighborhoodData.data["Future Occ/New/Canc"]?.Category || {});
    if (categories.length > 0) {
      return categories[0]; // Default to first category
    }
    return null;
  }

  /**
   * Calculate market occupancy from a specific category
   */
  private calculateMarketOccupancyFromCategory(
    category: any,
    startDate: Date,
    endDate: Date,
    categoryId: string
  ): number {
    const { X_values, Y_values } = category;

    const relevantIndices: number[] = [];

    // Check if we have daily data (YYYY-MM-DD format) or monthly data (MMM YYYY format)
    const hasDailyData = X_values.length > 0 && X_values[0].includes('-');

    if (hasDailyData) {
      // Use precise daily data matching
      for (let i = 0; i < X_values.length; i++) {
        const dateStr = X_values[i];
        if (dateStr === "Last 365 Days" || dateStr === "Last 730 Days") continue;

        try {
          // Validate date string before parsing
          if (!dateStr || typeof dateStr !== 'string') {
            console.warn(`⚠️ Invalid date string at index ${i}: ${dateStr}`);
            continue;
          }

          // Use UTC timezone for consistent date handling
          const date = new Date(dateStr + 'T00:00:00Z');

          // Check if parsed date is valid
          if (isNaN(date.getTime())) {
            console.warn(`⚠️ Invalid date parsed from "${dateStr}" at index ${i}`);
            continue;
          }

          if (date >= startDate && date <= endDate) {
            relevantIndices.push(i);
          }
        } catch (error) {
          console.warn(`⚠️ Error parsing date "${dateStr}" at index ${i}:`, error);
          continue;
        }
      }
    } else {
      // Fallback to monthly data matching
      for (let i = 0; i < X_values.length; i++) {
        const monthStr = X_values[i];
        if (monthStr === "Last 365 Days" || monthStr === "Last 730 Days") continue;

        const [month, year] = monthStr.split(' ');
        const monthDate = new Date(`${month} 1, ${year}`);

        // For monthly data, check if the month overlaps with our date range
        const monthEnd = new Date(monthDate);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(monthEnd.getDate() - 1); // Last day of the month

        if (monthDate <= endDate && monthEnd >= startDate) {
          relevantIndices.push(i);
        }
      }
    }

    if (relevantIndices.length === 0) {
      console.warn(`⚠️ No relevant dates found for range ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} in category ${categoryId}`);
      return 0;
    }

    console.log(`🔍 Found ${relevantIndices.length} relevant indices for range ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log(`🔍 Data type: ${hasDailyData ? 'Daily' : 'Monthly'}`);

    // In Future Occ/New/Canc, Y_values[0] should be occupancy data
    const occupancyYIndex = 0;

    let totalOccupancy = 0;
    let count = 0;

    // Process all relevant indices for calculation
    for (let i = 0; i < relevantIndices.length; i++) {
      const index = relevantIndices[i];

      let occupancyValue;

      // Handle nested structure in Future Occ/New/Canc
      if (Y_values[occupancyYIndex] && Array.isArray(Y_values[occupancyYIndex][0])) {
        // Nested structure: Y_values[0][0][index]
        const nestedArray = Y_values[occupancyYIndex][0] as unknown as number[];
        occupancyValue = nestedArray?.[index];
      } else {
        // Direct array structure: Y_values[0][index]
        occupancyValue = Y_values[occupancyYIndex]?.[index];
      }

      if (occupancyValue !== undefined && occupancyValue !== null && occupancyValue > 0) {
        // Validate occupancy value is in reasonable range (0-100 for percentage)
        if (occupancyValue < 0 || occupancyValue > 100) {
          console.warn(`⚠️ Occupancy value out of range at index ${index} (${X_values[index]}): ${occupancyValue}% (expected 0-100)`);
          // Clamp to valid range
          occupancyValue = Math.max(0, Math.min(100, occupancyValue));
        }

        // Convert to decimal (divide by 100 for percentages)
        totalOccupancy += occupancyValue / 100;
        count++;
      }
    }

    const avgOccupancy = count > 0 ? totalOccupancy / count : 0;

    // Final sanity check on calculated average occupancy
    if (avgOccupancy < 0 || avgOccupancy > 1) {
      console.warn(`⚠️ Calculated average occupancy out of range: ${(avgOccupancy * 100).toFixed(1)}% (expected 0-100%)`);
      return Math.max(0, Math.min(1, avgOccupancy));
    }

    console.log(`🔍 Market occupancy result: total=${totalOccupancy}, count=${count}, avg=${avgOccupancy} (${(avgOccupancy*100).toFixed(1)}%)`);

    return avgOccupancy;
  }

  /**
   * Extract percentage value from string (e.g., "85%" -> 0.85)
   */
  private extractPercentage(value: string): number {
    if (!value || value === "Unavailable") return 0;
    const match = value.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) / 100 : 0;
  }
}
