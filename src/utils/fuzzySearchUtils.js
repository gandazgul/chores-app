import Fuse from 'fuse.js';

/**
 * Initializes Fuse.js for fuzzy searching chores.
 * @param {Array<Object>} chores - The list of chores to search.
 * @param {Array<String>} keys - The keys in the chore objects to search against (e.g., ['name', 'description']).
 * @returns {Fuse} A Fuse instance.
 */
export function initializeFuzzySearch(chores, keys = ['name']) {
  const options = {
    includeScore: true,
    // Search in `keys`
    keys: keys,
    // Threshold for matching (0.0 = perfect match, 1.0 = match anything)
    threshold: 0.4, // Adjust as needed
  };
  return new Fuse(chores, options);
}

/**
 * Performs a fuzzy search on the chores.
 * @param {Fuse} fuse - The Fuse instance.
 * @param {String} searchTerm - The term to search for.
 * @returns {Array<Object>} An array of search results (chores).
 */
export function fuzzySearchChores(fuse, searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') {
    // If search term is empty, return all original chores from the fuse instance
    // Fuse stores the original list in `fuse.docs` or `fuse._docs` depending on version,
    // or more reliably, we can just return an empty array to signify no filtering.
    // For this case, let's assume the component will handle showing all chores if search is empty.
    return []; 
  }
  const results = fuse.search(searchTerm);
  return results.map(result => result.item); // Return the actual chore objects
}
