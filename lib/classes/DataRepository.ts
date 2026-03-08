import Database from 'better-sqlite3';
import { ListingsData, NeighborhoodData, ReservationsData } from '../../types';
import { logger } from '../logger';
import { isCacheFresh } from '../database/init';

/**
 * DataRepository handles all data loading with three-tier fallback strategy:
 * 1. Try PriceLabs API (primary source)
 * 2. Try SQLite database cache (if API fails)
 * 3. Try JSON files (final fallback)
 * 
 * Automatically caches successful API responses to database for resilience.
 */
export class DataRepository {
  private db: Database.Database;
  private cacheMaxAgeHours: number;

  constructor(database: Database.Database, cacheMaxAgeHours: number = 24) {
    this.db = database;
    this.cacheMaxAgeHours = cacheMaxAgeHours;
  }

  /**
   * Load listings data with fallback strategy
   */
  async loadListings(): Promise<ListingsData> {
    // Try API first
    const apiData = await this.tryLoadListingsFromAPI();
    if (apiData) {
      this.saveListingsToCache(apiData);
      return apiData;
    }

    // Try database cache
    const cachedData = this.tryLoadListingsFromCache();
    if (cachedData) {
      logger.fallbackUsed('Database cache', 'API unavailable');
      return cachedData;
    }

    // Final fallback: JSON files
    logger.fallbackUsed('JSON files', 'API and database unavailable');
    return await this.tryLoadListingsFromFile();
  }

  /**
   * Load neighborhood data with fallback strategy
   */
  async loadNeighborhood(listingId: string): Promise<NeighborhoodData> {
    // Try API first
    const apiData = await this.tryLoadNeighborhoodFromAPI(listingId);
    if (apiData) {
      this.saveNeighborhoodToCache(listingId, apiData);
      return apiData;
    }

    // Try database cache
    const cachedData = this.tryLoadNeighborhoodFromCache(listingId);
    if (cachedData) {
      logger.fallbackUsed('Database cache', 'API unavailable');
      return cachedData;
    }

    // Final fallback: JSON files
    logger.fallbackUsed('JSON files', 'API and database unavailable');
    return await this.tryLoadNeighborhoodFromFile();
  }
  /**
   * Load reservations data with fallback strategy
   */
  async loadReservations(listingId: string): Promise<ReservationsData | null> {
    // Try database cache first (if fresh)
    const cachedData = this.tryLoadReservationsFromCache(listingId);
    if (cachedData) {
      console.log(`✅ Loaded reservations from database cache (listing: ${listingId})`);
      return cachedData;
    }

    // Try API
    const apiData = await this.tryLoadReservationsFromAPI(listingId);
    if (apiData) {
      this.saveReservationsToCache(listingId, apiData);
      return apiData;
    }

    // Try database cache even if stale (better than nothing)
    const staleData = this.tryLoadReservationsFromCache(listingId, true);
    if (staleData) {
      logger.fallbackUsed('Stale database cache', 'API unavailable');
      return staleData;
    }

    // Final fallback: JSON files
    const fileData = await this.tryLoadReservationsFromFile(listingId);
    if (fileData) {
      logger.fallbackUsed('JSON files', 'API and database unavailable');
      return fileData;
    }

    // No data available
    return null;
  }

