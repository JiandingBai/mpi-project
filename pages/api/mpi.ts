import { NextApiRequest, NextApiResponse } from 'next';
import { calculateMPISummaries } from '../../lib/mpi-calculator';
import { loadListingsData } from '../../lib/data-loader';

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
    
    // Load listings data (now includes PriceLabs API integration)
    const listingsData = await loadListingsData();
    
    console.log(`API: Loaded ${listingsData.listings.length} listings`);
    console.log(`API: Using grouping: ${grouping}`);
    
    // Calculate MPI summaries (now async and uses real neighborhood data)
    const { summaries, calculatedMPIs, calculationStats } = await calculateMPISummaries(listingsData, grouping);
    
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
          categories: 0, // Will be updated when we have real neighborhood data
          location: { lat: 0, lng: 0 },
          source: 'PriceLabs API'
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
