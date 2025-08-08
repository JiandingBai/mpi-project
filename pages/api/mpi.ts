import { NextApiRequest, NextApiResponse } from 'next';
import { calculateMPISummaries } from '../../lib/mpi-calculator';
import { loadListingsData, loadNeighborhoodData } from '../../lib/data-loader';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('API: Starting MPI calculation...');
    
    // Get grouping parameter from query string, default to 'city'
    const grouping = req.query.grouping as string || 'city';
    
    const [listingsData, neighborhoodData] = await Promise.all([
      loadListingsData(),
      loadNeighborhoodData()
    ]);
    
    console.log(`API: Loaded ${listingsData.listings.length} listings and neighborhood data`);
    console.log(`API: Using grouping: ${grouping}`);
    
    const { summaries, calculatedMPIs, calculationStats } = calculateMPISummaries(listingsData, neighborhoodData, grouping);
    
    console.log(`API: Calculated ${summaries.length} group summaries`);
    
    res.status(200).json({
      success: true,
      data: {
        summaries,
        calculatedMPIs,
        totalListings: listingsData.listings.length,
        totalGroups: summaries.length,
        grouping,
        neighborhoodInfo: {
          categories: Object.keys(neighborhoodData.data["Market KPI"].Category).length,
          location: {
            lat: neighborhoodData.data.lat,
            lng: neighborhoodData.data.lng
          },
          source: neighborhoodData.data.source
        },
        calculationStats
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage,
      details: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        error: errorMessage
      }
    });
  }
}
