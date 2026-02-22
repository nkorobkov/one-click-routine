import { signal } from '@preact/signals';
import { fetchUserTasksForUser, upsertUserTaskForUser, upsertUserTasksForUser, deleteUserTaskForUser } from './lib/supabase';
import { isLoggedIn, getCurrentUserId } from './lib/auth';

export interface Task {
  id: string;
  name: string;
  intervalDays: number;
  nextDueDate: number; // Timestamp for when task is next due
}

const STORAGE_KEY = 'one-click-routine-tasks';
const PENDING_SYNC_KEY = 'one-click-routine-pending-sync';

export const debug = (...args: string[]) => {
  if (import.meta.env.DEV) {
    console.log('[DEBUG]:', ...args);
  }
};

// ==========================================
// Pending sync queue (for optimistic ops)
// ==========================================
function loadPendingSyncs(): Set<string> {
  try {
    const stored = localStorage.getItem(PENDING_SYNC_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {}
  return new Set();
}

function savePendingSyncs(ids: Set<string>) {
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify([...ids]));
  } catch {}
}

export const pendingSyncIds = signal<Set<string>>(loadPendingSyncs());

function addPendingSync(taskId: string) {
  const updated = new Set(pendingSyncIds.value);
  updated.add(taskId);
  pendingSyncIds.value = updated;
  savePendingSyncs(updated);
}

function removePendingSync(taskId: string) {
  const updated = new Set(pendingSyncIds.value);
  updated.delete(taskId);
  pendingSyncIds.value = updated;
  savePendingSyncs(updated);
}

function clearAllPendingSyncs() {
  pendingSyncIds.value = new Set();
  savePendingSyncs(new Set());
}

