import { useState, useEffect, useRef } from 'preact/hooks';
import { currentUser, isAuthInitialized, signInWithGoogle, signOut, handleUserLogin, setOnLoginCallback } from '../lib/auth';
import { translations, type LanguageId } from '../i18n';

export type View = 'dashboard' | 'addTask' | 'stats' | 'settings';

interface HeaderProps {
  currentView: View;
  onNavigate: (path: string) => void;
  selectedLanguage: LanguageId;
}

export function Header({ currentView, onNavigate, selectedLanguage }: HeaderProps) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Read directly from global auth signals - these persist across all navigations!
  const isLoadingAuth = !isAuthInitialized.value;
  const t = translations[selectedLanguage];

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
    onNavigate('/');
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
                {currentView !== 'addTask' && (
                  <li>
                    <button
                      class="text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                      style="background-color: transparent; border: none;"
                      onClick={() => onNavigate('/add')}
                    >
                      {t.addTaskNav}
                    </button>
                  </li>
                )}
                {currentUser.value && (
                  <li>
                    <button
                      class={`transition ${
                        currentView === 'stats'
                          ? 'text-[var(--text-primary)] font-bold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
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
                {isLoadingAuth ? t.loading : t.loginWithGoogle}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
