import { ListingsData } from '../types';

/**
 * Load listings data from the public directory (client-side only)
 */
export async function loadListingsData(): Promise<ListingsData> {
  try {
    const response = await fetch('/listings.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data as ListingsData;
  } catch (error) {
    console.error('Error loading listings data:', error);
    throw new Error('Failed to load listings data');
  }
}

/**
 * Load neighborhood data from the public directory (client-side only)
 */
export async function loadNeighborhoodData(): Promise<any> {
  try {
    const response = await fetch('/neighborhood.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading neighborhood data:', error);
    throw new Error('Failed to load neighborhood data');
  }
}
