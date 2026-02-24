import type { TaskCompletion } from './supabase';

/**
 * Calculate integer days late (0 if on-time or early)
 */
function getDaysLate(delay_days: number): number {
  return delay_days >= 1 ? Math.floor(delay_days) : 0;
}

/**
 * Calculate integer days early (0 if on-time or late)
 */
function getDaysEarly(delay_days: number): number {
  return delay_days <= -1 ? Math.floor(-delay_days) : 0;
}

export interface GlobalStats {
  totalCompletions: number;
  averageDaysLate: number; // Average of late completions only (on-time/early count as 0)
  averageDaysEarly: number; // Average of early completions only (on-time/late count as 0)
  totalDaysLate: number; // Integer sum of days late
  totalDaysEarly: number; // Integer sum of days early
  onTimeRate: number; // Percentage (0-100) - completed on the exact due day
  shouldSuggestIntervalAdjustment: boolean; // True if avg early > 1 day
}

export interface TaskStats extends GlobalStats {
  taskId: string;
  taskName: string;
  lastCompleted: number | null; // Timestamp or null if no completions
  completionHistory: Array<{
    date: number; // Timestamp
    delay: number; // Days (can be negative)
  }>;
}

/**
 * Compute global statistics from all completions
 */
export function computeGlobalStats(completions: TaskCompletion[]): GlobalStats {
  if (completions.length === 0) {
    return {
      totalCompletions: 0,
      averageDaysLate: 0,
      averageDaysEarly: 0,
      totalDaysLate: 0,
      totalDaysEarly: 0,
      onTimeRate: 0,
      shouldSuggestIntervalAdjustment: false
    };
  }

  const totalCompletions = completions.length;

  // Calculate integer days late/early for each completion
  const lateCompletions = completions.map(c => getDaysLate(c.delay_days));
  const earlyCompletions = completions.map(c => getDaysEarly(c.delay_days));

  // Total days late (integer sum, on-time/early count as 0)
  const totalDaysLate = lateCompletions.reduce((sum, days) => sum + days, 0);

  // Average days late (count on-time/early as 0 in the average)
  const averageDaysLate = totalDaysLate / totalCompletions;

  // Total days early (integer sum, on-time/late count as 0)
  const totalDaysEarly = earlyCompletions.reduce((sum, days) => sum + days, 0);

  // Average days early (count on-time/late as 0 in the average)
  const averageDaysEarly = totalDaysEarly / totalCompletions;

  // On-time rate: completed on the same calendar day as due date
  // This means -1 < delay_days < 1
  const onTimeCount = completions.filter(c => Math.abs(c.delay_days) < 1).length;
  const onTimeRate = (onTimeCount / totalCompletions) * 100;

  // Suggest interval adjustment if consistently early by more than 1 day on average
  const shouldSuggestIntervalAdjustment = averageDaysEarly > 1;

  return {
    totalCompletions,
    averageDaysLate,
    averageDaysEarly,
    totalDaysLate,
    totalDaysEarly,
    onTimeRate,
    shouldSuggestIntervalAdjustment
  };
}

/**
 * Compute per-task statistics
 */
export function computeTaskStats(
  completions: TaskCompletion[],
  taskId: string
): TaskStats | null {
  const taskCompletions = completions.filter(c => c.task_id === taskId);

  if (taskCompletions.length === 0) {
    return null;
  }

  const globalStats = computeGlobalStats(taskCompletions);
  const taskName = taskCompletions[0].task_name; // Use most recent name
  const lastCompleted = Math.max(...taskCompletions.map(c => c.completed_at));

  const completionHistory = taskCompletions
    .map(c => ({ date: c.completed_at, delay: c.delay_days }))
    .sort((a, b) => a.date - b.date); // Sort chronologically

  return {
    ...globalStats,
    taskId,
    taskName,
    lastCompleted,
    completionHistory
  };
}

/**
 * Get list of all tasks with their stats (for per-task breakdown table)
 */
export function computeAllTaskStats(completions: TaskCompletion[]): TaskStats[] {
  const taskIds = [...new Set(completions.map(c => c.task_id))];

  return taskIds
    .map(taskId => computeTaskStats(completions, taskId))
    .filter((stats): stats is TaskStats => stats !== null)
    .sort((a, b) => b.totalCompletions - a.totalCompletions); // Sort by most completed
}
