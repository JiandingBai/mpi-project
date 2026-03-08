/**
 * Bug #2: Dead Code Path - Exploratory Test
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * Bug Condition: Neighborhood fallback never executes because API always provides mpi_next_X values
 * Expected Behavior: Fallback should execute when API values are genuinely missing
 * 
 * Property 1: Bug Condition - Neighborhood Fallback Never Executes
 */

import { describe, it, expect } from 'vitest';
import { calculateMPISummaries } from '../lib/mpi-calculator';
import { loadListingsData } from '../lib/data-loader';

describe('Bug #2: Dead Code Path', () => {
  it('should show neighborhoodCalculated always equals 0 (EXPECTED TO FAIL on unfixed code)', async () => {
    // Load real listings data
    const listingsData = await loadListingsData();
    
    // Calculate MPI summaries
    const result = await calculateMPISummaries(listingsData, 'city');
    
    // BUG: calculationStats.neighborhoodCalculated is always 0
    // because the condition `if (existingMPI !== undefined && existingMPI !== null && existingMPI >= 0)`
    // always evaluates to true (API always provides mpi_next_X values, even if 0)
    
    console.log('📊 Calculation Statistics:');
    console.log(`  - Existing MPI used: ${result.calculationStats.existingMPIUsed}`);
    console.log(`  - Neighborhood calculated: ${result.calculationStats.neighborhoodCalculated}`);
    console.log(`  - No data available: ${result.calculationStats.noDataAvailable}`);
    console.log(`  - Total listings: ${result.calculationStats.totalListings}`);
    
    // This assertion confirms the bug: neighborhood calculation never runs
    expect(result.calculationStats.neighborhoodCalculated).toBe(0);
    
    // All calculations use existing API values
    expect(result.calculationStats.existingMPIUsed).toBeGreaterThan(0);
    
    console.log('⚠️ BUG CONFIRMED: Neighborhood fallback never executes');
    console.log('  All listings use existing API MPI values');
    console.log('  Fallback code path is dead code');
  });

  it('should demonstrate API always provides mpi_next_X values', async () => {
    const listingsData = await loadListingsData();
    
    // Check if any listing has undefined/null mpi_next_X values
    let hasUndefinedMPI = false;
    let hasNullMPI = false;
    let hasNegativeMPI = false;
    
    for (const listing of listingsData.listings) {
      const timeframes = [7, 30, 60, 90, 120] as const;
      for (const timeframe of timeframes) {
        const mpiField = `mpi_next_${timeframe}` as keyof typeof listing;
        const mpiValue = listing[mpiField];
        
        if (mpiValue === undefined) hasUndefinedMPI = true;
        if (mpiValue === null) hasNullMPI = true;
        if (typeof mpiValue === 'number' && mpiValue < 0) hasNegativeMPI = true;
      }
    }
    
    console.log('📋 API MPI Value Analysis:');
    console.log(`  - Has undefined MPI: ${hasUndefinedMPI}`);
    console.log(`  - Has null MPI: ${hasNullMPI}`);
    console.log(`  - Has negative MPI: ${hasNegativeMPI}`);
    
    // BUG: API always provides values, so fallback condition never triggers
    expect(hasUndefinedMPI).toBe(false);
    expect(hasNullMPI).toBe(false);
    
    console.log('⚠️ BUG CONFIRMED: API always provides mpi_next_X values');
    console.log('  Condition check never fails, fallback never runs');
  });
});
