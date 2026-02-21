import { useEffect, useState } from 'preact/hooks';
import { importTasksFromLink } from './store';
import { type LanguageId, getStoredLanguage, saveLanguage } from './i18n';
import { type ThemeId, getStoredTheme, applyTheme, saveTheme } from './themes';
import { loadUserSettings } from './lib/supabase';
import { Dashboard } from './components/Dashboard';
import { AddTaskScreen } from './components/AddTaskScreen';
import { SettingsPage } from './components/SettingsPage';
import type { View } from './components/Header';
import './app.css';

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

  const handleNavigate = (newView: View) => {
    setView(newView);
  };

  // On login, load settings from Supabase and apply them
  const handleUserLogin = async () => {
    const settings = await loadUserSettings();
    if (settings) {
      if (settings.language) {
        saveLanguage(settings.language as LanguageId);
        setSelectedLanguage(settings.language as LanguageId);
      }
      if (settings.theme) {
        saveTheme(settings.theme as ThemeId);
        applyTheme(settings.theme as ThemeId);
      }
    }
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
        onLanguageChange={handleLanguageChange}
        onUserLogin={handleUserLogin}
      />
    );
  }

  return (
    <SettingsPage
      selectedLanguage={selectedLanguage}
      onNavigate={handleNavigate}
      onLanguageChange={handleLanguageChange}
      onUserLogin={handleUserLogin}
    />
  );
}
