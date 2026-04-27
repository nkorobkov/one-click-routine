import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create client with fallback empty strings if env vars are missing (for development)
// The actual auth functions will handle errors gracefully
export const supabase = createClient(
  supabaseUrl || 'https://dseijgrdislccwbuklda.supabase.co',
  supabaseAnonKey || 'sb_publishable_IGnOrt6CGkcMxgmj2qbexQ_Av4OGAPu'
);

// User type
export interface User {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

// Authentication functions
export async function signInWithGoogle() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
  }
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  
  if (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
  
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  
  if (!user) {
    return null;
  }
  
  // Get user metadata (name, avatar, etc.)
  const userData: User = {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    avatar_url: user.user_metadata?.avatar_url,
  };
  
  return userData;
}

// User settings type for Supabase storage
export interface UserSettings {
  language?: string;
  theme?: string;
  taskOrderMode?: 'fixed' | 'priority';
}

// Load settings from Supabase for the current user
export async function loadUserSettings(): Promise<UserSettings | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('id', user.id)
    .single();

  if (error) {
    // PGRST116 = no rows returned, normal for new users
    if (error.code !== 'PGRST116') {
      console.error('Error loading user settings:', error);
    }
    return null;
  }

  return data?.settings as UserSettings || null;
}

// Save settings to Supabase for the current user (upsert)
export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('user_settings')
    .upsert({
      id: user.id,
      settings,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error saving user settings:', error);
  }
}

// Listen to auth state changes
// IMPORTANT: Callback must be synchronous - do NOT call other Supabase functions inside it
// Extract user info directly from session to avoid deadlocks
export function onAuthStateChange(callback: (user: User | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    // Extract user info synchronously from session (no async calls!)
    if (session?.user) {
      const user: User = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.full_name || 
              session.user.user_metadata?.name || 
              session.user.email?.split('@')[0] || 
              'User',
        avatar_url: session.user.user_metadata?.avatar_url,
      };
      callback(user);
    } else {
      callback(null);
    }
  });
  return data;
}

// ==========================================
// Task CRUD for Supabase (user_tasks table)
// ==========================================

export interface SupabaseTaskRow {
  id: string;
  user_id: string;
  name: string;
  interval_days: number;
  next_due_date: number;
  sort_order: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

// Fetch all tasks for the given user, sorted by sort_order
export async function fetchUserTasksForUser(
  userId: string
): Promise<{ id: string; name: string; intervalDays: number; nextDueDate: number; description?: string }[] | null> {
  const { data, error } = await supabase
    .from('user_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[fetchUserTasks] Supabase error:', error);
    return null;
  }

  return (data || []).map((row: SupabaseTaskRow) => ({
    id: row.id,
    name: row.name,
    intervalDays: row.interval_days,
    nextDueDate: row.next_due_date,
    description: row.description || '',
  }));
}

