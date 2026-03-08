import { signal } from '@preact/signals';
import {
  getCurrentUser,
  onAuthStateChange,
  signInWithGoogle as supabaseSignIn,
  signOut as supabaseSignOut,
  type User,
  loadUserSettings
} from './supabase';
import { syncTasksWithSupabase } from '../store';
import { syncListsOnLogin, clearListsOnLogout } from './lists';
import { type LanguageId, saveLanguage } from '../i18n';
import { type ThemeId, saveTheme, applyTheme } from '../themes';

// ==========================================
// Single source of truth for auth state
// Signals persist across all navigations!
// ==========================================
export const currentUser = signal<User | null>(null);
export const isAuthInitialized = signal<boolean>(false);

let authSubscription: any = null;
let onLoginCallback: ((user: User) => void) | null = null;

// ==========================================
// Initialize once on app startup
// ==========================================
export async function initAuth(): Promise<void> {
  if (isAuthInitialized.value) {
    return; // Already initialized
  }

  try {
    // Fetch user once from Supabase
    const user = await getCurrentUser();
    currentUser.value = user;
    isAuthInitialized.value = true;

    // Set up auth state listener (only once)
    if (!authSubscription) {
      authSubscription = onAuthStateChange((newUser) => {
        const wasLoggedOut = !currentUser.value;
        currentUser.value = newUser;

        // If user just logged in, trigger callback
        if (newUser && wasLoggedOut && onLoginCallback) {
          onLoginCallback(newUser);
        }
      });
    }

    // Handle OAuth callback
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('access_token')) {
      const user = await getCurrentUser();
      currentUser.value = user;
      window.history.replaceState({}, '', window.location.pathname);

      // Trigger login callback for OAuth users
      if (user && onLoginCallback) {
        onLoginCallback(user);
      }
    }
  } catch (error) {
    console.error('[initAuth] Error:', error);
    isAuthInitialized.value = true;
  }
}

// ==========================================
// Set callback for when user logs in
// ==========================================
export function setOnLoginCallback(callback: (user: User) => void): void {
  onLoginCallback = callback;
}

// ==========================================
// Login handler - syncs tasks and settings
// ==========================================
export async function handleUserLogin(): Promise<void> {
  try {
    // 1. Sync tasks from Supabase
    await syncTasksWithSupabase();

    // 2. Sync lists from Supabase
    await syncListsOnLogin();

    // 3. Load and apply user settings
    const settings = await loadUserSettings();
    if (settings) {
      if (settings.language) {
        saveLanguage(settings.language as LanguageId);
        // Note: Language change in UI will happen via app.tsx callback
      }
      if (settings.theme) {
        saveTheme(settings.theme as ThemeId);
        applyTheme(settings.theme as ThemeId);
      }
    }
  } catch (error) {
    console.error('[handleUserLogin] Error:', error);
  }
}

// ==========================================
// Auth actions
// ==========================================
export async function signInWithGoogle(): Promise<void> {
  try {
    await supabaseSignIn();
  } catch (error) {
    console.error('[signInWithGoogle] Error:', error);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  try {
    await supabaseSignOut();
    currentUser.value = null;
    clearListsOnLogout();
  } catch (error) {
    console.error('[signOut] Error:', error);
    throw error;
  }
}

// ==========================================
// Helpers
// ==========================================
export function isLoggedIn(): boolean {
  return currentUser.value !== null;
}

export function getCurrentUserId(): string | null {
  return currentUser.value?.id ?? null;
}

// ==========================================
// Refresh tasks on page reload
// ==========================================
export async function refreshTasksIfLoggedIn(): Promise<void> {
  if (!currentUser.value) return;

  try {
    await syncTasksWithSupabase();
    await syncListsOnLogin();
  } catch (error) {
    console.error('[refreshTasksIfLoggedIn] Error:', error);
  }
}
