import { SaveStatus, type SaveStatusValue } from '../utils/save-status.ts';
import type { UnsavedEditsOutboxState } from './unsaved-edits-outbox.ts';

/**
 * What the save status in the top bar says, from the live connection and the outbox:
 *
 *   not connected, or outbox offline    offline   (edits wait on this device)
 *   outbox sending                      saving
 *   outbox refused an edit              failed
 *   otherwise                           saved
 *
 * Offline wins: without the live connection, the page can't tell whether it shows the latest month.
 */
export function saveStatusFor(isConnected: boolean, outboxState: UnsavedEditsOutboxState): SaveStatusValue {
  if (!isConnected || outboxState.kind === 'offline') return SaveStatus.OFFLINE;
  if (outboxState.kind === 'sending') return SaveStatus.SAVING;
  if (outboxState.kind === 'refused') return SaveStatus.FAILED;
  return SaveStatus.SAVED;
}
