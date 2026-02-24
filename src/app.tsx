import { useEffect, useState } from 'preact/hooks';
import Router from 'preact-router';
import { type LanguageId, getStoredLanguage } from './i18n';
import { getStoredTheme, applyTheme } from './themes';
import { refreshTasksIfLoggedIn } from './lib/auth';
import { Dashboard } from './components/Dashboard';
import { AddTaskScreen } from './components/AddTaskScreen';
import { StatsPage } from './components/StatsPage';
import { SettingsPage } from './components/SettingsPage';
import './app.css';

export function App() {
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

  return (
    <Router>
      <Dashboard path="/" selectedLanguage={selectedLanguage} />
      <AddTaskScreen path="/add" selectedLanguage={selectedLanguage} />
      <StatsPage path="/stats" selectedLanguage={selectedLanguage} />
      <SettingsPage
        path="/settings"
        selectedLanguage={selectedLanguage}
        onLanguageChange={handleLanguageChange}
      />
    </Router>
  );
}
