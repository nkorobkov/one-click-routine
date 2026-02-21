import { signal } from '@preact/signals';

export interface Task {
  id: string;
  name: string;
  intervalDays: number;
  nextDueDate: number; // Timestamp for when task is next due
}

const STORAGE_KEY = 'one-click-routine-tasks';

export const debug = (...args: string[]) => {
  if (import.meta.env.DEV) {
    console.log('[DEBUG]:', ...args);
  }
};

// Generate a shorter ID (base64url encoded random bytes)
// This produces IDs like "aBc123Xy" instead of full UUIDs
function generateShortId(): string {
  // Generate 9 random bytes (72 bits) and encode as base64url
  // This gives us 12 characters, which is much shorter than UUID (36 chars)
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  
  // Convert to base64url (URL-safe base64)
  // Convert Uint8Array to string using Array.from for compatibility
  const byteString = String.fromCharCode(...Array.from(bytes));
  let base64 = btoa(byteString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, ''); // Remove padding
  
  return base64;
}


// Load tasks from localStorage on initialization
// Migrates legacy tasks with lastCompleted to new format with nextDueDate
function loadTasks(): Task[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const tasks = JSON.parse(stored);
      // Migrate legacy tasks that have lastCompleted instead of nextDueDate
      return tasks.map((task: any) => {
        if (task.nextDueDate !== undefined) {
          // Already in new format
          return task;
        } else if (task.lastCompleted !== undefined) {
          // Legacy format: convert lastCompleted to nextDueDate
          // Calculate: nextDueDate = lastCompleted + intervalDays
          const lastCompletedDate = new Date(task.lastCompleted);
          lastCompletedDate.setHours(0, 0, 0, 0);
          const dueDate = new Date(lastCompletedDate);
          dueDate.setDate(lastCompletedDate.getDate() + task.intervalDays);
          return {
            ...task,
            nextDueDate: dueDate.getTime(),
          };
        } else {
          // Fallback: calculate from now
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

// Save tasks to localStorage
function saveTasks(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks to localStorage:', e);
  }
}

// Signal for tasks
export const tasks = signal<Task[]>(loadTasks());

// Current date string (for midnight detection)
// Format: YYYY-MM-DD to handle month/year boundaries correctly
function getDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const currentDate = signal<string>(getDateString());

// Helper: Convert timestamp to date string (YYYY-MM-DD)
function timestampToDateString(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Calculate difference in calendar days between two date strings
function daysBetween(date1: string, date2: string): number {
  // Parse date strings as local dates (YYYY-MM-DD format)
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Helper: Calculate days remaining for a task based on calendar days
export function getDaysRemaining(task: Task): number {
  const today = getDateString();
  const nextDueDateStr = timestampToDateString(task.nextDueDate);
  
  // Calculate days between today and next due date
  const daysRemaining = daysBetween(today, nextDueDateStr);
  
  return daysRemaining;
}

// Helper: Get the due date for a task
export function getDueDate(task: Task): Date {
  // nextDueDate is already a timestamp, just convert to Date
  const dueDate = new Date(task.nextDueDate);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate;
}

// Helper: Calculate days overdue for a task (language-agnostic)
export function getDaysOverdue(task: Task): number {
  const today = getDateString();
  const nextDueDateStr = timestampToDateString(task.nextDueDate);
  // If today is past the due date, return the difference
  const daysOverdue = daysBetween(nextDueDateStr, today);
  return daysOverdue > 0 ? daysOverdue : 0;
}

// Helper: Format due date as "Wednesday Dec 3"
export function formatDueDate(task: Task): string {
  const dueDate = getDueDate(task);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const weekday = weekdays[dueDate.getDay()];
  const month = months[dueDate.getMonth()];
  const day = dueDate.getDate();
  
  return `${weekday} ${month} ${day}`;
}


// Helper: Calculate next due date timestamp
function calculateNextDueDate(intervalDays: number, initialDaysOffset?: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // If initialDaysOffset is provided, calculate due date in that many days
  // Otherwise, due date is intervalDays from now
  const daysUntilDue = initialDaysOffset !== undefined ? initialDaysOffset : intervalDays;
  
  const nextDueDate = new Date(today);
  nextDueDate.setDate(today.getDate() + daysUntilDue);
  nextDueDate.setHours(0, 0, 0, 0);
  
  return nextDueDate.getTime();
}

// Actions
export function addTask(name: string, intervalDays: number, initialDaysOffset?: number) {
  const nextDueDate = calculateNextDueDate(intervalDays, initialDaysOffset);
  
  const newTask: Task = {
    id: generateShortId(),
    name,
    intervalDays,
    nextDueDate,
  };
  const updated = [...tasks.value, newTask];
  tasks.value = updated;
  saveTasks(updated);
}

export function deleteTask(id: string) {
  const updated = tasks.value.filter((t) => t.id !== id);
  tasks.value = updated;
  saveTasks(updated);
}

export function moveTaskUp(id: string) {
  const index = tasks.value.findIndex((t) => t.id === id);
  if (index > 0) {
    const updated = [...tasks.value];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    tasks.value = updated;
    saveTasks(updated);
  }
}

export function moveTaskDown(id: string) {
  const index = tasks.value.findIndex((t) => t.id === id);
  if (index >= 0 && index < tasks.value.length - 1) {
    const updated = [...tasks.value];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    tasks.value = updated;
    saveTasks(updated);
  }
}

export function completeTask(id: string) {
  const updated = tasks.value.map((t) => {
    if (t.id === id) {
      // Calculate new nextDueDate = today + intervalDays (from completion day, not previous due date)
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
}

// Adjust task time left by adding or subtracting days
export function adjustTaskTime(id: string, daysDelta: number) {
  const updated = tasks.value.map((t) => {
    if (t.id === id) {
      // Add/subtract days by modifying nextDueDate directly
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
}

// Update task name and intervalDays
// When intervalDays changes, recalculate nextDueDate proportionally as if task was completed
// with the new period. Example: 5 days until due with period 30, change to period 35 = 10 days until due
export function updateTask(id: string, name: string, intervalDays: number) {
  const updated = tasks.value.map((t) => {
    if (t.id === id) {
      // If intervalDays changed, recalculate nextDueDate proportionally
      if (t.intervalDays !== intervalDays) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const currentDueDate = new Date(t.nextDueDate);
        currentDueDate.setHours(0, 0, 0, 0);
        
        // Calculate days remaining until current due date
        const daysRemaining = Math.floor((currentDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate how many days have elapsed since "last completion"
        // (oldIntervalDays - daysRemaining = daysElapsed)
        const daysElapsed = t.intervalDays - daysRemaining;
        
        // Calculate new days remaining with new period
        // (newIntervalDays - daysElapsed = newDaysRemaining)
        const newDaysRemaining = intervalDays - daysElapsed;
        
        // Calculate new due date from today
        const newDueDate = new Date(today);
        newDueDate.setDate(today.getDate() + newDaysRemaining);
        
        return { ...t, name: name.trim(), intervalDays, nextDueDate: newDueDate.getTime() };
      }
      return { ...t, name: name.trim(), intervalDays };
    }
    return t;
  });
  tasks.value = updated;
  saveTasks(updated);
}

// Check if day has changed (for midnight update)
export function checkDayChange() {
  debug('checkDayChange');
  const today = getDateString();
  //tasks.value = [...tasks.value];
  if (currentDate.value !== today) {
    debug('day changed', currentDate.value, today);
    currentDate.value = today;
    // Force signal update to recalculate days remaining
    tasks.value = [...tasks.value];
  }
}

// Minimal task data for sharing (only what's needed to recreate the task)
interface ShareableTask {
  id: string;
  n: string;
  i: number;
  nd: number; // nextDueDate
  // Legacy support: lc (lastCompleted) for backward compatibility
  lc?: number;
}

// Unicode-safe base64 encoding (handles emojis and all Unicode characters)
function encodeUnicodeToBase64(str: string): string {
  // Use TextEncoder to convert Unicode string to Uint8Array
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  
  // Convert bytes to base64
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  // Convert to base64url (URL-safe)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, ''); // Remove padding
}

// Unicode-safe base64 decoding (handles emojis and all Unicode characters)
function decodeUnicodeFromBase64(base64: string): string {
  // Restore base64url to standard base64
  let standardBase64 = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Add padding if needed
  while (standardBase64.length % 4) {
    standardBase64 += '=';
  }
  
  // Decode base64 to binary string
  const binary = atob(standardBase64);
  
  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  // Use TextDecoder to convert bytes back to Unicode string
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

// Generate magic link with base64 encoded task data
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
  // Encode to base64url (URL-safe) with Unicode support
  const base64 = encodeUnicodeToBase64(json);
  
  const currentUrl = window.location.origin + window.location.pathname;
  return `${currentUrl}?tasks=${base64}`;
}

// Parse magic link and merge tasks (dedupe by ID)
export function importTasksFromLink(encodedTasks: string): boolean {
  try {
    // Decode base64url with Unicode support
    const json = decodeUnicodeFromBase64(encodedTasks);
    const importedTasks: ShareableTask[] = JSON.parse(json);
    
    if (!Array.isArray(importedTasks) || importedTasks.length === 0) {
      return false;
    }
    
    
    // Merge with existing tasks, dedupe by ID
    const existingIds = new Set(tasks.value.map(t => t.id));
    const tasksToAdd = importedTasks.filter(t => !existingIds.has(t.id)).map(
      (t) => {
        // Support both new format (nd) and legacy format (lc)
        let nextDueDate: number;
        if (t.nd !== undefined) {
          // New format: use nextDueDate directly
          nextDueDate = t.nd;
        } else if (t.lc !== undefined) {
          // Legacy format: convert lastCompleted to nextDueDate
          // Calculate: nextDueDate = lastCompleted + intervalDays
          const lastCompletedDate = new Date(t.lc);
          lastCompletedDate.setHours(0, 0, 0, 0);
          const dueDate = new Date(lastCompletedDate);
          dueDate.setDate(lastCompletedDate.getDate() + t.i);
          nextDueDate = dueDate.getTime();
        } else {
          // Fallback: calculate from now
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

