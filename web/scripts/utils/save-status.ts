/** What the status pill shows about the latest edits. */
export const SaveStatus = Object.freeze({
  SAVED: 'saved',
  SAVING: 'saving',
  FAILED: 'failed',
  OFFLINE: 'offline',
} as const);

export type SaveStatusValue = (typeof SaveStatus)[keyof typeof SaveStatus];
