import { signal } from '@preact/signals';

export interface Task {
  id: string;
  name: string;
  intervalDays: number;
  lastCompleted: number; // Timestamp
  createdAt: number; // Timestamp when task was created
  initialDaysOffset?: number; // Optional: days until first completion (defaults to intervalDays)
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
function loadTasks(): Task[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const tasks = JSON.parse(stored);
      return tasks;
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
  return now.toISOString().split('T')[0];
}

export const currentDate = signal<string>(getDateString());

// Helper: Convert timestamp to date string (YYYY-MM-DD)
function timestampToDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

// Helper: Calculate difference in calendar days between two date strings
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Helper: Calculate days remaining for a task based on calendar days
export function getDaysRemaining(task: Task): number {
  const today = getDateString();
  const lastCompletedDate = timestampToDateString(task.lastCompleted);
  // Handle backward compatibility - if createdAt doesn't exist, use lastCompleted
  const createdAt = task.createdAt || task.lastCompleted;
  const createdAtDate = timestampToDateString(createdAt);
  
  // Check if task has never been completed (lastCompleted timestamp equals createdAt timestamp)
  // This ensures that even if created and completed on the same calendar day, 
  // after first completion it uses intervalDays
  const isFirstCycle = task.lastCompleted === createdAt;
  
  if (isFirstCycle) {
    // Use initial offset for first cycle
    const initialOffset = task.initialDaysOffset ?? task.intervalDays;
    const daysElapsed = daysBetween(createdAtDate, today);
    const daysRemaining = initialOffset - daysElapsed;
    debug(
      'getDaysRemaining task (first cycle):',
      task.name,
      'createdAtDate:',
      createdAtDate,
      'today:',
      today,
      'daysElapsed:',
      daysElapsed.toString(),
      'initialOffset:',
      initialOffset.toString(),
      'daysRemaining:',
      daysRemaining.toString()
    );
    return daysRemaining;
  } else {
    // Normal cycle calculation
    const daysElapsed = daysBetween(lastCompletedDate, today);
    const daysRemaining = task.intervalDays - daysElapsed;
    debug(
      'getDaysRemaining task:',
      task.name,
      'lastCompletedDate:',
      lastCompletedDate,
      'today:',
      today,
      'daysElapsed:',
      daysElapsed.toString(),
      'daysRemaining:',
      daysRemaining.toString()
    );
    return daysRemaining;
  }
}

// Helper: Get the due date for a task
export function getDueDate(task: Task): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysRemaining = getDaysRemaining(task);
  
  if (daysRemaining <= 0) {
    // Already due, return today
    return today;
  }
  
  // Calculate due date by adding days remaining
  const dueDate = new Date(today);
  dueDate.setDate(today.getDate() + daysRemaining);
  return dueDate;
}

// Helper: Calculate days overdue for a task (language-agnostic)
export function getDaysOverdue(task: Task): number {
  const today = getDateString();
  const lastCompletedDate = timestampToDateString(task.lastCompleted);
  return daysBetween(lastCompletedDate, today) - task.intervalDays;
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


// Actions
export function addTask(name: string, intervalDays: number, initialDaysOffset?: number) {
  const now = Date.now();
  const newTask: Task = {
    id: generateShortId(),
    name,
    intervalDays,
    lastCompleted: now, // Set to creation time initially
    createdAt: now,
    initialDaysOffset: initialDaysOffset ?? intervalDays, // Default to intervalDays if not specified
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
  const updated = tasks.value.map((t) =>
    t.id === id ? { ...t, lastCompleted: Date.now() } : t
  );
  tasks.value = updated;
  saveTasks(updated);
}

// Check if day has changed (for midnight update)
export function checkDayChange() {
  debug('checkDayChange');
  const today = getDateString();
  tasks.value = [...tasks.value];
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
  name: string;
  intervalDays: number;
  lastCompleted: number;
  createdAt: number;
  initialDaysOffset?: number;
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
    name: task.name,
    intervalDays: task.intervalDays,
    lastCompleted: task.lastCompleted,
    createdAt: task.createdAt,
    initialDaysOffset: task.initialDaysOffset,
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
    
    // Convert to full Task objects
    const newTasks: Task[] = importedTasks.map(task => ({
      id: task.id,
      name: task.name,
      intervalDays: task.intervalDays,
      lastCompleted: task.lastCompleted,
      createdAt: task.createdAt,
      initialDaysOffset: task.initialDaysOffset,
    }));
    
    // Merge with existing tasks, dedupe by ID
    const existingIds = new Set(tasks.value.map(t => t.id));
    const tasksToAdd = newTasks.filter(t => !existingIds.has(t.id));
    
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

