import { NextApiRequest, NextApiResponse } from 'next';
import { calculateMPISummaries, calculateMPIComparisons } from '../../lib/mpi-calculator';
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
    
    // Get parameters from query string
    const grouping = req.query.grouping as string || 'city';
    const compare = req.query.compare === 'true';
    
    // Load listings data (now includes PriceLabs API integration)
    const listingsData = await loadListingsData();
    
    console.log(`API: Loaded ${listingsData.listings.length} listings`);
    console.log(`API: Using grouping: ${grouping}`);
    console.log(`API: Comparison mode: ${compare}`);

    if (compare) {
      // Calculate MPI comparisons (API vs neighborhood calculations)
      const { summaries: comparisonSummaries, comparisons } = await calculateMPIComparisons(listingsData, grouping);

      console.log(`API: Calculated ${comparisonSummaries.length} comparison group summaries`);

      res.status(200).json({
        success: true,
        mode: 'comparison',
        data: {
          summaries: comparisonSummaries,
          comparisons,
          totalListings: listingsData.listings.length,
          totalGroups: comparisonSummaries.length,
          grouping,
          neighborhoodInfo: {
            categories: 0,
            location: { lat: 0, lng: 0 },
            source: 'PriceLabs API'
          }
        }
      });
    } else {
      // Calculate MPI summaries (normal mode)
      const { summaries, calculatedMPIs, calculationStats } = await calculateMPISummaries(listingsData, grouping);
      
      console.log(`API: Calculated ${summaries.length} group summaries`);
      
      res.status(200).json({
        success: true,
        mode: 'normal',
        data: {
          summaries,
          calculatedMPIs,
          totalListings: listingsData.listings.length,
          totalGroups: summaries.length,
          grouping,
          neighborhoodInfo: {
            categories: 0,
            location: { lat: 0, lng: 0 },
            source: 'PriceLabs API'
          },
          calculationStats
        }
      });
    }
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
