import { ListingsData, NeighborhoodData } from '../types';

/**
 * Load listings data from PriceLabs API with fallback to mock files
 */
export async function loadListingsData(): Promise<ListingsData> {
  try {
    // Check if we're in a server environment
    if (typeof window === 'undefined') {
      // Server-side: try PriceLabs API first
      try {
        const apiKey = process.env.PRICELABS_API_KEY;
        if (!apiKey) {
          throw new Error('PRICELABS_API_KEY not found in environment variables');
        }

        console.log('Trying PriceLabs API for listings...');
        
        const response = await fetch(`https://api.pricelabs.co/v1/listings?api_key=${apiKey}`);

        if (!response.ok) {
          throw new Error(`PriceLabs API error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Validate data structure
        if (!data.listings || !Array.isArray(data.listings)) {
          throw new Error('Invalid listings data structure from PriceLabs API');
        }
        
        console.log(`✅ Loaded ${data.listings.length} listings from PriceLabs API`);
        return data as ListingsData;
      } catch (apiError) {
        console.log('❌ PriceLabs API failed:', apiError);
        console.log('Falling back to mock files...');
      }
      
      // Fallback 1: Try public directory
      try {
        const fs = await import('fs');
        const path = await import('path');
        const publicFilePath = path.join(process.cwd(), 'public', 'listings.json');
        
        console.log('Trying public directory:', publicFilePath);
        
        // Check if file exists
        if (fs.existsSync(publicFilePath)) {
          const fileContent = fs.readFileSync(publicFilePath, 'utf8');
          const data = JSON.parse(fileContent) as ListingsData;
          
          // Validate data structure
          if (!data.listings || !Array.isArray(data.listings)) {
            throw new Error('Invalid listings data structure');
          }
          
          console.log(`✅ Loaded ${data.listings.length} listings from public directory (fallback)`);
          return data;
        } else {
          console.log('❌ Public file not found, trying mock directory...');
        }
      } catch (fsError) {
        console.log('❌ Public directory approach failed:', fsError);
      }
      
      // Fallback 2: Try mock directory
      try {
        const fs = await import('fs');
        const path = await import('path');
        const mockFilePath = path.join(process.cwd(), 'mock', 'listings.json');
        
        console.log('Trying mock directory:', mockFilePath);
        
        // Check if file exists
        if (fs.existsSync(mockFilePath)) {
          const fileContent = fs.readFileSync(mockFilePath, 'utf8');
          const data = JSON.parse(fileContent) as ListingsData;
          
          // Validate data structure
          if (!data.listings || !Array.isArray(data.listings)) {
            throw new Error('Invalid listings data structure');
          }
          
          console.log(`✅ Loaded ${data.listings.length} listings from mock directory (fallback)`);
          return data;
        } else {
          console.log('❌ Mock file not found, using sample data...');
        }
      } catch (fsError) {
        console.log('❌ Mock directory approach failed:', fsError);
      }
      
      // Fallback 3: Try fetch with absolute URL (for Vercel)
      try {
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : process.env.NODE_ENV === 'production' 
            ? 'https://mpi-project.vercel.app'
            : 'http://localhost:3000';
            
        console.log('Trying fetch approach with URL:', `${baseUrl}/listings.json`);
        
        const response = await fetch(`${baseUrl}/listings.json`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Validate data structure
        if (!data.listings || !Array.isArray(data.listings)) {
          throw new Error('Invalid listings data structure');
        }
        
        console.log(`✅ Loaded ${data.listings.length} listings from server (fetch fallback)`);
        return data as ListingsData;
      } catch (fetchError) {
        console.log('❌ Fetch approach failed:', fetchError);
      }
      
      // Fallback 4: Hardcoded sample data
      console.log('❌ All approaches failed, using realistic fallback sample data...');
      return {
        listings: [
          {
            id: "sample-1",
            group: "Catskills",
            mpi_next_7: 1.73,
            mpi_next_30: 1.8,
            mpi_next_60: 1.47,
            mpi_next_90: 1.2,
            mpi_next_120: 1.1,
            adjusted_occupancy_past_30: "85 %",
            market_adjusted_occupancy_past_30: "75 %",
            adjusted_occupancy_past_90: "82 %",
            market_adjusted_occupancy_past_90: "78 %",
            pms: "airbnb",
            name: "Catskills Mountain Retreat",
            latitude: "42.7645",
            longitude: "-76.1467",
            country: "US",
            city_name: "Catskills",
            state: "NY",
            no_of_bedrooms: 3,
            min: 150,
            base: 200,
            max: 300,
            subgroup: null,
            tags: null,
            notes: null,
            isHidden: false,
            push_enabled: true,
            last_date_pushed: "2024-08-08",
            revenue_ytd: 15000,
            stly_revenue_ytd: 14000,
            revenue_past_60: 3000,
            stly_revenue_past_60: 2800,
            last_booked_date: "2024-08-07",
            booking_pickup_unique_past_7: 2,
            booking_pickup_unique_past_30: 8,
            revenue_past_30: 1500,
            stly_revenue_past_30: 1400,
            revenue_past_90: 4500,
            stly_revenue_past_90: 4200,
            min_prices_next_30: "180,200,220",
            min_prices_next_60: "175,195,215",
            revpar_next_60: 85,
            stly_revpar_next_60: 80,
            revpar_next_30: 90,
            stly_revpar_next_30: 85,
            recommended_base_price: 200,
            last_refreshed_at: "2024-08-08T12:00:00Z"
          },
          {
            id: "sample-2",
            group: "Colorado",
            mpi_next_7: 0.93,
            mpi_next_30: 0.88,
            mpi_next_60: 0.89,
            mpi_next_90: 1.09,
            mpi_next_120: 1.29,
            adjusted_occupancy_past_30: "70 %",
            market_adjusted_occupancy_past_30: "80 %",
            adjusted_occupancy_past_90: "75 %",
            market_adjusted_occupancy_past_90: "82 %",
            pms: "airbnb",
            name: "Colorado Mountain Lodge",
            latitude: "39.7392",
            longitude: "-104.9903",
            country: "US",
            city_name: "Denver",
            state: "CO",
            no_of_bedrooms: 4,
            min: 200,
            base: 250,
            max: 350,
            subgroup: null,
            tags: null,
            notes: null,
            isHidden: false,
            push_enabled: true,
            last_date_pushed: "2024-08-08",
            revenue_ytd: 20000,
            stly_revenue_ytd: 18000,
            revenue_past_60: 4000,
            stly_revenue_past_60: 3600,
            last_booked_date: "2024-08-07",
            booking_pickup_unique_past_7: 3,
            booking_pickup_unique_past_30: 12,
            revenue_past_30: 2000,
            stly_revenue_past_30: 1800,
            revenue_past_90: 6000,
            stly_revenue_past_90: 5400,
            min_prices_next_30: "230,250,270",
            min_prices_next_60: "225,245,265",
            revpar_next_60: 100,
            stly_revpar_next_60: 90,
            revpar_next_30: 110,
            stly_revpar_next_30: 100,
            recommended_base_price: 250,
            last_refreshed_at: "2024-08-08T12:00:00Z"
          },
          {
            id: "sample-3",
            group: "Miramar Beach",
            mpi_next_7: 1.15,
            mpi_next_30: 1.22,
            mpi_next_60: 1.18,
            mpi_next_90: 1.05,
            mpi_next_120: 0.95,
            adjusted_occupancy_past_30: "88 %",
            market_adjusted_occupancy_past_30: "72 %",
            adjusted_occupancy_past_90: "85 %",
            market_adjusted_occupancy_past_90: "78 %",
            pms: "airbnb",
            name: "Miramar Beach Condo",
            latitude: "30.3935",
            longitude: "-86.8647",
            country: "US",
            city_name: "Miramar Beach",
            state: "FL",
            no_of_bedrooms: 2,
            min: 120,
            base: 150,
            max: 200,
            subgroup: null,
            tags: null,
            notes: null,
            isHidden: false,
            push_enabled: true,
            last_date_pushed: "2024-08-08",
            revenue_ytd: 12000,
            stly_revenue_ytd: 11000,
            revenue_past_60: 2400,
            stly_revenue_past_60: 2200,
            last_booked_date: "2024-08-07",
            booking_pickup_unique_past_7: 1,
            booking_pickup_unique_past_30: 6,
            revenue_past_30: 1200,
            stly_revenue_past_30: 1100,
            revenue_past_90: 3600,
            stly_revenue_past_90: 3300,
            min_prices_next_30: "140,150,160",
            min_prices_next_60: "135,145,155",
            revpar_next_60: 60,
            stly_revpar_next_60: 55,
            revpar_next_30: 65,
            stly_revpar_next_30: 60,
            recommended_base_price: 150,
            last_refreshed_at: "2024-08-08T12:00:00Z"
          }
        ]
      };
    } else {
      // Client-side: use fetch (will use fallback data)
      const response = await fetch('/listings.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (!data.listings || !Array.isArray(data.listings)) {
        throw new Error('Invalid listings data structure');
      }
      
      console.log(`✅ Loaded ${data.listings.length} listings from client`);
      return data as ListingsData;
    }
  } catch (error) {
    console.error('❌ Error loading listings data:', error);
    throw new Error(`Failed to load listings data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load neighborhood data from PriceLabs API for a specific listing
 */
export async function loadNeighborhoodData(listingId: string): Promise<NeighborhoodData> {
  try {
    // Check if we're in a server environment
    if (typeof window === 'undefined') {
      // Server-side: try PriceLabs API first
      try {
        const apiKey = process.env.PRICELABS_API_KEY;
        if (!apiKey) {
          throw new Error('PRICELABS_API_KEY not found in environment variables');
        }

        console.log(`Trying PriceLabs API for neighborhood data (listing: ${listingId})...`);
        
        const response = await fetch(`https://api.pricelabs.co/v1/neighborhood_data?pms=hostaway&listing_id=${listingId}&api_key=${apiKey}`);

        if (!response.ok) {
          throw new Error(`PriceLabs API error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Validate data structure
        if (!data.data || !data.data["Market KPI"]) {
          throw new Error('Invalid neighborhood data structure from PriceLabs API');
        }
        
        console.log(`✅ Loaded neighborhood data for listing ${listingId} from PriceLabs API`);
        return data as NeighborhoodData;
      } catch (apiError) {
        console.log('❌ PriceLabs API failed for neighborhood:', apiError);
        console.log('Falling back to mock files...');
      }
      
      // Fallback 1: Try public directory
      try {
        const fs = await import('fs');
        const path = await import('path');
        const publicFilePath = path.join(process.cwd(), 'public', 'neighborhood.json');
        
        console.log('Trying public directory for neighborhood:', publicFilePath);
        
        // Check if file exists
        if (fs.existsSync(publicFilePath)) {
          const fileContent = fs.readFileSync(publicFilePath, 'utf8');
          const data = JSON.parse(fileContent) as NeighborhoodData;
          
          // Validate data structure
          if (!data.data || !data.data["Market KPI"]) {
            throw new Error('Invalid neighborhood data structure');
          }
          
          console.log(`✅ Loaded neighborhood data from public directory (fallback)`);
          return data;
        } else {
          console.log('❌ Public neighborhood file not found, trying mock directory...');
        }
      } catch (fsError) {
        console.log('❌ Public directory approach failed for neighborhood:', fsError);
      }
      
      // Fallback 2: Try mock directory
      try {
        const fs = await import('fs');
        const path = await import('path');
        const mockFilePath = path.join(process.cwd(), 'mock', 'neighborhood.json');
        
        console.log('Trying mock directory for neighborhood:', mockFilePath);
        
        // Check if file exists
        if (fs.existsSync(mockFilePath)) {
          const fileContent = fs.readFileSync(mockFilePath, 'utf8');
          const data = JSON.parse(fileContent) as NeighborhoodData;
          
          // Validate data structure
          if (!data.data || !data.data["Market KPI"]) {
            throw new Error('Invalid neighborhood data structure');
          }
          
          console.log(`✅ Loaded neighborhood data from mock directory (fallback)`);
          return data;
        } else {
          console.log('❌ Mock neighborhood file not found, trying fetch approach...');
        }
      } catch (fsError) {
        console.log('❌ Mock directory approach failed for neighborhood:', fsError);
      }
      
      // Fallback 3: Try fetch with absolute URL (for Vercel)
      try {
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : process.env.NODE_ENV === 'production' 
            ? 'https://mpi-project.vercel.app'
            : 'http://localhost:3000';
            
        console.log('Trying fetch approach for neighborhood with URL:', `${baseUrl}/neighborhood.json`);
        
        const response = await fetch(`${baseUrl}/neighborhood.json`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Validate data structure
        if (!data.data || !data.data["Market KPI"]) {
          throw new Error('Invalid neighborhood data structure');
        }
        
        console.log(`✅ Loaded neighborhood data from server (fetch fallback)`);
        return data as NeighborhoodData;
      } catch (fetchError) {
        console.log('❌ Fetch approach failed for neighborhood:', fetchError);
      }
      
      // Fallback 4: Hardcoded sample neighborhood data
      console.log('❌ All approaches failed for neighborhood, using realistic fallback neighborhood data...');
      return {
        data: {
          "Listings Used": 3,
          currency: "USD",
          lat: 42.7645,
          lng: -76.1467,
          source: "airbnb",
          "Market KPI": {
            Category: {
              "0": {
                X_values: ["Jan 2024", "Feb 2024", "Mar 2024", "Apr 2024", "May 2024", "Jun 2024", "Jul 2024", "Aug 2024"],
                Y_values: [[75, 80, 85, 90, 88, 92, 95, 93]]
              }
            }
          },
          "Future Percentile Prices": {
            Category: {
              "0": {
                X_values: ["2025-08-07", "2025-08-08", "2025-08-09", "2025-08-10", "2025-08-11", "2025-08-12", "2025-08-13", "2025-08-14"],
                Y_values: [[200, 190, 180, 170], [250, 240, 230, 220], [300, 290, 280, 270], [250, 240, 230, 220], [400, 390, 380, 370], [75, 70, 65, 60]]
              }
            }
          },
          "Future Occ/New/Canc": {
            Category: {
              "0": {
                X_values: ["2025-08-07", "2025-08-08", "2025-08-09", "2025-08-10", "2025-08-11", "2025-08-12", "2025-08-13", "2025-08-14"],
                Y_values: [[75, 80, 75, 70, 85, 90, 85, 80]]
              }
            }
          }
        }
      };
    } else {
      // Client-side: use fetch (will use fallback data)
      const response = await fetch('/neighborhood.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (!data.data || !data.data["Market KPI"]) {
        throw new Error('Invalid neighborhood data structure');
      }
      
      console.log(`✅ Loaded neighborhood data from client`);
      return data as NeighborhoodData;
    }
  } catch (error) {
    console.error('❌ Error loading neighborhood data:', error);
    throw new Error(`Failed to load neighborhood data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function matchListingToNeighborhood(
  listing: any,
  neighborhoodData: NeighborhoodData
): string | null {
  const categories = Object.keys(neighborhoodData.data["Market KPI"].Category);
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
  // Try Future Occ/New/Canc first, but scan all categories to find realistic data
  let category = neighborhoodData.data["Future Occ/New/Canc"]?.Category?.[categoryId];
  let sectionName = "Future Occ/New/Canc";
  let actualCategoryId = categoryId;
  
  // Scan all categories in Future Occ/New/Canc to find realistic occupancy data
  if (neighborhoodData.data["Future Occ/New/Canc"]?.Category) {
    const allCategories = Object.keys(neighborhoodData.data["Future Occ/New/Canc"].Category);
    console.log(`🔍 Scanning ${allCategories.length} categories in Future Occ/New/Canc: [${allCategories.join(', ')}]`);
    
    let foundRealisticData = false;
    for (const catId of allCategories) {
      const testCategory = neighborhoodData.data["Future Occ/New/Canc"].Category[catId];
      if (testCategory?.Y_values?.[0]) {
        // Check for realistic occupancy data (decimal values between 0-100, not round numbers)
        const sampleValues = testCategory.Y_values[0].slice(0, 20);
        const realisticValues = sampleValues.filter(val => 
          val !== undefined && val !== null && val > 0 && val <= 100 && 
          !Number.isInteger(val) // Exclude round numbers like 50, 100
        );
        
        if (realisticValues.length >= 5) {
          console.log(`✅ Found realistic occupancy data in category ${catId}: [${realisticValues.slice(0, 5).map(v => v.toFixed(2)).join(', ')}...]`);
          category = testCategory;
          actualCategoryId = catId;
          foundRealisticData = true;
          break;
        } else {
          console.log(`❌ Category ${catId} has suspicious data: [${sampleValues.slice(0, 5).join(', ')}...]`);
        }
      }
    }
    
    if (!foundRealisticData) {
      console.log(`⚠️ No realistic occupancy data found in Future Occ/New/Canc, trying Future Percentile Prices...`);
      category = neighborhoodData.data["Future Percentile Prices"]?.Category?.[categoryId];
      sectionName = "Future Percentile Prices";
      actualCategoryId = categoryId;
    }
  }
  
  if (!category) {
    console.log(`❌ No data available in either section for category ${categoryId}`);
    return 0;
  }
  
  console.log(`🔍 Using section: ${sectionName}, category: ${actualCategoryId}`);

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
  
  if (relevantIndices.length === 0) return 0;
  
  let totalOccupancy = 0;
  let count = 0;
  

  
  console.log(`🔍 Found ${relevantIndices.length} relevant indices for range ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  console.log(`🔍 Data type: ${hasDailyData ? 'Daily' : 'Monthly'}`);
  
  // Debug Y_values structure first and determine which Y_values to use
  console.log(`🔍 Y_values info: arrays=${Y_values.length}, lengths=[${Y_values.map(arr => arr?.length || 0).join(', ')}]`);
  
  let occupancyYIndex = 0; // Default to Y_values[0]
  
  if (relevantIndices.length > 0) {
    const firstIndex = relevantIndices[0];
    console.log(`🔍 Sample Y_values at index ${firstIndex}: [${Y_values.map((arr, i) => `Y[${i}]=${arr?.[firstIndex] ?? 'undefined'}`).join(', ')}]`);
    
    if (sectionName === "Future Occ/New/Canc") {
      // For Future Occ/New/Canc, Y_values[0] is always "Occupancy" - use it directly
      occupancyYIndex = 0;
      console.log(`🔍 Using Y_values[0] for Future Occ/New/Canc occupancy data`);
      
      // Debug the nested structure for Future Occ/New/Canc
      if (Y_values[0] && Y_values[0][0]) {
        console.log(`🔍 Future Occ/New/Canc nested structure detected: Y_values[0][0] type=${typeof Y_values[0][0]}, isArray=${Array.isArray(Y_values[0][0])}`);
        if (Array.isArray(Y_values[0][0])) {
          console.log(`🔍 Y_values[0][0] sample: [${Y_values[0][0].slice(firstIndex, firstIndex + 3).join(', ')}]`);
        }
      }
    } else {
      // For Future Percentile Prices, scan to find which Y_values looks like occupancy
      for (let i = 0; i < Y_values.length; i++) {
        if (Y_values[i] && Y_values[i].length > firstIndex) {
          const sampleValues = Y_values[i].slice(firstIndex, firstIndex + 3);
          const hasData = sampleValues.some(val => val !== 0 && val !== undefined && val !== null);
          console.log(`🔍 Y_values[${i}] sample [${firstIndex}-${firstIndex+2}]: [${sampleValues.join(', ')}] hasData=${hasData}`);
          
          // Look for reasonable occupancy-like values (0-100)
          if (hasData) {
            const avgValue = sampleValues.filter(v => v !== null && v !== undefined).reduce((a, b) => a + b, 0) / sampleValues.length;
            if (avgValue > 0 && avgValue <= 100) {
              console.log(`🎯 Y_values[${i}] looks like occupancy data (avg: ${avgValue.toFixed(1)})`);
              occupancyYIndex = i;
              break;
            }
          }
        }
      }
    }
    console.log(`🔍 Will use Y_values[${occupancyYIndex}] for occupancy calculation`);
  }
  
  // Show first 3 for debugging, but process all for calculation
  for (let i = 0; i < relevantIndices.length; i++) {
    const index = relevantIndices[i];
    if (i < 3) { // Debug output for first 3 only
      console.log(`🔍 Index ${index} (${X_values[index]}): Y[0]=${Y_values[0]?.[index] ?? 'undefined'}, Y[1]=${Y_values[1]?.[index] ?? 'undefined'}, Y[2]=${Y_values[2]?.[index] ?? 'undefined'}`);
    }
    
    let occupancyValue;
    
    // Handle nested structure in Future Occ/New/Canc vs flat structure in Future Percentile Prices
    if (sectionName === "Future Occ/New/Canc" && Y_values[occupancyYIndex] && Array.isArray(Y_values[occupancyYIndex][0])) {
      // Nested structure: Y_values[0][0][index]  
      const nestedArray = Y_values[occupancyYIndex][0] as unknown as number[];
      occupancyValue = nestedArray?.[index];
    } else if (sectionName === "Future Occ/New/Canc") {
      // Direct array structure in Future Occ/New/Canc: Y_values[0][index]
      occupancyValue = Y_values[occupancyYIndex]?.[index];
    } else {
      // Flat structure in Future Percentile Prices: Y_values[index]
      occupancyValue = Y_values[occupancyYIndex]?.[index];
    }
    
    if (occupancyValue !== undefined && occupancyValue !== 0) { // Skip zero/undefined values
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