  /**
   * Try loading listings from PriceLabs API
   */
  private async tryLoadListingsFromAPI(): Promise<ListingsData | null> {
    if (typeof window !== 'undefined') return null; // Only on server-side

    try {
      const apiKey = process.env.PRICELABS_API_KEY;
      if (!apiKey) return null;

      const url = `https://api.pricelabs.co/v1/listings?api_key=${apiKey}`;
      logger.apiCall('GET', url);

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.listings && Array.isArray(data.listings)) {
          logger.apiSuccess('GET', url, data.listings.length);
          console.log(`✅ Loaded ${data.listings.length} listings from API`);
          return data as ListingsData;
        }
      }
    } catch (error) {
      logger.apiFailure('GET', 'PriceLabs Listings API', error);
    }

    return null;
  }

  /**
   * Try loading listings from database cache
   */
  private tryLoadListingsFromCache(): ListingsData | null {
    try {
      const stmt = this.db.prepare('SELECT data_json, updated_at FROM listings WHERE id = ?');
      const row = stmt.get('all_listings') as { data_json: string; updated_at: string } | undefined;

      if (row && isCacheFresh(row.updated_at, this.cacheMaxAgeHours)) {
        const data = JSON.parse(row.data_json) as ListingsData;
        console.log(`✅ Loaded ${data.listings.length} listings from database cache`);
        return data;
      }
    } catch (error) {
      console.log('❌ Database cache error:', error);
    }

    return null;
  }

  /**
   * Try loading listings from JSON file
   */
  private async tryLoadListingsFromFile(): Promise<ListingsData> {
    // Server-side file loading
    if (typeof window === 'undefined') {
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

    // Absolute fallback: minimal sample data
    console.log('⚠️ Using minimal sample data as final fallback');
    return {
      listings: [{
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
      }]
    } as ListingsData;
  }

  /**
   * Try loading neighborhood data from PriceLabs API
   */
  private async tryLoadNeighborhoodFromAPI(listingId: string): Promise<NeighborhoodData | null> {
    if (typeof window !== 'undefined') return null; // Only on server-side

    try {
      const apiKey = process.env.PRICELABS_API_KEY;
      if (!apiKey) return null;

      const url = `https://api.pricelabs.co/v1/neighborhood_data?pms=hostaway&listing_id=${listingId}&api_key=${apiKey}`;
      console.log(`🔗 Trying PriceLabs API for neighborhood data (listing: ${listingId})...`);

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Loaded neighborhood data from API`);
        return data as NeighborhoodData;
      }
    } catch (error) {
      console.log(`❌ PriceLabs API failed for neighborhood data:`, error);
    }

    return null;
  }

  /**
   * Try loading neighborhood data from database cache
   */
  private tryLoadNeighborhoodFromCache(listingId: string): NeighborhoodData | null {
    try {
      const stmt = this.db.prepare('SELECT data_json, updated_at FROM neighborhood_data WHERE listing_id = ?');
      const row = stmt.get(listingId) as { data_json: string; updated_at: string } | undefined;

      if (row && isCacheFresh(row.updated_at, this.cacheMaxAgeHours)) {
        const data = JSON.parse(row.data_json) as NeighborhoodData;
        console.log(`✅ Loaded neighborhood data from database cache`);
        return data;
      }
    } catch (error) {
      console.log('❌ Database cache error:', error);
    }

    return null;
  }

  /**
   * Try loading neighborhood data from JSON file
   */
  private async tryLoadNeighborhoodFromFile(): Promise<NeighborhoodData> {
    // Server-side file loading
    if (typeof window === 'undefined') {
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
        console.log('❌ Fallback file error:', error);
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
      console.log('❌ Client fetch error:', error);
    }

    throw new Error('Failed to load neighborhood data from all sources');
  }

  /**
   * Save listings to database cache
   */
  private saveListingsToCache(data: ListingsData): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO listings (id, data_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run('all_listings', JSON.stringify(data));
    } catch (error) {
      console.log('❌ Failed to cache listings:', error);
    }
  }

  /**
   * Save neighborhood data to database cache
   */
  private saveNeighborhoodToCache(listingId: string, data: NeighborhoodData): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO neighborhood_data (listing_id, data_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run(listingId, JSON.stringify(data));
    } catch (error) {
      console.log('❌ Failed to cache neighborhood data:', error);
    }
  }

    /**
     * Try loading reservations from PriceLabs API
     */
    private async tryLoadReservationsFromAPI(listingId: string): Promise<ReservationsData | null> {
      if (typeof window !== 'undefined') return null; // Only on server-side

      try {
        const apiKey = process.env.PRICELABS_API_KEY;
        if (!apiKey) return null;

        const url = `https://api.pricelabs.co/v1/reservations?listing_id=${listingId}&api_key=${apiKey}`;
        logger.apiCall('GET', url);
        console.log(`🔗 Trying PriceLabs API for reservations (listing: ${listingId})...`);

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();

          // Validate response structure
          if (!data || typeof data !== 'object') {
            console.log(`❌ Invalid reservations API response format`);
            return null;
          }

          // Ensure reservations array exists
          const reservationsData: ReservationsData = {
            listing_id: listingId,
            reservations: Array.isArray(data.reservations) ? data.reservations : []
          };

          logger.apiSuccess('GET', url, reservationsData.reservations.length);
          console.log(`✅ Loaded ${reservationsData.reservations.length} reservations from API`);
          return reservationsData;
        } else {
          console.log(`❌ Reservations API returned status ${response.status}`);
        }
      } catch (error) {
        logger.apiFailure('GET', 'PriceLabs Reservations API', error);
        console.log(`❌ PriceLabs API failed for reservations:`, error);
      }

      return null;
    }

    /**
     * Try loading reservations from database cache
     */
    private tryLoadReservationsFromCache(listingId: string, allowStale: boolean = false): ReservationsData | null {
      try {
        const stmt = this.db.prepare('SELECT data_json, updated_at FROM reservations WHERE listing_id = ?');
        const row = stmt.get(listingId) as { data_json: string; updated_at: string } | undefined;

        if (row) {
          const isFresh = isCacheFresh(row.updated_at, this.cacheMaxAgeHours);

          if (isFresh || allowStale) {
            const data = JSON.parse(row.data_json) as ReservationsData;
            if (isFresh) {
              console.log(`✅ Cache hit: reservations for listing ${listingId} (fresh)`);
            } else {
              console.log(`⚠️ Cache hit: reservations for listing ${listingId} (stale)`);
            }
            return data;
          } else {
            console.log(`❌ Cache miss: reservations for listing ${listingId} (expired)`);
          }
        } else {
          console.log(`❌ Cache miss: no reservations cached for listing ${listingId}`);
        }
      } catch (error) {
        console.log('❌ Database cache error:', error);
      }

      return null;
    }

    /**
     * Try loading reservations from JSON file
     */
    private async tryLoadReservationsFromFile(listingId: string): Promise<ReservationsData | null> {
      // Server-side file loading
      if (typeof window === 'undefined') {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const filePath = path.join(process.cwd(), 'public', `reservations-${listingId}.json`);

          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContent) as ReservationsData;
            console.log(`✅ Loaded reservations from fallback file`);
            return data;
          }
        } catch (error) {
          console.log('❌ Fallback file error:', error);
        }
      }

      // Client-side fallback
      try {
        const response = await fetch(`/reservations-${listingId}.json`);
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Loaded reservations from client`);
          return data as ReservationsData;
        }
      } catch (error) {
        // Silent fail - reservations file is optional
      }

      return null;
    }

    /**
     * Save reservations to database cache
     */
    private saveReservationsToCache(listingId: string, data: ReservationsData): void {
      try {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO reservations (listing_id, data_json, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(listingId, JSON.stringify(data));
        console.log(`✅ Cached reservations for listing ${listingId}`);
      } catch (error) {
        console.log('❌ Failed to cache reservations:', error);
      }
    }
}
