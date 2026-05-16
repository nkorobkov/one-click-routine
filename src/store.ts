import { signal } from '@preact/signals';
import { fetchUserTasksForUser, upsertUserTaskForUser, upsertUserTasksForUser, deleteUserTaskForUser, insertTaskCompletion, deleteTaskCompletion, updateTaskCompletion, fetchTodaysCompletions, fetchPreviousCompletion } from './lib/supabase';
import { isLoggedIn, getCurrentUserId } from './lib/auth';

export interface Task {
  id: string;
  name: string;
  intervalDays: number;
  nextDueDate: number; // Timestamp for when task is next due
  description?: string; // Optional task description
}

export type TaskOrderMode = 'fixed' | 'priority';

const STORAGE_KEY = 'one-click-routine-tasks';
const TASK_ORDER_MODE_KEY = 'one-click-routine-task-order-mode';

export const debug = (...args: string[]) => {
  if (import.meta.env.DEV) {
    console.log('[DEBUG]:', ...args);
  }
};

// ==========================================
// Completion tracking (for undo functionality)
// ==========================================
// Track the last completion ID for undo (expires after 3 seconds)
export const lastCompletionId = signal<string | null>(null);
export const lastCompletionExpiry = signal<number>(0);

// Today's completion records, keyed by task id. Drives both the "completed
// today" indicator AND the re-tap path (so we can show Change Date / Cancel
// today's completion without a Supabase round-trip). Empty for non-logged-in.
export interface TodayCompletionInfo {
  completionId: string;
  dueDate: number; // pre-completion nextDueDate stored on the row
}
export const tasksCompletedToday = signal<Map<string, TodayCompletionInfo>>(new Map());

export async function refreshTasksCompletedToday(): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) {
    if (tasksCompletedToday.value.size !== 0) tasksCompletedToday.value = new Map();
    return;
  }
  const rows = await fetchTodaysCompletions(userId);
  const next = new Map<string, TodayCompletionInfo>();
  for (const row of rows) {
    next.set(row.task_id, { completionId: row.id, dueDate: row.due_date });
  }
  const prev = tasksCompletedToday.value;
  if (prev.size === next.size) {
    let same = true;
    for (const [taskId, info] of next) {
      const p = prev.get(taskId);
      if (!p || p.completionId !== info.completionId || p.dueDate !== info.dueDate) {
        same = false;
        break;
      }
    }
    if (same) return;
  }
  tasksCompletedToday.value = next;
}

function markCompletedTodayLocally(taskId: string, info: TodayCompletionInfo) {
  const next = new Map(tasksCompletedToday.value);
  next.set(taskId, info);
  tasksCompletedToday.value = next;
}

function unmarkCompletedTodayLocally(taskId: string) {
  if (!tasksCompletedToday.value.has(taskId)) return;
  const next = new Map(tasksCompletedToday.value);
  next.delete(taskId);
  tasksCompletedToday.value = next;
}

// Background sync helper: upsert a single task to Supabase using its current local index
function syncTaskToSupabase(task: Task): void {
  const userId = getCurrentUserId();
  if (!userId) return;
  const index = tasks.value.findIndex(t => t.id === task.id);
  upsertUserTaskForUser(userId, task, index >= 0 ? index : 0);
}

// In-flight completion inserts. Edits/cancels await the matching insert so
// the row exists before we try to UPDATE/DELETE it.
const pendingCompletionInserts = new Map<string, Promise<string | null>>();

async function awaitPendingInsert(completionId: string): Promise<boolean> {
  const pending = pendingCompletionInserts.get(completionId);
  if (!pending) return true;
  const result = await pending;
  return result !== null;
}

// ==========================================
// ID Generation
// ==========================================
function generateShortId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const byteString = String.fromCharCode(...Array.from(bytes));
  let base64 = btoa(byteString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return base64;
}

// ==========================================
// localStorage helpers
// ==========================================
function loadTasks(): Task[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const tasks = JSON.parse(stored);
      return tasks.map((task: any) => {
        if (task.nextDueDate !== undefined) {
          return task;
        } else if (task.lastCompleted !== undefined) {
          const lastCompletedDate = new Date(task.lastCompleted);
          lastCompletedDate.setHours(0, 0, 0, 0);
          const dueDate = new Date(lastCompletedDate);
          dueDate.setDate(lastCompletedDate.getDate() + task.intervalDays);
          return {
            ...task,
            nextDueDate: dueDate.getTime(),
          };
        } else {
          return {
            ...task,
            nextDueDate: calculateNextDueDate(task.intervalDays),
          };
        }
      });
    }
  } catch (e) {
    console.error('Failed to load tasks from localStorage:', e);
  }
  return [];
}