// Upsert a single task for a given user
export async function upsertUserTaskForUser(
  userId: string,
  task: { id: string; name: string; intervalDays: number; nextDueDate: number; description?: string },
  sortOrder: number
): Promise<boolean> {
  const { error } = await supabase
    .from('user_tasks')
    .upsert({
      id: task.id,
      user_id: userId,
      name: task.name,
      interval_days: task.intervalDays,
      next_due_date: task.nextDueDate,
      description: task.description || '',
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[upsertUserTaskForUser] Supabase error:', error);
    return false;
  }
  return true;
}

// Batch upsert multiple tasks for a given user (preserves array index as sort_order)
export async function upsertUserTasksForUser(
  userId: string,
  tasks: { id: string; name: string; intervalDays: number; nextDueDate: number; description?: string }[]
): Promise<boolean> {
  const rows = tasks.map((task, index) => ({
    id: task.id,
    user_id: userId,
    name: task.name,
    interval_days: task.intervalDays,
    next_due_date: task.nextDueDate,
    description: task.description || '',
    sort_order: index,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('user_tasks').upsert(rows);

  if (error) {
    console.error('[upsertUserTasksForUser] Supabase error:', error);
    return false;
  }
  return true;
}

// Delete a single task for a given user
export async function deleteUserTaskForUser(userId: string, taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_tasks')
    .delete()
    .eq('user_id', userId)
    .eq('id', taskId);

  if (error) {
    console.error('[deleteUserTaskForUser] Supabase error:', error);
    return false;
  }
  return true;
}

// ==========================================
// List CRUD for Supabase (lists table)
// ==========================================

export interface SupabaseListRow {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseTaskListRow {
  task_id: string;
  list_id: string;
  user_id: string;
  created_at?: string;
}

// Fetch all lists for the given user, sorted by sort_order
export async function fetchUserLists(
  userId: string
): Promise<{ id: string; name: string; sortOrder: number; color?: string }[] | null> {
  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[fetchUserLists] Supabase error:', error);
    return null;
  }

  return (data || []).map((row: SupabaseListRow) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    color: row.color,
  }));
}

// Upsert a single list for a given user
export async function upsertUserList(
  userId: string,
  list: { id: string; name: string; sortOrder: number; color?: string }
): Promise<boolean> {
  const { error } = await supabase
    .from('lists')
    .upsert({
      id: list.id,
      user_id: userId,
      name: list.name,
      sort_order: list.sortOrder,
      color: list.color,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[upsertUserList] Supabase error:', error);
    return false;
  }
  return true;
}

// Batch upsert multiple lists for a given user (preserves array index as sort_order)
export async function upsertUserLists(
  userId: string,
  lists: { id: string; name: string; sortOrder: number; color?: string }[]
): Promise<boolean> {
  const rows = lists.map((list) => ({
    id: list.id,
    user_id: userId,
    name: list.name,
    sort_order: list.sortOrder,
    color: list.color,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('lists').upsert(rows);

  if (error) {
    console.error('[upsertUserLists] Supabase error:', error);
    return false;
  }
  return true;
}

// Delete a single list for a given user
export async function deleteUserList(userId: string, listId: string): Promise<boolean> {
  const { error } = await supabase
    .from('lists')
    .delete()
    .eq('user_id', userId)
    .eq('id', listId);

  if (error) {
    console.error('[deleteUserList] Supabase error:', error);
    return false;
  }
  return true;
}

// ==========================================
// Task-List Association CRUD
// ==========================================

// Fetch all task-list associations for the given user
export async function fetchTaskLists(
  userId: string
): Promise<{ taskId: string; listId: string }[] | null> {
  const { data, error } = await supabase
    .from('task_lists')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('[fetchTaskLists] Supabase error:', error);
    return null;
  }

  return (data || []).map((row: SupabaseTaskListRow) => ({
    taskId: row.task_id,
    listId: row.list_id,
  }));
}

// Set all lists for a task (replaces existing associations)
export async function setTaskLists(
  userId: string,
  taskId: string,
  listIds: string[]
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from('task_lists')
    .delete()
    .eq('user_id', userId)
    .eq('task_id', taskId);

  if (deleteError) {
    console.error('[setTaskLists] Delete error:', deleteError);
    return false;
  }

  if (listIds.length === 0) return true;

  const rows = listIds.map(listId => ({
    task_id: taskId,
    list_id: listId,
    user_id: userId,
  }));

  const { error: insertError } = await supabase.from('task_lists').insert(rows);

  if (insertError) {
    console.error('[setTaskLists] Insert error:', insertError);
    return false;
  }

  return true;
}

// ==========================================
// Task Completions CRUD (task_completions table)
// ==========================================

export interface TaskCompletion {
  id: string;
  task_id: string;
  user_id: string;
  completed_at: number; // JavaScript timestamp (milliseconds)
  due_date: number; // JavaScript timestamp (milliseconds)
  delay_days: number;
  task_name: string;
  interval_days: number;
  created_at?: string;
}

/**
 * Insert a new task completion record
 * Called by completeTask() in store.ts
 * @returns completion ID on success, null on failure
 */
export async function insertTaskCompletion(
  userId: string,
  completion: Omit<TaskCompletion, 'id' | 'user_id' | 'created_at'>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('task_completions')
    .insert({
      user_id: userId,
      task_id: completion.task_id,
      completed_at: new Date(completion.completed_at).toISOString(),
      due_date: new Date(completion.due_date).toISOString(),
      delay_days: completion.delay_days,
      task_name: completion.task_name,
      interval_days: completion.interval_days,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[insertTaskCompletion] Supabase error:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Delete a task completion record (for undo)
 * Called by undoComplete() in store.ts
 * @returns true on success, false on failure
 */
export async function deleteTaskCompletion(
  completionId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('task_completions')
    .delete()
    .eq('id', completionId);

  if (error) {
    console.error('[deleteTaskCompletion] Supabase error:', error);
    return false;
  }

  return true;
}

/**
 * Check if a task was already completed today
 * Used to prevent duplicate completions across surfaces
 * @returns true if task was completed today, false otherwise
 */
export async function wasTaskCompletedToday(
  userId: string,
  taskId: string
): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const { data, error } = await supabase
    .from('task_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .gte('completed_at', today.toISOString())
    .lt('completed_at', tomorrow.toISOString())
    .limit(1);

  if (error) {
    console.error('[wasTaskCompletedToday] Supabase error:', error);
    return false; // fail open
  }

  return (data || []).length > 0;
}

/**
 * Fetch task completions with optional filters
 * Called by StatsPage component
 * @returns array of completions ordered by completed_at DESC, null on error
 */
interface TaskCompletionRow {
  id: string;
  task_id: string;
  user_id: string;
  completed_at: string;
  due_date: string;
  delay_days: string | number;
  task_name: string;
  interval_days: number;
  created_at?: string;
}

export async function fetchTaskCompletions(
  userId: string,
  options?: {
    taskId?: string;
    startDate?: number;
    endDate?: number;
  }
): Promise<TaskCompletion[] | null> {
  let query = supabase
    .from('task_completions')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });

  if (options?.taskId) {
    query = query.eq('task_id', options.taskId);
  }
  if (options?.startDate) {
    query = query.gte('completed_at', new Date(options.startDate).toISOString());
  }
  if (options?.endDate) {
    query = query.lte('completed_at', new Date(options.endDate).toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('[fetchTaskCompletions] Supabase error:', error);
    return null;
  }

  return (data || []).map((row: TaskCompletionRow) => ({
    id: row.id,
    task_id: row.task_id,
    user_id: row.user_id,
    completed_at: new Date(row.completed_at).getTime(),
    due_date: new Date(row.due_date).getTime(),
    delay_days: typeof row.delay_days === 'string' ? parseFloat(row.delay_days) : row.delay_days,
    task_name: row.task_name,
    interval_days: row.interval_days,
    created_at: row.created_at,
  }));
}
