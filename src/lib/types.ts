/** A calendar date in local time, formatted YYYY-MM-DD. */
export type ISODate = string;

export type HabitType = 'daily' | 'weekly';

export interface Habit {
  id: string;
  name: string;
  color: string;
  type: HabitType;
  sortOrder: number;
  createdOn: ISODate;
  /** Hidden from this date on; history before it is kept. */
  archivedOn: ISODate | null;
  /** Reserved for template sharing (post-MVP). */
  sourceTemplateHabitId: string | null;
}

export interface Subtask {
  id: string;
  habitId: string;
  name: string;
  sortOrder: number;
  createdOn: ISODate;
  archivedOn: ISODate | null;
}

/** Weekly target in effect from `weekStart` until the next entry. */
export interface TargetHistory {
  id: string;
  habitId: string;
  weekStart: ISODate;
  target: number;
}

export interface CheckIn {
  /** `${habitId}|${subtaskId}|${date}` — makes check-ins unique by construction. */
  id: string;
  habitId: string;
  /** Empty string when the check-in is for the habit itself. */
  subtaskId: string;
  date: ISODate;
}

export interface Settings {
  id: 'settings';
  /** Percent of daily habits needed for a day to count as hit (50–100). */
  dailyThreshold: number;
  /** Week start of the last week summary the user has seen. */
  lastSummarySeen: ISODate | null;
}

export interface AppData {
  habits: Habit[];
  subtasks: Subtask[];
  targets: TargetHistory[];
  checkIns: CheckIn[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { id: 'settings', dailyThreshold: 100, lastSummarySeen: null };

export function checkInId(habitId: string, subtaskId: string, date: ISODate): string {
  return `${habitId}|${subtaskId}|${date}`;
}