function saveTasks(taskList: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(taskList));
  } catch (e) {
    console.error('Failed to save tasks to localStorage:', e);
  }
}

// ==========================================
// Task Order Mode helpers
// ==========================================
function loadTaskOrderMode(): TaskOrderMode {
  try {
    const stored = localStorage.getItem(TASK_ORDER_MODE_KEY);
    if (stored === 'fixed' || stored === 'priority') {
      return stored;
    }
  } catch (e) {
    console.error('Failed to load task order mode from localStorage:', e);
  }
  return 'fixed'; // Default to fixed order
}

export function saveTaskOrderMode(mode: TaskOrderMode) {
  try {
    localStorage.setItem(TASK_ORDER_MODE_KEY, mode);
  } catch (e) {
    console.error('Failed to save task order mode to localStorage:', e);
  }
}

export function getTaskOrderMode(): TaskOrderMode {
  return taskOrderMode.value;
}

// Helper function to get sorted tasks based on the current order mode
export function getSortedTasks(taskList: Task[] = tasks.value): Task[] {
  if (taskOrderMode.value === 'priority') {
    // Sort by nextDueDate (earliest first)
    return [...taskList].sort((a, b) => a.nextDueDate - b.nextDueDate);
  }
  // Return tasks in fixed order (as stored)
  return taskList;
}

// ==========================================
// Signals
// ==========================================
export const tasks = signal<Task[]>(loadTasks());
export const taskOrderMode = signal<TaskOrderMode>(loadTaskOrderMode());

function getDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const currentDate = signal<string>(getDateString());

