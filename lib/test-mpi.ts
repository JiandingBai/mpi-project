import { calculateMPISummaries, logMPISummaries } from './mpi-calculator';
import { loadListingsData } from './data-loader';

async function testMPICalculations() {
  try {
    console.log('Loading listings data...');
    const listingsData = await loadListingsData();
    console.log(`Loaded ${listingsData.listings.length} listings`);
    
    console.log('\nCalculating MPI summaries...');
    const { summaries, calculatedMPIs } = await calculateMPISummaries(listingsData, 'city');
    
    console.log(`\nFound ${summaries.length} groups:`);
    summaries.forEach(summary => {
      console.log(`  Group: ${summary.group}, Listings: ${summary.listingCount}`);
    });
    
    logMPISummaries(summaries);
    
    console.log('\nIndividual Calculated MPIs (first 5):');
    console.table(calculatedMPIs.slice(0, 5));
    
  } catch (error) {
    console.error('Error during MPI calculation test:', error);
  }
}

testMPICalculations();
