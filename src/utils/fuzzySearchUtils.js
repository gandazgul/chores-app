import Fuse from 'fuse.js';

/**
 * Initializes Fuse.js for fuzzy searching tasks.
 * @param {Array<Object>} tasks - The list of tasks to search.
 * @param {Array<String>} keys - The keys in the task objects to search against (e.g., ['name', 'description']).
 * @returns {Fuse} A Fuse instance.
 */
export function initializeFuzzySearch(tasks, keys = ['name']) {
  const options = {
    includeScore: true,
    // Search in `keys`
    keys: keys,
    // Threshold for matching (0.0 = perfect match, 1.0 = match anything)
    threshold: 0.4, // Adjust as needed
  };
  return new Fuse(tasks, options);
}

/**
 * Performs a fuzzy search on the tasks.
 * @param {Fuse} fuse - The Fuse instance.
 * @param {String} searchTerm - The term to search for.
 * @returns {Array<Object>} An array of search results (tasks).
 */
export function fuzzySearchTasks(fuse, searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') {
    // If search term is empty, return all original tasks from the fuse instance
    // Fuse stores the original list in `fuse.docs` or `fuse._docs` depending on version,
    // or more reliably, we can just return an empty array to signify no filtering.
    // For this case, let's assume the component will handle showing all tasks if search is empty.
    return []; 
  }
  const results = fuse.search(searchTerm);
  return results.map(result => result.item); // Return the actual task objects
}
