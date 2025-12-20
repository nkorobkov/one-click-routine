export type ThemeId = 'default-dark' | 'solarized-light';

export interface Theme {
  id: ThemeId;
  name: string;
  colors: {
    '--bg-primary': string;
    '--bg-secondary': string;
    '--text-primary': string;
    '--text-secondary': string;
    '--accent-green': string;
    '--accent-green-dark': string;
    '--accent-red': string;
    '--accent-orange': string;
    '--border-color': string;
    '--button-bg': string;
    '--button-hover': string;
    '--danger': string;
    '--danger-hover': string;
    '--settings-button-bg': string;
    '--settings-button-bg-active': string;
    '--settings-button-border': string;
    '--settings-button-shadow': string;
    '--overdue-bg': string;
    '--overdue-bg-active': string;
    '--task-time-bg': string;
    '--task-time-border': string;
    '--task-due-date-color': string;
    '--button-danger-active-bg': string;
    '--toast-shadow': string;
    '--progress-bar-bg': string;
  };
}

export const themes: Record<ThemeId, Theme> = {
  'default-dark': {
    id: 'default-dark',
    name: 'Default Dark',
    colors: {
      '--bg-primary': '#000000',
      '--bg-secondary': '#121212',
      '--text-primary': '#ffffff',
      '--text-secondary': '#b0b0b0',
      '--accent-green': '#4caf50',
      '--accent-green-dark': '#45a049',
      '--accent-red': '#f44336',
      '--accent-orange': 'rgba(227, 182, 31, 0.7)',
      '--border-color': '#333333',
      '--button-bg': '#1a1a1a',
      '--button-hover': '#2a2a2a',
      '--danger': '#d32f2f',
      '--danger-hover': '#f44336',
      '--settings-button-bg': 'rgba(26, 26, 26, 0.5)',
      '--settings-button-bg-active': 'rgba(26, 26, 26, 0.7)',
      '--settings-button-border': 'rgba(255, 255, 255, 0.1)',
      '--settings-button-shadow': 'rgba(0, 0, 0, 0.2)',
      '--overdue-bg': 'rgba(244, 67, 54, 0.15)',
      '--overdue-bg-active': 'rgba(244, 67, 54, 0.25)',
      '--task-time-bg': 'rgba(255, 255, 255, 0.1)',
      '--task-time-border': 'rgba(255, 255, 255, 0.3)',
      '--task-due-date-color': 'rgba(176, 176, 176, 0.6)',
      '--button-danger-active-bg': 'rgba(211, 47, 47, 0.1)',
      '--toast-shadow': 'rgba(0, 0, 0, 0.3)',
      '--progress-bar-bg': 'rgba(255, 255, 255, 0.1)',
    },
  },
  'solarized-light': {
    id: 'solarized-light',
    name: 'Solarized Light',
    colors: {
      '--bg-primary': '#fdf6e3', // Base3
      '--bg-secondary': '#eee8d5', // Base2
      '--text-primary': '#657b83', // Base00
      '--text-secondary': '#839496', // Base0
      '--accent-green': '#859900', // Green
      '--accent-green-dark': '#738a05', // Darker green
      '--accent-red': '#dc322f', // Red
      '--accent-orange': 'rgba(227, 182, 31, 0.7)',
      '--border-color': '#93a1a1', // Base1
      '--button-bg': '#eee8d5', // Base2
      '--button-hover': '#e6dfc7',
      '--danger': '#dc322f', // Red
      '--danger-hover': '#cb4b16', // Orange
      '--settings-button-bg': 'rgba(238, 232, 213, 0.7)', // Base2 with opacity
      '--settings-button-bg-active': 'rgba(238, 232, 213, 0.9)', // Base2 with more opacity
      '--settings-button-border': 'rgba(101, 123, 131, 0.2)', // Base00 with opacity
      '--settings-button-shadow': 'rgba(0, 0, 0, 0.15)',
      '--overdue-bg': 'rgba(220, 50, 47, 0.15)', // Red with opacity
      '--overdue-bg-active': 'rgba(220, 50, 47, 0.25)', // Red with more opacity
      '--task-time-bg': 'rgba(101, 123, 131, 0.15)', // Base00 with opacity
      '--task-time-border': 'rgba(101, 123, 131, 0.3)', // Base00 with opacity
      '--task-due-date-color': 'rgba(131, 148, 150, 0.6)', // Base0 with opacity
      '--button-danger-active-bg': 'rgba(220, 50, 47, 0.1)', // Red with opacity
      '--toast-shadow': 'rgba(0, 0, 0, 0.2)',
      '--progress-bar-bg': 'rgba(101, 123, 131, 0.15)', // Base00 with opacity
    },
  },
};

export function applyTheme(themeId: ThemeId) {
  const theme = themes[themeId];
  if (!theme) return;
  
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}

export function getStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem('one-click-routine-theme');
    if (stored && stored in themes) {
      return stored as ThemeId;
    }
  } catch (e) {
    console.error('Failed to load theme from localStorage:', e);
  }
  return 'default-dark';
}

export function saveTheme(themeId: ThemeId) {
  try {
    localStorage.setItem('one-click-routine-theme', themeId);
  } catch (e) {
    console.error('Failed to save theme to localStorage:', e);
  }
}

