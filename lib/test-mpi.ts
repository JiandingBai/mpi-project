import { calculateMPISummaries, logMPISummaries } from './mpi-calculator';
import { loadListingsData, loadNeighborhoodData } from './data-loader';

async function testMPICalculations() {
  try {
    console.log('Loading listings data...');
    const listingsData = await loadListingsData();
    console.log(`Loaded ${listingsData.listings.length} listings`);
    
    console.log('Loading neighborhood data...');
    const neighborhoodData = await loadNeighborhoodData();
    console.log(`Loaded neighborhood data with ${Object.keys(neighborhoodData.data["Market KPI"].Category).length} categories`);
    
    console.log('\nCalculating MPI summaries...');
    const { summaries, calculatedMPIs } = calculateMPISummaries(listingsData, neighborhoodData);
    
    console.log(`\nFound ${summaries.length} groups:`);
    summaries.forEach(summary => {
      console.log(`- ${summary.group}: ${summary.listingCount} listings`);
    });
    
    console.log('\nMPI Summary Table:');
    logMPISummaries(summaries);
    
    // Show some sample calculations
    console.log('\nSample individual MPI calculations:');
    const sampleMPIs = calculatedMPIs.slice(0, 3);
    sampleMPIs.forEach(mpi => {
      console.log(`Listing ${mpi.listingId} (${mpi.group}):`);
      console.log(`  7-day: ${mpi.mpi_7.toFixed(2)}`);
      console.log(`  30-day: ${mpi.mpi_30.toFixed(2)}`);
      console.log(`  60-day: ${mpi.mpi_60.toFixed(2)}`);
      console.log(`  90-day: ${mpi.mpi_90.toFixed(2)}`);
      console.log(`  120-day: ${mpi.mpi_120.toFixed(2)}`);
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
  testMPICalculations();
}