// Background sync helper: upsert a single task to Supabase
async function syncTaskToSupabase(task: Task): Promise<boolean> {
  const userId = getCurrentUserId();
  if (!userId) return false;
  const index = tasks.value.findIndex(t => t.id === task.id);
  const success = await upsertUserTaskForUser(userId, task, index >= 0 ? index : 0);
  if (success) {
    removePendingSync(task.id);
  }
  return success;
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
// Signals
// ==========================================
export const tasks = signal<Task[]>(loadTasks());

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

// addTask: PESSIMISTIC — tries Supabase first when logged in
export async function addTask(name: string, intervalDays: number, initialDaysOffset?: number): Promise<boolean> {
  try {
    const nextDueDate = calculateNextDueDate(intervalDays, initialDaysOffset);

    const newTask: Task = {
      id: generateShortId(),
      name,
      intervalDays,
      nextDueDate,
    };

    if (isLoggedIn()) {
      const userId = getCurrentUserId();
      if (!userId) {
        debug('addTask: logged in but no user id in signal');
        return false;
      }
      const sortOrder = tasks.value.length;
      const success = await upsertUserTaskForUser(userId, newTask, sortOrder);
      if (!success) {
        debug('addTask: Supabase upsert failed');
        return false;
      }
    }

    const updated = [...tasks.value, newTask];
    tasks.value = updated;
    saveTasks(updated);
    return true;
  } catch (err) {
    console.error('[addTask] Unexpected error:', err);
    return false;
  }
}

// deleteTask: PESSIMISTIC — tries Supabase first when logged in
export async function deleteTask(id: string): Promise<boolean> {
  try {
    if (isLoggedIn()) {
      const userId = getCurrentUserId();
      if (!userId) {
        debug('deleteTask: logged in but no user id in signal');
        return false;
      }
      const success = await deleteUserTaskForUser(userId, id);
      if (!success) {
        debug('deleteTask: Supabase delete failed');
        return false;
      }
    }

    const updated = tasks.value.filter((t) => t.id !== id);
    tasks.value = updated;
    saveTasks(updated);

    // Sync updated sort orders in background (indices shifted after delete)
    if (isLoggedIn()) {
      const userId = getCurrentUserId();
      if (!userId) {
        debug('deleteTask: logged in but no user id for sort order sync');
      } else {
        upsertUserTasksForUser(userId, updated).catch((err) => {
        console.error('[deleteTask] Background sort order sync failed:', err);
        // Sort order sync failed, not critical — will converge on next full sync
        });
      }
    }

    return true;
  } catch (err) {
    console.error('[deleteTask] Unexpected error:', err);
    return false;
  }
}

// updateTask: PESSIMISTIC — tries Supabase first when logged in
export async function updateTask(id: string, name: string, intervalDays: number): Promise<boolean> {
  try {
    const task = tasks.value.find(t => t.id === id);
    if (!task) {
      debug('updateTask: Task not found:', id);
      return false;
    }

    let updatedTask: Task;
    if (task.intervalDays !== intervalDays) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const currentDueDate = new Date(task.nextDueDate);
      currentDueDate.setHours(0, 0, 0, 0);

      const daysRemaining = Math.floor((currentDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const daysElapsed = task.intervalDays - daysRemaining;
      const newDaysRemaining = intervalDays - daysElapsed;

      const newDueDate = new Date(today);
      newDueDate.setDate(today.getDate() + newDaysRemaining);

      updatedTask = { ...task, name: name.trim(), intervalDays, nextDueDate: newDueDate.getTime() };
    } else {
      updatedTask = { ...task, name: name.trim(), intervalDays };
    }

    if (isLoggedIn()) {
      const index = tasks.value.findIndex(t => t.id === id);
      const userId = getCurrentUserId();
      if (!userId) {
        debug('updateTask: logged in but no user id in signal');
        return false;
      }
      const success = await upsertUserTaskForUser(userId, updatedTask, index >= 0 ? index : 0);
      if (!success) {
        debug('updateTask: Supabase upsert failed');
        return false;
      }
    }

    const updated = tasks.value.map(t => t.id === id ? updatedTask : t);
    tasks.value = updated;
    saveTasks(updated);
    return true;
  } catch (err) {
    console.error('[updateTask] Unexpected error:', err);
    return false;
  }
}

// ==========================================
// Actions — OPTIMISTIC (sync local, async Supabase background)
// ==========================================

// completeTask: OPTIMISTIC — updates local immediately, syncs in background
export function completeTask(id: string) {
  const updated = tasks.value.map((t) => {
    if (t.id === id) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newDueDate = new Date(today);
      newDueDate.setDate(today.getDate() + t.intervalDays);
      return { ...t, nextDueDate: newDueDate.getTime() };
    }
    return t;
  });
  tasks.value = updated;
  saveTasks(updated);

  if (isLoggedIn()) {
    const task = updated.find(t => t.id === id);
    if (task) {
      syncTaskToSupabase(task).then(success => {
        if (!success) addPendingSync(id);
      });
    }
  }
}

// undoComplete: OPTIMISTIC — restores previous nextDueDate, syncs in background
export function undoComplete(id: string, previousNextDueDate: number) {
  const updated = tasks.value.map(t =>
    t.id === id ? { ...t, nextDueDate: previousNextDueDate } : t
  );
  tasks.value = updated;
  saveTasks(updated);

  if (isLoggedIn()) {
    const task = updated.find(t => t.id === id);
    if (task) {
      syncTaskToSupabase(task).then(success => {
        if (!success) addPendingSync(id);
      });
    }
  }
}

// moveTaskUp: OPTIMISTIC
export function moveTaskUp(id: string) {
  const index = tasks.value.findIndex((t) => t.id === id);
  if (index > 0) {
    const updated = [...tasks.value];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    tasks.value = updated;
    saveTasks(updated);

    if (isLoggedIn()) {
      const userId = getCurrentUserId();
      if (!userId) {
        debug('moveTaskUp: logged in but no user id in signal');
      } else {
        upsertUserTasksForUser(userId, updated).then((success: boolean) => {
          if (!success) {
            addPendingSync(updated[index].id);
            addPendingSync(updated[index - 1].id);
          }
        });
      }
    }
  }
}

// moveTaskDown: OPTIMISTIC
export function moveTaskDown(id: string) {
  const index = tasks.value.findIndex((t) => t.id === id);
  if (index >= 0 && index < tasks.value.length - 1) {
    const updated = [...tasks.value];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    tasks.value = updated;
    saveTasks(updated);

    if (isLoggedIn()) {
      const userId = getCurrentUserId();
      if (!userId) {
        debug('moveTaskDown: logged in but no user id in signal');
      } else {
        upsertUserTasksForUser(userId, updated).then((success: boolean) => {
          if (!success) {
            addPendingSync(updated[index].id);
            addPendingSync(updated[index + 1].id);
          }
        });
      }
    }
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
    if (task) {
      syncTaskToSupabase(task).then(success => {
        if (!success) addPendingSync(id);
      });
    }
  }
}

// ==========================================
// Login sync / merge logic
// ==========================================

export async function syncTasksOnLogin(): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) {
    debug('syncTasksOnLogin: no user id, aborting');
    return;
  }

  const remoteTasks = await fetchUserTasksForUser(userId);
  if (remoteTasks === null) return; // fetch failed, don't do anything

  const localTasks = tasks.value;

  if (remoteTasks.length === 0) {
    // First-time login (no tasks in Supabase) — upload all local tasks as-is
    if (localTasks.length > 0) {
      await upsertUserTasksForUser(userId, localTasks);
    }
    // Clear pending syncs since we just did a full upload
    clearAllPendingSyncs();
    return;
  }

  // Merge: remote is authoritative for name/period, latest nextDueDate wins
  const remoteMap = new Map(remoteTasks.map(t => [t.id, t]));
  const mergedTasks: Task[] = [];

  // Process all remote tasks (they define the canonical set)
  for (const remoteTask of remoteTasks) {
    const localTask = localTasks.find(t => t.id === remoteTask.id);
    if (localTask) {
      // Task exists both locally and remotely — merge
      mergedTasks.push({
        id: remoteTask.id,
        name: remoteTask.name,               // name from online
        intervalDays: remoteTask.intervalDays, // period from online
        nextDueDate: Math.max(localTask.nextDueDate, remoteTask.nextDueDate), // latest due date
      });
    } else {
      // Task only exists online — add it
      mergedTasks.push({
        id: remoteTask.id,
        name: remoteTask.name,
        intervalDays: remoteTask.intervalDays,
        nextDueDate: remoteTask.nextDueDate,
      });
    }
  }
  // Rule 3.1: local tasks with IDs not online are deleted (not added to merged)

  // Update local state
  tasks.value = mergedTasks;
  saveTasks(mergedTasks);

  // If any merged tasks have a different nextDueDate than remote, sync back
  const needsSync = mergedTasks.some(mt => {
    const remote = remoteMap.get(mt.id);
    return remote && mt.nextDueDate !== remote.nextDueDate;
  });

  if (needsSync) {
    await upsertUserTasksForUser(userId, mergedTasks);
  }

  // Clear pending syncs since we just did a full merge
  clearAllPendingSyncs();
}

