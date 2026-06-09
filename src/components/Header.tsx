import { useState, useEffect, useRef } from 'preact/hooks';
import { currentUser, isAuthInitialized, signInWithGoogle, signOut, handleUserLogin, setOnLoginCallback } from '../lib/auth';
import { translations, currentLanguage } from '../i18n';

export type View = 'dashboard' | 'app' | 'stats' | 'settings';

interface HeaderProps {
  currentView: View;
  onNavigate: (path: string) => void;
}

export function Header({ currentView, onNavigate }: HeaderProps) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const isLoadingAuth = !isAuthInitialized.value;
  const t = translations[currentLanguage.value];

  // Set up login callback once
  useEffect(() => {
    setOnLoginCallback(async () => {
      // Call the handleUserLogin from auth module
      await handleUserLogin();
    });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setShowUserDropdown(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleDashboardClick = () => {
    onNavigate('/dashboard');
  };

  return (
    <header class="bg-[var(--bg-primary)] border-b border-[var(--border-color)] sticky top-0 z-10 shrink-0">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          {/* Left side: Navigation */}
          <div class="flex-1 md:flex md:items-center md:gap-12">
            <nav aria-label="Global">
              <ul class="flex items-center gap-6 text-sm list-none">
                <li>
                  <button
                    class={`transition font-semibold text-base ${
                      currentView === 'dashboard'
                        ? 'text-[var(--accent-green)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    style="background-color: transparent; border: none;"
                    onClick={handleDashboardClick}
                  >
                    {t.dashboard}
                  </button>
                </li>
                {currentView !== 'app' && (
                  <li>
                    <button
                      class="text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                      style="background-color: transparent; border: none;"
                      onClick={() => onNavigate('/app')}
                    >
                      {t.appNav}
                    </button>
                  </li>
                )}
                {currentUser.value && currentView !== 'stats' && (
                  <li>
                    <button
                      class="text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                      style="background-color: transparent; border: none;"
                      onClick={() => onNavigate('/stats')}
                    >
                      {t.stats}
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          </div>

          {/* Right side: Settings and Auth */}
          <div class="flex items-center gap-4">
            {/* Settings button - only show when not logged in */}
            {!currentUser.value && currentView !== 'settings' && (
              <button
                class="text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] flex items-center gap-2 text-sm"
                style="background-color: transparent; border: none;"
                onClick={() => onNavigate('/settings')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t.settings}
              </button>
            )}

            {currentUser.value ? (
              <div class="relative" ref={userDropdownRef}>
                <button
                  class="overflow-hidden rounded-full border border-[var(--border-color)] shadow-inner w-10 h-10 flex items-center justify-center cursor-pointer p-0 active:scale-95 transition-all"
                  style={currentUser.value.avatar_url ? '' : 'background-color: var(--accent-green);'}
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  aria-label="User menu"
                >
                  {currentUser.value.avatar_url ? (
                    <img src={currentUser.value.avatar_url} alt={currentUser.value.name} class="w-full h-full object-cover" />
                  ) : (
                    <span class="text-base font-semibold text-[var(--text-primary)]">{getInitials(currentUser.value.name || 'User')}</span>
                  )}
                </button>
                {showUserDropdown && (
                  <div class="absolute end-0 z-10 mt-0.5 w-56 rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-lg" role="menu" style="box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div class="p-2">
                      <div class="px-4 py-2 text-sm font-semibold text-[var(--text-primary)]">{currentUser.value.name}</div>
                      <div class="h-px bg-[var(--border-color)] my-2"></div>
                      <button
                        class="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        style="background-color: transparent;"
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--button-hover)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        }}
                        onClick={() => {
                          onNavigate('/settings');
                          setShowUserDropdown(false);
                        }}
                        role="menuitem"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t.settings}
                      </button>
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-[var(--danger)] transition-colors"
                        style="background-color: transparent;"
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--button-danger-active-bg)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        }}
                        onClick={handleLogout}
                        role="menuitem"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"></path>
                        </svg>
                        {t.logout}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                class="text-[var(--text-primary)] px-4 py-2 rounded-lg font-semibold text-sm border border-[var(--border-color)] whitespace-nowrap active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={`background-color: var(--button-bg); ${isLoadingAuth ? 'opacity: 0.5;' : ''}`}
                onClick={handleLogin}
                disabled={isLoadingAuth}
                onMouseEnter={(e) => {
                  if (!isLoadingAuth) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--button-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--button-bg)';
                }}
              >
                {isLoadingAuth ? (
                  t.loading
                ) : (
                  <span class="flex items-center gap-2">
                    {t.login}
                    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                    </svg>
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
