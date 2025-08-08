import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { MPISummary } from '../types';

interface HomeProps {
  initialData: {
    summaries: MPISummary[];
    totalListings: number;
    totalGroups: number;
  };
}

export default function Home({ initialData }: HomeProps) {
  const [summaries, setSummaries] = useState<MPISummary[]>(initialData.summaries);

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
  }, [summaries]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              Market Penetration Index (MPI) Summary
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Average MPI values grouped by property location
            </p>
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
              <p><strong>Total Groups:</strong> {initialData.totalGroups}</p>
              <p><strong>Total Listings:</strong> {initialData.totalListings}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Call the API endpoint from the server
    const response = await fetch('http://localhost:3000/api/mpi');
    const result = await response.json();
    
    if (result.success) {
      return {
        props: {
          initialData: {
            summaries: result.data.summaries,
            totalListings: result.data.totalListings,
            totalGroups: result.data.totalGroups,
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
        },
      },
    };
  }
};
