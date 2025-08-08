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
    const listingsData = await loadListingsData();
    const { summaries, calculatedMPIs } = calculateMPISummaries(listingsData);
    
    res.status(200).json({
      success: true,
      data: {
        summaries,
        calculatedMPIs,
        totalListings: listingsData.listings.length,
        totalGroups: summaries.length,
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}
