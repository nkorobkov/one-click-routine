import { type User } from './supabase';

// Global cache for user information
let cachedUser: User | null = null;
let isInitialized = false;
let initializationPromise: Promise<User | null> | null = null;

/**
 * Get cached user without fetching
 */
export function getCachedUser(): User | null {
  return cachedUser;
}

/**
 * Check if user cache has been initialized
 */
export function isUserCacheInitialized(): boolean {
  return isInitialized;
}

/**
 * Set cached user
 */
export function setCachedUser(user: User | null): void {
  cachedUser = user;
  isInitialized = true;
}

/**
 * Clear cached user
 */
export function clearCachedUser(): void {
  cachedUser = null;
  isInitialized = true; // Still mark as initialized so we don't show loading
}

/**
 * Get or initialize the user cache
 * This ensures only one initialization happens at a time
 */
export function getOrInitUserCache(
  fetchUser: () => Promise<User | null>
): Promise<User | null> {
  // If already initialized, return cached value immediately
  if (isInitialized) {
    return Promise.resolve(cachedUser);
  }

  // If initialization is in progress, return the same promise
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = fetchUser().then((user) => {
    cachedUser = user;
    isInitialized = true;
    initializationPromise = null;
    return user;
  });

  return initializationPromise;
}

/**
 * Force refresh the user cache
 */
export async function refreshUserCache(
  fetchUser: () => Promise<User | null>
): Promise<User | null> {
  const user = await fetchUser();
  cachedUser = user;
  isInitialized = true;
  return user;
}
