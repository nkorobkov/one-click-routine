import { signal } from '@preact/signals';
import { fetchUserLists, fetchTaskLists, upsertUserList, upsertUserLists, deleteUserList, setTaskLists } from './supabase';
import { isLoggedIn, getCurrentUserId } from './auth';

export interface List {
  id: string;
  name: string;
  sortOrder: number;
  color?: string; // for future use
}

export interface TaskListAssociation {
  taskId: string;
  listId: string;
}

const debug = (...args: string[]) => {
  if (import.meta.env.DEV) {
    console.log('[LISTS DEBUG]:', ...args);
  }
};

// ==========================================
// Signals (no localStorage - only for logged-in users)
// ==========================================

export const lists = signal<List[]>([]);
export const taskListAssociations = signal<TaskListAssociation[]>([]);

// ==========================================
// ID Generation
// ==========================================
function generateListId(): string {
  return crypto.randomUUID();
}

// ==========================================
// List CRUD Operations (PESSIMISTIC)
// ==========================================

const MAX_LISTS = 10;

export async function addList(name: string): Promise<boolean> {
  if (!isLoggedIn()) {
    debug('addList: not logged in');
    return false;
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    debug('addList: empty name');
    return false;
  }

  if (lists.value.length >= MAX_LISTS) {
    debug('addList: max lists reached');
    return false;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    debug('addList: no user id');
    return false;
  }

  const newList: List = {
    id: generateListId(),
    name: trimmedName,
    sortOrder: lists.value.length,
  };

  const success = await upsertUserList(userId, newList);
  if (!success) {
    debug('addList: Supabase upsert failed');
    return false;
  }

  // Update local state
  lists.value = [...lists.value, newList];
  return true;
}

export async function updateList(id: string, name: string): Promise<boolean> {
  if (!isLoggedIn()) {
    debug('updateList: not logged in');
    return false;
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    debug('updateList: empty name');
    return false;
  }

  const list = lists.value.find(l => l.id === id);
  if (!list) {
    debug('updateList: list not found:', id);
    return false;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    debug('updateList: no user id');
    return false;
  }

  const updatedList = { ...list, name: trimmedName };
  const success = await upsertUserList(userId, updatedList);
  if (!success) {
    debug('updateList: Supabase upsert failed');
    return false;
  }

  // Update local state
  lists.value = lists.value.map(l => l.id === id ? updatedList : l);
  return true;
}

export async function deleteList(id: string): Promise<boolean> {
  if (!isLoggedIn()) {
    debug('deleteList: not logged in');
    return false;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    debug('deleteList: no user id');
    return false;
  }

  const success = await deleteUserList(userId, id);
  if (!success) {
    debug('deleteList: Supabase delete failed');
    return false;
  }

  // Update local state (CASCADE in DB will remove task_lists associations)
  lists.value = lists.value.filter(l => l.id !== id);

  // Remove task_lists associations from local state
  taskListAssociations.value = taskListAssociations.value.filter(
    assoc => assoc.listId !== id
  );

  // Re-sync sort orders in background
  const updatedLists = lists.value.map((list, index) => ({
    ...list,
    sortOrder: index,
  }));
  lists.value = updatedLists;

  if (updatedLists.length > 0) {
    upsertUserLists(userId, updatedLists).catch(err => {
      console.error('[deleteList] Background sort order sync failed:', err);
    });
  }

  return true;
}

// ==========================================
// List Reordering (OPTIMISTIC)
// ==========================================

export function moveListUp(id: string) {
  const index = lists.value.findIndex(l => l.id === id);
  if (index > 0) {
    const updated = [...lists.value];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];

    // Update sort orders
    const reordered = updated.map((list, i) => ({ ...list, sortOrder: i }));
    lists.value = reordered;

    // Sync to Supabase in background
    if (isLoggedIn()) {
      const userId = getCurrentUserId();
      if (userId) {
        upsertUserLists(userId, reordered).catch(err => {
          console.error('[moveListUp] Background sync failed:', err);
        });
      }
    }
  }
}

export function moveListDown(id: string) {
  const index = lists.value.findIndex(l => l.id === id);
  if (index >= 0 && index < lists.value.length - 1) {
    const updated = [...lists.value];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];

    // Update sort orders
    const reordered = updated.map((list, i) => ({ ...list, sortOrder: i }));
    lists.value = reordered;

    // Sync to Supabase in background
    if (isLoggedIn()) {
      const userId = getCurrentUserId();
      if (userId) {
        upsertUserLists(userId, reordered).catch(err => {
          console.error('[moveListDown] Background sync failed:', err);
        });
      }
    }
  }
}

// ==========================================
// Task-List Associations (PESSIMISTIC)
// ==========================================

export async function setTaskListsForTask(taskId: string, listIds: string[]): Promise<boolean> {
  if (!isLoggedIn()) {
    debug('setTaskListsForTask: not logged in');
    return false;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    debug('setTaskListsForTask: no user id');
    return false;
  }

  const success = await setTaskLists(userId, taskId, listIds);
  if (!success) {
    debug('setTaskListsForTask: Supabase setTaskLists failed');
    return false;
  }

  // Update local state
  const filtered = taskListAssociations.value.filter(assoc => assoc.taskId !== taskId);
  const newAssociations = listIds.map(listId => ({ taskId, listId }));
  taskListAssociations.value = [...filtered, ...newAssociations];

  return true;
}

// ==========================================
// Helper Functions
// ==========================================

export function getTaskLists(taskId: string): List[] {
  const listIds = taskListAssociations.value
    .filter(assoc => assoc.taskId === taskId)
    .map(assoc => assoc.listId);

  return lists.value.filter(list => listIds.includes(list.id));
}

export function getTasksInList(listId: string): string[] {
  return taskListAssociations.value
    .filter(assoc => assoc.listId === listId)
    .map(assoc => assoc.taskId);
}

// ==========================================
// Login Sync (remote is source of truth)
// ==========================================

export async function syncListsOnLogin(): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) {
    debug('syncListsOnLogin: no user id');
    return;
  }

  // Fetch lists from Supabase
  const remoteLists = await fetchUserLists(userId);
  if (remoteLists === null) {
    debug('syncListsOnLogin: fetch lists failed');
    return;
  }

  // Fetch task-list associations from Supabase
  const remoteAssociations = await fetchTaskLists(userId);
  if (remoteAssociations === null) {
    debug('syncListsOnLogin: fetch task-lists failed');
    return;
  }

  // Update local state (remote is source of truth)
  lists.value = remoteLists;
  taskListAssociations.value = remoteAssociations;

  debug('syncListsOnLogin: synced', remoteLists.length, 'lists and', remoteAssociations.length, 'associations');
}

// ==========================================
// Logout Clear
// ==========================================

export function clearListsOnLogout(): void {
  lists.value = [];
  taskListAssociations.value = [];
  debug('clearListsOnLogout: cleared all list state');
}
