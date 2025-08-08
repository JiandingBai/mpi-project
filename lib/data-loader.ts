import { ListingsData } from '../types';

/**
 * Load listings data from the public directory
 */
export async function loadListingsData(): Promise<ListingsData> {
  try {
    // Check if we're in a server environment
    if (typeof window === 'undefined') {
      // Server-side: use fs to read the file
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public', 'listings.json');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent) as ListingsData;
    } else {
      // Client-side: use fetch
      const response = await fetch('/listings.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data as ListingsData;
    }
  } catch (error) {
    console.error('Error loading listings data:', error);
    throw new Error('Failed to load listings data');
  }
}

/**
 * Load neighborhood data from the public directory (if needed)
 */
export async function loadNeighborhoodData(): Promise<any> {
  try {
    // Check if we're in a server environment
    if (typeof window === 'undefined') {
      // Server-side: use fs to read the file
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public', 'neighborhood.json');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent);
    } else {
      // Client-side: use fetch
      const response = await fetch('/neighborhood.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error('Error loading neighborhood data:', error);
    throw new Error('Failed to load neighborhood data');
  }
}
