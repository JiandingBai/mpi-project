import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { MPISummary } from '../types';

interface HomeProps {
  initialData: {
    summaries: MPISummary[];
    totalListings: number;
    totalGroups: number;
    grouping: string;
    neighborhoodInfo: {
      categories: number;
      location: { lat: number; lng: number };
      source: string;
    };
    calculationStats: {
      existingMPIUsed: number;
      neighborhoodCalculated: number;
      noDataAvailable: number;
      totalListings: number;
    };
  };
}

export default function Home({ initialData }: HomeProps) {
  const [summaries, setSummaries] = useState<MPISummary[]>(initialData.summaries);
  const [neighborhoodInfo, setNeighborhoodInfo] = useState(initialData.neighborhoodInfo);
  const [calculationStats, setCalculationStats] = useState(initialData.calculationStats);
  const [totalListings, setTotalListings] = useState(initialData.totalListings);
  const [totalGroups, setTotalGroups] = useState(initialData.totalGroups);
  const [grouping, setGrouping] = useState(initialData.grouping);
  const [loading, setLoading] = useState(false);

  // Client-side data fetching as fallback
  useEffect(() => {
    const fetchData = async () => {
      // Only fetch if we don't have data from server-side
      if (summaries.length === 0) {
        setLoading(true);
        try {
          const response = await fetch('/api/mpi');
          const result = await response.json();
          
          if (result.success) {
            setSummaries(result.data.summaries);
            setNeighborhoodInfo(result.data.neighborhoodInfo);
            setCalculationStats(result.data.calculationStats);
            setTotalListings(result.data.totalListings);
            setTotalGroups(result.data.totalGroups);
            setGrouping(result.data.grouping);
          }
        } catch (error) {
          console.error('Client-side fetch error:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [summaries.length]);

  // Handle grouping change
  const handleGroupingChange = async (newGrouping: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/mpi?grouping=${newGrouping}`);
      const result = await response.json();
      
      if (result.success) {
        setSummaries(result.data.summaries);
        setTotalGroups(result.data.totalGroups);
        setGrouping(result.data.grouping);
      }
    } catch (error) {
      console.error('Error fetching data with new grouping:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Log to console as requested
    console.log('MPI Summaries by Group:');
    console.table(summaries.map((summary: MPISummary) => ({
      Group: summary.group,
      'MPI 7-day': summary.mpi_7,
      'MPI 30-day': summary.mpi_30,
      'MPI 60-day': summary.mpi_60,
      'MPI 90-day': summary.mpi_90,
      'MPI 120-day': summary.mpi_120,
      'Listings': summary.listingCount,
    })));
    
    console.log('Neighborhood Data Source:', neighborhoodInfo);
    console.log('Calculation Statistics:', calculationStats);
  }, [summaries, neighborhoodInfo, calculationStats]);

  const totalCalculations = calculationStats.existingMPIUsed + 
                           calculationStats.neighborhoodCalculated + 
                           calculationStats.noDataAvailable;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading MPI data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              Market Penetration Index (MPI) Summary
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Average MPI values grouped by property location using neighborhood market data
            </p>
            <div className="mt-2 text-xs text-gray-500">
              <p>Market data source: {neighborhoodInfo.source}</p>
              <p>Neighborhood categories: {neighborhoodInfo.categories}</p>
              <p>Location: {neighborhoodInfo.location.lat.toFixed(4)}, {neighborhoodInfo.location.lng.toFixed(4)}</p>
            </div>
          </div>
          
          {/* Grouping Dropdown */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="grouping" className="block text-sm font-medium text-gray-700 mb-2">
                  Group By:
                </label>
                <select
                  id="grouping"
                  value={grouping}
                  onChange={(e) => handleGroupingChange(e.target.value)}
                  className="block w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="city">City</option>
                  <option value="bedrooms">Bedrooms</option>
                  <option value="city-bedrooms">City + Bedrooms</option>
                </select>
              </div>
              <div className="text-sm text-gray-600">
                <p><strong>Current Grouping:</strong> {grouping}</p>
                <p><strong>Total Groups:</strong> {totalGroups}</p>
              </div>
            </div>
          </div>
          
          <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Calculation Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-green-100 p-3 rounded">
                <p className="font-medium text-green-800">Existing MPI Used</p>
                <p className="text-2xl font-bold text-green-600">{calculationStats.existingMPIUsed}</p>
                <p className="text-green-700">{totalCalculations > 0 ? Math.round((calculationStats.existingMPIUsed / totalCalculations) * 100) : 0}%</p>
              </div>
              <div className="bg-blue-100 p-3 rounded">
                <p className="font-medium text-blue-800">Neighborhood Calculated</p>
                <p className="text-2xl font-bold text-blue-600">{calculationStats.neighborhoodCalculated}</p>
                <p className="text-blue-700">{totalCalculations > 0 ? Math.round((calculationStats.neighborhoodCalculated / totalCalculations) * 100) : 0}%</p>
              </div>
              <div className="bg-gray-100 p-3 rounded">
                <p className="font-medium text-gray-800">No Data Available</p>
                <p className="text-2xl font-bold text-gray-600">{calculationStats.noDataAvailable}</p>
                <p className="text-gray-700">{totalCalculations > 0 ? Math.round((calculationStats.noDataAvailable / totalCalculations) * 100) : 0}%</p>
              </div>
              <div className="bg-gray-100 p-3 rounded">
                <p className="font-medium text-gray-800">Total Calculations</p>
                <p className="text-2xl font-bold text-gray-600">{totalCalculations}</p>
                <p className="text-gray-700">({totalListings} listings × 5 timeframes)</p>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Group
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MPI 7-day
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MPI 30-day
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MPI 60-day
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MPI 90-day
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MPI 120-day
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Listings
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summaries.map((summary, index) => (
                  <tr key={summary.group} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {summary.group}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {summary.mpi_7.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {summary.mpi_30.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {summary.mpi_60.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {summary.mpi_90.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {summary.mpi_120.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {summary.listingCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <p><strong>Total Groups:</strong> {totalGroups}</p>
              <p><strong>Total Listings:</strong> {totalListings}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    // Determine the correct API URL based on environment
    const protocol = context.req.headers['x-forwarded-proto'] || 'http';
    const host = context.req.headers.host || 'localhost:3000';
    
    // Get grouping parameter from query string, default to 'city'
    const grouping = context.query.grouping as string || 'city';
    const apiUrl = `${protocol}://${host}/api/mpi?grouping=${grouping}`;
    
    // Call the API endpoint from the server
    const response = await fetch(apiUrl);
    const result = await response.json();
    
    if (result.success) {
      return {
        props: {
          initialData: {
            summaries: result.data.summaries,
            totalListings: result.data.totalListings,
            totalGroups: result.data.totalGroups,
            grouping: result.data.grouping,
            neighborhoodInfo: result.data.neighborhoodInfo,
            calculationStats: result.data.calculationStats,
          },
        },
      };
    } else {
      throw new Error('Failed to load data');
    }
  } catch (error) {
    console.error('Server-side error:', error);
    return {
      props: {
        initialData: {
          summaries: [],
          totalListings: 0,
          totalGroups: 0,
          grouping: 'city',
          neighborhoodInfo: {
            categories: 0,
            location: { lat: 0, lng: 0 },
            source: 'Unknown'
          },
          calculationStats: {
            existingMPIUsed: 0,
            neighborhoodCalculated: 0,
            noDataAvailable: 0,
            totalListings: 0
          },
        },
      },
    };
  }
};
