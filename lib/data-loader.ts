import { ListingsData, NeighborhoodData } from '../types';
import { logger } from './logger';

/**
 * Load listings data from PriceLabs API with fallback to local files
 */
export async function loadListingsData(): Promise<ListingsData> {
  // Server-side: try PriceLabs API first
  if (typeof window === 'undefined') {
    try {
      const apiKey = process.env.PRICELABS_API_KEY;
      if (apiKey) {
        const url = `https://api.pricelabs.co/v1/listings?api_key=${apiKey}`;
        logger.apiCall('GET', url);
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.listings && Array.isArray(data.listings)) {
            logger.apiSuccess('GET', url, data.listings.length);
            return data as ListingsData;
          }
        }
      }
      logger.fallbackUsed('Local listings file', 'PriceLabs API failed or no API key');
    } catch (error) {
      logger.apiFailure('GET', 'PriceLabs Listings API', error);
    }
    
    // Fallback: Load from public directory
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public', 'listings.json');
      
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent) as ListingsData;
        console.log(`✅ Loaded ${data.listings.length} listings from fallback file`);
        return data;
      }
    } catch (error) {
      console.log('❌ Fallback file error:', error);
    }
  }
  
  // Client-side or final fallback
  try {
    const response = await fetch('/listings.json');
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Loaded ${data.listings.length} listings from client`);
      return data as ListingsData;
    }
  } catch (error) {
    console.log('❌ Client fetch error:', error);
  }
  
  // Absolute fallback: Return sample data
  console.log('⚠️ Using minimal sample data as final fallback');
  return {
    listings: [
      {
        id: "sample-1",
        group: "Sample Group",
        mpi_next_7: 173,
        mpi_next_30: 180,
        mpi_next_60: 147,
        mpi_next_90: 120,
        mpi_next_120: 110,
        adjusted_occupancy_past_30: "85%",
        adjusted_occupancy_past_90: "82%",
        pms: "airbnb",
        name: "Sample Property",
        latitude: "42.7645",
        longitude: "-76.1467",
        country: "US",
        city_name: "Sample City",
        state: "NY",
        no_of_bedrooms: 3,
        min: 150,
        base: 200,
        max: 300,
      }
    ]
  } as ListingsData;
}

/**
 * Load neighborhood data from PriceLabs API for a specific listing
 */
export async function loadNeighborhoodData(listingId: string): Promise<NeighborhoodData> {
  // Server-side: try PriceLabs API first
  if (typeof window === 'undefined') {
    try {
      const apiKey = process.env.PRICELABS_API_KEY;
      if (apiKey) {
        console.log(`🔗 Trying PriceLabs API for neighborhood data (listing: ${listingId})...`);
        
        const response = await fetch(`https://api.pricelabs.co/v1/neighborhood_data?pms=hostaway&listing_id=${listingId}&api_key=${apiKey}`);
        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data["Future Occ/New/Canc"]) {
            console.log(`✅ Loaded neighborhood data for listing ${listingId} from PriceLabs API`);
            return data as NeighborhoodData;
          }
        }
      }
      console.log('❌ PriceLabs API failed, using fallback neighborhood data...');
    } catch (error) {
      console.log('❌ PriceLabs API error:', error);
    }
    
    // Fallback: Load from public directory
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public', 'neighborhood.json');
      
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent) as NeighborhoodData;
        console.log(`✅ Loaded neighborhood data from fallback file`);
        return data;
      }
    } catch (error) {
      console.log('❌ Fallback neighborhood file error:', error);
    }
  }
  
  // Client-side or final fallback
  try {
    const response = await fetch('/neighborhood.json');
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Loaded neighborhood data from client`);
      return data as NeighborhoodData;
    }
  } catch (error) {
    console.log('❌ Client neighborhood fetch error:', error);
  }
  
  // Absolute fallback: Return sample neighborhood data with only occupancy data
  console.log('⚠️ Using minimal sample neighborhood data as final fallback');
  return {
    data: {
      "Listings Used": 1,
      currency: "USD",
      lat: 42.7645,
      lng: -76.1467,
      source: "airbnb",
      "Future Occ/New/Canc": {
        Category: {
          "0": {
            X_values: ["2025-08-07", "2025-08-08", "2025-08-09", "2025-08-10", "2025-08-11", "2025-08-12", "2025-08-13", "2025-08-14"],
            Y_values: [[75, 80, 75, 70, 85, 90, 85, 80]]
          }
        }
      }
    }
  } as NeighborhoodData;
}

export function matchListingToNeighborhood(
  listing: any,
  neighborhoodData: NeighborhoodData
): string | null {
  const categories = Object.keys(neighborhoodData.data["Future Occ/New/Canc"]?.Category || {});
  if (categories.length > 0) {
    return categories[0]; // Default to first category
  }
  return null;
}

export function calculateMarketOccupancy(
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
      return calculateMarketOccupancyFromCategory(firstCategory, startDate, endDate, allCategories[0]);
    }
    return 0;
  }
  
  console.log(`🔍 Using Future Occ/New/Canc section, category: ${categoryId}`);
  return calculateMarketOccupancyFromCategory(category, startDate, endDate, categoryId);
}

function calculateMarketOccupancyFromCategory(
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
        const date = new Date(dateStr);
        if (date >= startDate && date <= endDate) {
          relevantIndices.push(i);
        }
      } catch (error) {
        // Skip invalid dates
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
    console.log(`❌ No relevant dates found for range ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    return 0;
  }
  
  console.log(`🔍 Found ${relevantIndices.length} relevant indices for range ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  console.log(`🔍 Data type: ${hasDailyData ? 'Daily' : 'Monthly'}`);
  
  // In Future Occ/New/Canc, Y_values[0] should be occupancy data
  const occupancyYIndex = 0;
  console.log(`🔍 Y_values info: arrays=${Y_values.length}, lengths=[${Y_values.map(arr => arr?.length || 0).join(', ')}]`);
  
  if (relevantIndices.length > 0) {
    const firstIndex = relevantIndices[0];
    console.log(`🔍 Sample Y_values at index ${firstIndex}: [${Y_values.map((arr, i) => `Y[${i}]=${arr?.[firstIndex] ?? 'undefined'}`).join(', ')}]`);
    
    // Check for nested structure
    if (Y_values[0] && Y_values[0][0]) {
      console.log(`🔍 Nested structure detected: Y_values[0][0] type=${typeof Y_values[0][0]}, isArray=${Array.isArray(Y_values[0][0])}`);
      if (Array.isArray(Y_values[0][0])) {
        console.log(`🔍 Y_values[0][0] sample: [${Y_values[0][0].slice(firstIndex, firstIndex + 3).join(', ')}]`);
      }
    }
  }
  
  let totalOccupancy = 0;
  let count = 0;
  
  // Process all relevant indices for calculation
  for (let i = 0; i < relevantIndices.length; i++) {
    const index = relevantIndices[i];
    if (i < 3) { // Debug output for first 3 only
      console.log(`🔍 Index ${index} (${X_values[index]}): Y[0]=${Y_values[0]?.[index] ?? 'undefined'}, Y[1]=${Y_values[1]?.[index] ?? 'undefined'}, Y[2]=${Y_values[2]?.[index] ?? 'undefined'}`);
    }
    
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
      // Convert to decimal (divide by 100 for percentages)
      totalOccupancy += occupancyValue / 100;
      count++;
    }
  }
  
  const avgOccupancy = count > 0 ? totalOccupancy / count : 0;
  console.log(`🔍 Market occupancy result: total=${totalOccupancy}, count=${count}, avg=${avgOccupancy} (${(avgOccupancy*100).toFixed(1)}%)`);
  
  return avgOccupancy;
}

export function calculatePropertyOccupancy(
  listing: any,
  startDate: Date,
  endDate: Date
): number {
  // Note: For MPI calculations, we're looking at future periods but only have past occupancy data
  // This is a limitation of the available data. We use the best available approximation.
  const now = new Date();
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 30) {
    return extractPercentage(listing.adjusted_occupancy_past_30);
  } else if (daysDiff <= 90) {
    return extractPercentage(listing.adjusted_occupancy_past_90);
  } else {
    // For longer periods, use 90-day historical as best approximation
    return extractPercentage(listing.adjusted_occupancy_past_90);
  }
}

function extractPercentage(value: string): number {
  if (!value || value === "Unavailable") return 0;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) / 100 : 0;
}