// ==========================================
// Pending sync retry (called periodically)
// ==========================================

export async function retrySyncPending(): Promise<void> {
  if (!isLoggedIn()) return;
  if (pendingSyncIds.value.size === 0) return;

  debug('Retrying pending syncs:', [...pendingSyncIds.value].join(', '));

  const idsToSync = [...pendingSyncIds.value];
  for (const taskId of idsToSync) {
    const task = tasks.value.find(t => t.id === taskId);
    if (task) {
      await syncTaskToSupabase(task);
    } else {
      // Task no longer exists locally — remove from pending
      removePendingSync(taskId);
    }
  }
}

// Auto-retry pending syncs every 60 seconds
setInterval(() => {
  retrySyncPending().catch(err => {
    debug('Pending sync retry error:', String(err));
  });
}, 60000);

// ==========================================
// Midnight date change detection
// ==========================================

export function checkDayChange() {
  debug('checkDayChange');
  const today = getDateString();
  if (currentDate.value !== today) {
    debug('day changed', currentDate.value, today);
    currentDate.value = today;
    tasks.value = [...tasks.value];
  }
}

// ==========================================
// Magic link sharing (unchanged)
// ==========================================

interface ShareableTask {
  id: string;
  n: string;
  i: number;
  nd: number;
  lc?: number;
}

function encodeUnicodeToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function decodeUnicodeFromBase64(base64: string): string {
  let standardBase64 = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  while (standardBase64.length % 4) {
    standardBase64 += '=';
  }
  const binary = atob(standardBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

export function generateMagicLink(): string {
  if (tasks.value.length === 0) {
    return '';
  }

  const shareableTasks: ShareableTask[] = tasks.value.map(task => ({
    id: task.id,
    n: task.name,
    i: task.intervalDays,
    nd: task.nextDueDate,
  }));

  const json = JSON.stringify(shareableTasks);
  const base64 = encodeUnicodeToBase64(json);
  const currentUrl = window.location.origin + window.location.pathname;
  return `${currentUrl}?tasks=${base64}`;
}

export function importTasksFromLink(encodedTasks: string): boolean {
  try {
    const json = decodeUnicodeFromBase64(encodedTasks);
    const importedTasks: ShareableTask[] = JSON.parse(json);

    if (!Array.isArray(importedTasks) || importedTasks.length === 0) {
      return false;
    }

    const existingIds = new Set(tasks.value.map(t => t.id));
    const tasksToAdd = importedTasks.filter(t => !existingIds.has(t.id)).map(
      (t) => {
        let nextDueDate: number;
        if (t.nd !== undefined) {
          nextDueDate = t.nd;
        } else if (t.lc !== undefined) {
          const lastCompletedDate = new Date(t.lc);
          lastCompletedDate.setHours(0, 0, 0, 0);
          const dueDate = new Date(lastCompletedDate);
          dueDate.setDate(lastCompletedDate.getDate() + t.i);
          nextDueDate = dueDate.getTime();
        } else {
          nextDueDate = calculateNextDueDate(t.i);
        }

        return {
          id: t.id,
          name: t.n,
          intervalDays: t.i,
          nextDueDate,
        };
      }
    );

    if (tasksToAdd.length > 0) {
      const updated = [...tasks.value, ...tasksToAdd];
      tasks.value = updated;
      saveTasks(updated);
      return true;
    }

    return false;
  } catch (e) {
    console.error('Failed to import tasks from link:', e);
    return false;
  }
}
