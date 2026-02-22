import { useEffect, useState } from 'preact/hooks';
import { type LanguageId, getStoredLanguage } from './i18n';
import { getStoredTheme, applyTheme } from './themes';
import { refreshTasksIfLoggedIn } from './lib/auth';
import { Dashboard } from './components/Dashboard';
import { AddTaskScreen } from './components/AddTaskScreen';
import { SettingsPage } from './components/SettingsPage';
import type { View } from './components/Header';
import './app.css';

export function App() {
  const [view, setView] = useState<View>('dashboard');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageId>(getStoredLanguage());

  // Apply theme on mount and refresh tasks if logged in
  useEffect(() => {
    applyTheme(getStoredTheme());
    // Refresh tasks from Supabase on page reload (if user is logged in)
    refreshTasksIfLoggedIn();
  }, []);

  const handleLanguageChange = (language: LanguageId) => {
    setSelectedLanguage(language);
  };

  const handleNavigate = (newView: View) => {
    setView(newView);
  };

  if (view === 'dashboard') {
    return (
      <Dashboard
        selectedLanguage={selectedLanguage}
        onSettingsClick={() => setView('addTask')}
      />
    );
  }

  if (view === 'addTask') {
    return (
      <AddTaskScreen
        selectedLanguage={selectedLanguage}
        onNavigate={handleNavigate}
      />
    );
  }

  return (
    <SettingsPage
      selectedLanguage={selectedLanguage}
      onNavigate={handleNavigate}
      onLanguageChange={handleLanguageChange}
    />
  );
}
