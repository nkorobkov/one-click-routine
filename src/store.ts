import { signal } from '@preact/signals';

export interface Task {
  id: string;
  name: string;
  intervalDays: number;
  lastCompleted: number; // Timestamp
  createdAt: number; // Timestamp when task was created
  initialDaysOffset?: number; // Optional: days until first completion (defaults to intervalDays)
}

const STORAGE_KEY = 'routine-tracker-tasks';

export const debug = (...args: string[]) => {
  if (import.meta.env.DEV) {
    console.log('[DEBUG]:', ...args);
  }
};

// Load tasks from localStorage on initialization
function loadTasks(): Task[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const tasks = JSON.parse(stored);
      // Migrate old tasks to include createdAt and initialDaysOffset
      return tasks.map((task: Task) => {
        if (!task.createdAt) {
          // Old task - set createdAt to lastCompleted (or now if that's also missing)
          task.createdAt = task.lastCompleted || Date.now();
        }
        if (task.initialDaysOffset === undefined) {
          // Default to intervalDays
          task.initialDaysOffset = task.intervalDays;
        }
        return task;
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

// Helper: Format days as "X days" or "Xw Yd" format
// This function returns just the number/format part, language-specific "in" prefix is handled in component
export function formatDaysRemaining(days: number): string {
  if (days <= 0) return '';
  
  if (days === 1) {
    return '1 day';
  }
  
  if (days < 7) {
    return `${days} days`;
  }
  
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  
  if (remainingDays === 0) {
    return `${weeks}w`;
  }
  
  return `${weeks}w ${remainingDays}d`;
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
    id: crypto.randomUUID(),
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