// ==========================================
// Date helpers
// ==========================================
function timestampToDateString(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(date1: string, date2: string): number {
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function getDaysRemaining(task: Task): number {
  const today = getDateString();
  const nextDueDateStr = timestampToDateString(task.nextDueDate);
  return daysBetween(today, nextDueDateStr);
}

export function getDueDate(task: Task): Date {
  const dueDate = new Date(task.nextDueDate);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate;
}

export function getDaysOverdue(task: Task): number {
  const today = getDateString();
  const nextDueDateStr = timestampToDateString(task.nextDueDate);
  const daysOverdue = daysBetween(nextDueDateStr, today);
  return daysOverdue > 0 ? daysOverdue : 0;
}

export function formatDueDate(task: Task): string {
  const dueDate = getDueDate(task);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekday = weekdays[dueDate.getDay()];
  const month = months[dueDate.getMonth()];
  const day = dueDate.getDate();
  return `${weekday} ${month} ${day}`;
}

function calculateNextDueDate(intervalDays: number, initialDaysOffset?: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = initialDaysOffset !== undefined ? initialDaysOffset : intervalDays;
  const nextDueDate = new Date(today);
  nextDueDate.setDate(today.getDate() + daysUntilDue);
  nextDueDate.setHours(0, 0, 0, 0);
  return nextDueDate.getTime();
}

// ==========================================
// Actions — PESSIMISTIC (async, Supabase-first when logged in)
// ==========================================

// Run an op against Supabase if logged in. Returns true if not logged in (local-only) or if op succeeded.
async function withSupabase(op: (userId: string) => Promise<boolean>): Promise<boolean> {
  if (!isLoggedIn()) return true;
  const userId = getCurrentUserId();
  if (!userId) return false;
  return op(userId);
}

function applyLocal(updater: (current: Task[]) => Task[]) {
  const updated = updater(tasks.value);
  tasks.value = updated;
  saveTasks(updated);
}

export async function addTask(name: string, intervalDays: number, initialDaysOffset?: number): Promise<boolean> {
  const newTask: Task = {
    id: generateShortId(),
    name,
    intervalDays,
    nextDueDate: calculateNextDueDate(intervalDays, initialDaysOffset),
  };
  const sortOrder = tasks.value.length;
  const ok = await withSupabase(uid => upsertUserTaskForUser(uid, newTask, sortOrder));
  if (!ok) return false;
  applyLocal(current => [...current, newTask]);
  return true;
}

export async function deleteTask(id: string): Promise<boolean> {
  const ok = await withSupabase(uid => deleteUserTaskForUser(uid, id));
  if (!ok) return false;
  applyLocal(current => current.filter(t => t.id !== id));
  // Background resync of shifted sort_orders
  const userId = getCurrentUserId();
  if (userId) upsertUserTasksForUser(userId, tasks.value);
  return true;
}

export async function updateTask(id: string, name: string, intervalDays: number): Promise<boolean> {
  const task = tasks.value.find(t => t.id === id);
  if (!task) return false;

  let updatedTask: Task;
  if (task.intervalDays !== intervalDays) {
    // Preserve days-elapsed-since-last-completion when interval changes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDueDate = new Date(task.nextDueDate);
    currentDueDate.setHours(0, 0, 0, 0);
    const daysRemaining = Math.floor((currentDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = task.intervalDays - daysRemaining;
    const newDueDate = new Date(today);
    newDueDate.setDate(today.getDate() + (intervalDays - daysElapsed));
    updatedTask = { ...task, name: name.trim(), intervalDays, nextDueDate: newDueDate.getTime() };
  } else {
    updatedTask = { ...task, name: name.trim(), intervalDays };
  }

  const index = tasks.value.findIndex(t => t.id === id);
  const ok = await withSupabase(uid => upsertUserTaskForUser(uid, updatedTask, index >= 0 ? index : 0));
  if (!ok) return false;
  applyLocal(current => current.map(t => t.id === id ? updatedTask : t));
  return true;
}

export async function updateTaskDescription(id: string, description: string): Promise<boolean> {
  const task = tasks.value.find(t => t.id === id);
  if (!task) return false;

  const updatedTask: Task = { ...task, description: description.trim() };
  const index = tasks.value.findIndex(t => t.id === id);
  const ok = await withSupabase(uid => upsertUserTaskForUser(uid, updatedTask, index >= 0 ? index : 0));
  if (!ok) return false;
  applyLocal(current => current.map(t => t.id === id ? updatedTask : t));
  return true;
}

// ==========================================
// Actions — OPTIMISTIC (sync local, async Supabase background)
// ==========================================

export type CompleteResult =
  | { kind: 'completed' }
  | { kind: 'already-today'; completion: { id: string; dueDate: number } | null };

// OPTIMISTIC. Returns `already-today` (instead of inserting a duplicate row)
// when the task has already been completed today, so the caller can offer
// Change Date / Cancel against the existing record.
export async function completeTask(id: string): Promise<CompleteResult> {
  const task = tasks.value.find(t => t.id === id);
  if (!task) return { kind: 'completed' };

  // Authoritative for logged-in users: the in-memory map populated on sync
  // and after each completion. No network call here.
  const cached = tasksCompletedToday.value.get(id);
  if (cached) {
    return { kind: 'already-today', completion: { id: cached.completionId, dueDate: cached.dueDate } };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newDueDate = new Date(today);
  newDueDate.setDate(today.getDate() + task.intervalDays);

  // Non-logged-in fallback: only the local nextDueDate heuristic is
  // available. No actionable record, so caller will silently no-op.
  if (!isLoggedIn() && newDueDate.getTime() === task.nextDueDate) {
    return { kind: 'already-today', completion: null };
  }

  // Calculate delay BEFORE updating the task
  const completedAt = Date.now();
  const dueDate = task.nextDueDate;
  const delayDays = (completedAt - dueDate) / (1000 * 60 * 60 * 24);

  const updated = tasks.value.map((t) =>
    t.id === id ? { ...t, nextDueDate: newDueDate.getTime() } : t
  );
  tasks.value = updated;
  saveTasks(updated);

  if (isLoggedIn()) {
    const userId = getCurrentUserId();
    if (userId) {
      // Pre-generate the row id so the toast can show Change Date / Cancel
      // immediately, without waiting on the insert round-trip.
      const completionId = crypto.randomUUID();
      lastCompletionId.value = completionId;
      lastCompletionExpiry.value = Date.now() + 6000;
      markCompletedTodayLocally(id, { completionId, dueDate });

      const insertPromise = insertTaskCompletion(userId, {
        id: completionId,
        task_id: id,
        completed_at: completedAt,
        due_date: dueDate,
        delay_days: delayDays,
        task_name: task.name,
        interval_days: task.intervalDays,
      });
      pendingCompletionInserts.set(completionId, insertPromise);
      insertPromise.then(insertedId => {
        pendingCompletionInserts.delete(completionId);
        if (!insertedId) {
          // Insert failed — roll back optimistic bookkeeping so a later
          // Change Date / Cancel doesn't try to act on a row that doesn't exist.
          if (lastCompletionId.value === completionId) {
            lastCompletionId.value = null;
            lastCompletionExpiry.value = 0;
          }
          const cur = tasksCompletedToday.value.get(id);
          if (cur && cur.completionId === completionId) {
            unmarkCompletedTodayLocally(id);
          }
        }
      });

      const updatedTask = updated.find(t => t.id === id);
      if (updatedTask) syncTaskToSupabase(updatedTask);
    }
  }

  return { kind: 'completed' };
}

export async function cancelCompletion(
  taskId: string,
  completionId: string,
  originalDueDate: number
): Promise<boolean> {
  // Wait for the original insert (if still in flight) so DELETE matches a row.
  const insertOk = await awaitPendingInsert(completionId);
  if (!insertOk) {
    // Insert failed; nothing on server to delete. Still revert local state.
    applyLocal(current =>
      current.map(t => t.id === taskId ? { ...t, nextDueDate: originalDueDate } : t)
    );
    unmarkCompletedTodayLocally(taskId);
    lastCompletionId.value = null;
    lastCompletionExpiry.value = 0;
    return true;
  }
  const ok = await deleteTaskCompletion(completionId);
  if (!ok) return false;

  applyLocal(current =>
    current.map(t => t.id === taskId ? { ...t, nextDueDate: originalDueDate } : t)
  );

  const task = tasks.value.find(t => t.id === taskId);
  if (task) syncTaskToSupabase(task);

  unmarkCompletedTodayLocally(taskId);

  lastCompletionId.value = null;
  lastCompletionExpiry.value = 0;

  return true;
}

export async function undoComplete(id: string, previousNextDueDate: number) {
  // Capture the completion id we're undoing before clearing state. The 6s
  // `lastCompletionExpiry` window is meaningless here — by the time undoComplete
  // is called, the user has explicitly asked to undo (toast Undo, or Cancel on
  // the date picker which can stay open indefinitely). Trust the caller.
  const completionIdToDelete =
    isLoggedIn() && lastCompletionId.value ? lastCompletionId.value : null;

  const updated = tasks.value.map(t =>
    t.id === id ? { ...t, nextDueDate: previousNextDueDate } : t
  );
  tasks.value = updated;
  saveTasks(updated);

  unmarkCompletedTodayLocally(id);

  if (completionIdToDelete) {
    lastCompletionId.value = null;
    lastCompletionExpiry.value = 0;
  }

  if (isLoggedIn()) {
    const task = updated.find(t => t.id === id);
    if (task) syncTaskToSupabase(task);
  }

  if (completionIdToDelete) {
    // Wait for the original insert (if still in flight) before issuing DELETE,
    // otherwise the two requests race and a successful INSERT can land after
    // our DELETE — leaving an orphan row that breaks future Change Date bounds.
    const insertOk = await awaitPendingInsert(completionIdToDelete);
    if (insertOk) {
      deleteTaskCompletion(completionIdToDelete);
    }
  }
}

// swapTasks: OPTIMISTIC — swap a task with its neighbor in the given direction
export function swapTasks(id: string, direction: -1 | 1) {
  const index = tasks.value.findIndex((t) => t.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= tasks.value.length) return;

  const updated = [...tasks.value];
  [updated[index], updated[target]] = [updated[target], updated[index]];
  tasks.value = updated;
  saveTasks(updated);

  if (isLoggedIn()) {
    const userId = getCurrentUserId();
    if (userId) upsertUserTasksForUser(userId, updated);
  }
}

// adjustTaskTime: OPTIMISTIC
export function adjustTaskTime(id: string, daysDelta: number) {
  const updated = tasks.value.map((t) => {
    if (t.id === id) {
      const currentDueDate = new Date(t.nextDueDate);
      currentDueDate.setHours(0, 0, 0, 0);
      const newDueDate = new Date(currentDueDate);
      newDueDate.setDate(currentDueDate.getDate() + daysDelta);
      return { ...t, nextDueDate: newDueDate.getTime() };
    }
    return t;
  });
  tasks.value = updated;
  saveTasks(updated);

  if (isLoggedIn()) {
    const task = updated.find(t => t.id === id);
    if (task) syncTaskToSupabase(task);
  }
}

// Earliest valid date the user can pick in the Change Date calendar:
// the day after the previous completion. Returns null if there is none.
export async function getEarliestEditableDay(
  taskId: string,
  completionId: string
): Promise<number | null> {
  const userId = getCurrentUserId();
  if (!userId) return null;
  const prev = await fetchPreviousCompletion(userId, taskId, completionId);
  if (!prev) return null;
  const d = new Date(prev.completed_at);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

export async function updateCompletionDate(
  taskId: string,
  completionId: string,
  newCompletedAt: number,
  originalDueDate: number
): Promise<boolean> {
  const task = tasks.value.find(t => t.id === taskId);
  if (!task) return false;

  const delayDays = (newCompletedAt - originalDueDate) / (1000 * 60 * 60 * 24);

  const completedDay = new Date(newCompletedAt);
  completedDay.setHours(0, 0, 0, 0);
  const newDueDate = new Date(completedDay);
  newDueDate.setDate(completedDay.getDate() + task.intervalDays);
  const newNextDueDate = newDueDate.getTime();

  // Wait for the original insert (if still in flight) so UPDATE matches a row.
  const insertOk = await awaitPendingInsert(completionId);
  if (!insertOk) return false;

  const ok = await updateTaskCompletion(completionId, {
    completed_at: newCompletedAt,
    delay_days: delayDays,
  });
  if (!ok) return false;

  applyLocal(current => current.map(t => t.id === taskId ? { ...t, nextDueDate: newNextDueDate } : t));

  const updatedTask = tasks.value.find(t => t.id === taskId);
  if (updatedTask) syncTaskToSupabase(updatedTask);

  // Indicator: stay set only if the new completion is still dated today.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const stillToday = newCompletedAt >= today.getTime() && newCompletedAt < tomorrow.getTime();
  if (stillToday) markCompletedTodayLocally(taskId, { completionId, dueDate: originalDueDate });
  else unmarkCompletedTodayLocally(taskId);

  // The undo handle no longer matches the row we just changed.
  lastCompletionId.value = null;
  lastCompletionExpiry.value = 0;

  return true;
}

// ==========================================
// Sync with Supabase (used for login, page reload, and periodic refresh)
// ==========================================

/**
 * Sync tasks with Supabase
 * - Fetches remote tasks and merges with local
 * - Remote is authoritative for name/interval/description
 * - Latest nextDueDate wins (max of local and remote)
 * - Uploads local tasks if remote is empty (first-time login)
 * - Syncs back to Supabase if local has newer nextDueDate
 * - Clears pending sync queue after successful reconciliation
 */
export async function syncTasksWithSupabase(): Promise<void> {
  if (!isLoggedIn()) return;

  const userId = getCurrentUserId();
  if (!userId) {
    debug('syncTasksWithSupabase: no user id');
    return;
  }

  const remoteTasks = await fetchUserTasksForUser(userId);
  if (remoteTasks === null) {
    debug('syncTasksWithSupabase: fetch failed');
    return; // Fetch failed, keep local state
  }

  const localTasks = tasks.value;

  // If remote is empty, upload all local tasks (first-time login)
  if (remoteTasks.length === 0) {
    if (localTasks.length > 0) {
      await upsertUserTasksForUser(userId, localTasks);
    }
    return;
  }

  // Merge: remote is authoritative for name/interval/description, latest nextDueDate wins
  const mergedTasks: Task[] = [];
  for (const remoteTask of remoteTasks) {
    const localTask = localTasks.find(t => t.id === remoteTask.id);
    if (localTask) {
      // Task exists both locally and remotely — merge
      mergedTasks.push({
        id: remoteTask.id,
        name: remoteTask.name,               // name from remote
        intervalDays: remoteTask.intervalDays, // interval from remote
        nextDueDate: Math.max(localTask.nextDueDate, remoteTask.nextDueDate), // latest due date
        description: remoteTask.description || '', // description from remote
      });
    } else {
      // Task only exists remotely — add it
      mergedTasks.push({
        id: remoteTask.id,
        name: remoteTask.name,
        intervalDays: remoteTask.intervalDays,
        nextDueDate: remoteTask.nextDueDate,
        description: remoteTask.description || '',
      });
    }
  }
  // Note: local tasks with IDs not in remote are deleted (not added to merged)

  // Update local state
  tasks.value = mergedTasks;
  saveTasks(mergedTasks);

  // Sync back to Supabase if we have newer nextDueDate values
  const remoteMap = new Map(remoteTasks.map(t => [t.id, t]));
  const needsSync = mergedTasks.some(mt => {
    const remote = remoteMap.get(mt.id);
    return remote && mt.nextDueDate !== remote.nextDueDate;
  });

  if (needsSync) {
    await upsertUserTasksForUser(userId, mergedTasks);
  }

  refreshTasksCompletedToday();

  debug('syncTasksWithSupabase: synced', String(mergedTasks.length), 'tasks');
}

// ==========================================
// Midnight date change detection
// ==========================================

export async function checkDayChange() {
  debug('checkDayChange');
  const today = getDateString();
  if (currentDate.value !== today) {
    debug('day changed', currentDate.value, today);
    currentDate.value = today;

    // Yesterday's completions are no longer "today" — clear before the
    // post-rollover sync so the badge resets even if the sync fails.
    if (tasksCompletedToday.value.size !== 0) {
      tasksCompletedToday.value = new Map();
    }

    await syncTasksWithSupabase();

    tasks.value = [...tasks.value];
  }
}

