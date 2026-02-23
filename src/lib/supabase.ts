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
  created_at?: string;
  updated_at?: string;
}

// Fetch all tasks for the given user, sorted by sort_order
export async function fetchUserTasksForUser(
  userId: string
): Promise<{ id: string; name: string; intervalDays: number; nextDueDate: number }[] | null> {
  try {
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
    }));
  } catch (err) {
    console.error('[fetchUserTasksForUser] Unexpected error:', err);
    return null;
  }
}

// Upsert a single task for a given user
export async function upsertUserTaskForUser(
  userId: string,
  task: { id: string; name: string; intervalDays: number; nextDueDate: number },
  sortOrder: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_tasks')
      .upsert({
        id: task.id,
        user_id: userId,
        name: task.name,
        interval_days: task.intervalDays,
        next_due_date: task.nextDueDate,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[upsertUserTaskForUser] Supabase error:', error);
      console.error('[upsertUserTaskForUser] Task data:', { userId, id: task.id, name: task.name, intervalDays: task.intervalDays, nextDueDate: task.nextDueDate, sortOrder });
      return false;
    }
    return true;
  } catch (err) {
    console.error('[upsertUserTaskForUser] Unexpected error:', err);
    return false;
  }
}

// Batch upsert multiple tasks for a given user (preserves array index as sort_order)
export async function upsertUserTasksForUser(
  userId: string,
  tasks: { id: string; name: string; intervalDays: number; nextDueDate: number }[]
): Promise<boolean> {
  try {
    const rows = tasks.map((task, index) => ({
      id: task.id,
      user_id: userId,
      name: task.name,
      interval_days: task.intervalDays,
      next_due_date: task.nextDueDate,
      sort_order: index,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('user_tasks')
      .upsert(rows);

    if (error) {
      console.error('[upsertUserTasksForUser] Supabase error:', error);
      console.error('[upsertUserTasksForUser] Task count:', tasks.length, 'userId:', userId);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[upsertUserTasksForUser] Unexpected error:', err);
    return false;
  }
}

// Delete a single task for a given user
export async function deleteUserTaskForUser(userId: string, taskId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_tasks')
      .delete()
      .eq('user_id', userId)
      .eq('id', taskId);

    if (error) {
      console.error('[deleteUserTaskForUser] Supabase error:', error);
      console.error('[deleteUserTaskForUser] Task ID:', taskId, 'userId:', userId);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[deleteUserTaskForUser] Unexpected error:', err);
    return false;
  }
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
  try {
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
  } catch (err) {
    console.error('[fetchUserLists] Unexpected error:', err);
    return null;
  }
}

// Upsert a single list for a given user
export async function upsertUserList(
  userId: string,
  list: { id: string; name: string; sortOrder: number; color?: string }
): Promise<boolean> {
  try {
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
  } catch (err) {
    console.error('[upsertUserList] Unexpected error:', err);
    return false;
  }
}

// Batch upsert multiple lists for a given user (preserves array index as sort_order)
export async function upsertUserLists(
  userId: string,
  lists: { id: string; name: string; sortOrder: number; color?: string }[]
): Promise<boolean> {
  try {
    const rows = lists.map((list) => ({
      id: list.id,
      user_id: userId,
      name: list.name,
      sort_order: list.sortOrder,
      color: list.color,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('lists')
      .upsert(rows);

    if (error) {
      console.error('[upsertUserLists] Supabase error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[upsertUserLists] Unexpected error:', err);
    return false;
  }
}

// Delete a single list for a given user
export async function deleteUserList(userId: string, listId: string): Promise<boolean> {
  try {
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
  } catch (err) {
    console.error('[deleteUserList] Unexpected error:', err);
    return false;
  }
}

// ==========================================
// Task-List Association CRUD
// ==========================================

// Fetch all task-list associations for the given user
export async function fetchTaskLists(
  userId: string
): Promise<{ taskId: string; listId: string }[] | null> {
  try {
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
  } catch (err) {
    console.error('[fetchTaskLists] Unexpected error:', err);
    return null;
  }
}

// Set all lists for a task (replaces existing associations)
export async function setTaskLists(
  userId: string,
  taskId: string,
  listIds: string[]
): Promise<boolean> {
  try {
    // Delete existing associations for this task
    const { error: deleteError } = await supabase
      .from('task_lists')
      .delete()
      .eq('user_id', userId)
      .eq('task_id', taskId);

    if (deleteError) {
      console.error('[setTaskLists] Delete error:', deleteError);
      return false;
    }

    // Insert new associations (if any)
    if (listIds.length > 0) {
      const rows = listIds.map(listId => ({
        task_id: taskId,
        list_id: listId,
        user_id: userId,
      }));

      const { error: insertError } = await supabase
        .from('task_lists')
        .insert(rows);

      if (insertError) {
        console.error('[setTaskLists] Insert error:', insertError);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('[setTaskLists] Unexpected error:', err);
    return false;
  }
}
