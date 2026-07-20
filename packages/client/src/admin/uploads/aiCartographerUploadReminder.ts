/**
 * Periodic reminder when AI Cartographer is already enabled: confirm once per
 * interval so users don't accidentally send sensitive uploads to AI analysis.
 */

/** How long after a confirmation before the reminder may appear again. */
export const AI_CARTOGRAPHER_UPLOAD_REMINDER_INTERVAL_MS = 48 * 60 * 60 * 1000;

const STORAGE_KEY_PREFIX = "seasketch:aiCartographerUploadReminderConfirmedAt:";

function storageKey(userId: number): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

export function getAiCartographerUploadReminderConfirmedAt(
  userId: number
): number | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setAiCartographerUploadReminderConfirmedAt(
  userId: number,
  at: number = Date.now()
): void {
  try {
    window.localStorage.setItem(storageKey(userId), String(at));
  } catch (e) {
    console.error(e);
  }
}

/**
 * True when the user has AI Cartographer enabled and has not confirmed within
 * the reminder interval (including never confirmed).
 */
export function needsAiCartographerUploadReminder(userId: number): boolean {
  const last = getAiCartographerUploadReminderConfirmedAt(userId);
  if (last == null) {
    return true;
  }
  return Date.now() - last >= AI_CARTOGRAPHER_UPLOAD_REMINDER_INTERVAL_MS;
}
