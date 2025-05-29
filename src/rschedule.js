// src/rschedule.js

// Setup the date adapter for rSchedule
// This line is crucial and should come before other rSchedule imports if it performs global setup.
// However, the docs show it as an import for side effects for some adapters.
// For StandardDateAdapter, it seems we primarily need to export it and pass it to rules.
// The key is that rSchedule objects will be created using this adapter.
import '@rschedule/standard-date-adapter/setup';

export * from '@rschedule/standard-date-adapter';

// Re-export everything from core
export * from '@rschedule/core';

// Re-export generators if needed (optional, but good practice if used)
export * from '@rschedule/core/generators';

// If you were using JSON or ICAL tools, you'd import their setup and re-export them here too.
// e.g.:
// import '@rschedule/json-tools/setup';
// export * from '@rschedule/json-tools';
