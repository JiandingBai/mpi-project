export interface Listing {
  id: string;
  pms: string;
  name: string;
  latitude: string;
  longitude: string;
  country: string;
  city_name: string;
  state: string;
  no_of_bedrooms: number;
  min: number | null;
  base: number | null;
  max: number | null;
  group: string | null;
  subgroup: string | null;
  tags: string | null;
  notes: string | null;
  isHidden: boolean;
  push_enabled: boolean;
  last_date_pushed: string | null;
  revenue_ytd: number | string;
  stly_revenue_ytd: number | string;
  revenue_past_60: number | string;
  stly_revenue_past_60: number | string;
  last_booked_date: string;
  booking_pickup_unique_past_7: number | string;
  booking_pickup_unique_past_30: number | string;
  mpi_next_90: number;
  revenue_past_30: number | string;
  stly_revenue_past_30: number | string;
  adjusted_occupancy_past_30: string;
  market_adjusted_occupancy_past_30: string;
  adjusted_occupancy_past_90: string;
  market_adjusted_occupancy_past_90: string;
  revenue_past_90: number | string;
  stly_revenue_past_90: number | string;
  mpi_next_7: number;
  mpi_next_30: number;
  mpi_next_60: number;
  mpi_next_120: number;
  min_prices_next_30: string;
  min_prices_next_60: string;
  revpar_next_60: number | string;
  stly_revpar_next_60: number | string;
  revpar_next_30: number | string;
  stly_revpar_next_30: number | string;
  recommended_base_price: number | string;
  last_refreshed_at: string | null;
}

export interface ListingsData {
  listings: Listing[];
}

export interface NeighborhoodData {
  data: {
    "Listings Used": number;
    currency: string;
    lat: number;
    lng: number;
    source: string;
    "Market KPI": {
      Category: {
        [categoryId: string]: {
          X_values: string[]; // Month names like "Aug 2023", "Sep 2023"
          Y_values: number[][]; // Array of occupancy values for each month
        };
      };
    };
    "Future Percentile Prices": {
      Category: {
        [categoryId: string]: {
          X_values: string[]; // Daily dates like "2025-08-07", "2025-08-08"
          Y_values: number[][]; // Array of price/occupancy values for each day
        };
      };
    };
    "Future Occ/New/Canc": {
      Category: {
        [categoryId: string]: {
          X_values: string[]; // Daily dates like "2025-08-07", "2025-08-08"
          Y_values: number[][]; // Array of occupancy/booking values for each day
        };
      };
    };
  };
}

export type Timeframe = 7 | 30 | 60 | 90 | 120;

export interface MPISummary {
  group: string;
  mpi_7: number;
  mpi_30: number;
  mpi_60: number;
  mpi_90: number;
  mpi_120: number;
  listingCount: number;
}

export interface CalculatedMPI {
  listingId: string;
  group: string;
  mpi_7: number;
  mpi_30: number;
  mpi_60: number;
  mpi_90: number;
  mpi_120: number;
}

export interface MPIComparison {
  listingId: string;
  group: string;
  api_mpi_7: number;
  api_mpi_30: number;
  api_mpi_60: number;
  api_mpi_90: number;
  api_mpi_120: number;
  calculated_mpi_7: number;
  calculated_mpi_30: number;
  calculated_mpi_60: number;
  calculated_mpi_90: number;
  calculated_mpi_120: number;
  calculation_method_7: 'api' | 'neighborhood' | 'none';
  calculation_method_30: 'api' | 'neighborhood' | 'none';
  calculation_method_60: 'api' | 'neighborhood' | 'none';
  calculation_method_90: 'api' | 'neighborhood' | 'none';
  calculation_method_120: 'api' | 'neighborhood' | 'none';
}

export interface MPISummaryComparison {
  group: string;
  api_mpi_7: number;
  api_mpi_30: number;
  api_mpi_60: number;
  api_mpi_90: number;
  api_mpi_120: number;
  calculated_mpi_7: number;
  calculated_mpi_30: number;
  calculated_mpi_60: number;
  calculated_mpi_90: number;
  calculated_mpi_120: number;
  listingCount: number;
}

export interface OccupancyData {
  propertyOccupancy: number;
  marketOccupancy: number;
  dateRange: {
    start: Date;
    end: Date;
  };
}
