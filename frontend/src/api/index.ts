/**
 * API switcher — the ONLY file the rest of the app imports from.
 *
 * To switch data source, change ONE line below:
 *
 *   export * from './real';      ← real HTTP API  (default)
 *   export * from './mock';      ← instant mock data
 *   export * from './mockSlow';  ← mock with 2 s delay (test loading states)
 */

// ↓ Change this line to switch the data source globally
// export * from './real';
export * from './mock';
// export * from './mockSlow';
