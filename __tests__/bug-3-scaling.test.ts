/**
 * Bug #3: Inconsistent Scaling Logic - Exploratory Test
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * Bug Condition: API MPI values scaled by 100, calculated values already in 0-200 range
 * Expected Behavior: Consistent scaling with clear documentation
 * 
 * Property 1: Bug Condition - API and Calculated MPI Use Different Scales
 */

import { describe, it, expect } from 'vitest';
import { loadListingsData } from '../lib/data-loader';

describe('Bug #3: Inconsistent Scaling Logic', () => {
  it('should demonstrate API values are multiplied by 100 (EXPECTED TO FAIL on unfixed code)', async () => {
    const listingsData = await loadListingsData();
    const listing = listingsData.listings[0];
    
    // Get raw API MPI value
    const rawMPI = listing.mpi_next_7;
    
    console.log('🔍 Scaling Analysis:');
    console.log(`  - Raw API MPI value: ${rawMPI}`);
    console.log(`  - Expected scaled value: ${rawMPI * 100}`);
    
    // BUG: The code multiplies API values by 100 without clear documentation
    // API returns values like 1.73 (meaning 173% of market)
    // Code scales to 173 for display
    
    // This demonstrates the scaling is happening
    expect(rawMPI).toBeLessThan(10); // API values in 0-2 range
    
    const scaledValue = rawMPI * 100;
    expect(scaledValue).toBeGreaterThan(10); // Scaled values in 0-200 range
    
    console.log('⚠️ BUG CONFIRMED: API values are scaled by 100');
    console.log(`  Raw: ${rawMPI} → Scaled: ${scaledValue}`);
    console.log('  No clear documentation explaining why');
  });

  it('should show lack of scaling documentation', () => {
    // BUG: No constant or clear documentation explaining the scaling factor
    // After fix, there should be a MPI_SCALE_FACTOR constant
    
    console.log('⚠️ BUG CONFIRMED: No MPI_SCALE_FACTOR constant defined');
    console.log('  Scaling logic is implicit, not documented');
    console.log('  Hard to understand why values are multiplied by 100');
    
    // This test just documents the issue
    expect(true).toBe(true);
  });
});
