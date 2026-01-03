import { useEffect, useState } from 'preact/hooks';
import { importTasksFromLink } from './store';
import { type LanguageId, getStoredLanguage } from './i18n';
import { getStoredTheme, applyTheme } from './themes';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import './app.css';

type View = 'dashboard' | 'setup';

export function App() {
  const [view, setView] = useState<View>('dashboard');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageId>(getStoredLanguage());

  // Parse query parameter on mount to import tasks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tasksParam = urlParams.get('tasks');
    if (tasksParam) {
      const imported = importTasksFromLink(tasksParam);
      if (imported) {
        // Remove the query parameter from URL after importing
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  // Apply theme on mount
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  const handleLanguageChange = (language: LanguageId) => {
    setSelectedLanguage(language);
  };

  if (view === 'dashboard') {
    return (
      <Dashboard
        selectedLanguage={selectedLanguage}
        onSettingsClick={() => setView('setup')}
      />
    );
  }

  return (
    <Settings
      selectedLanguage={selectedLanguage}
      onBackClick={() => setView('dashboard')}
      onLanguageChange={handleLanguageChange}
    />
  );
}
