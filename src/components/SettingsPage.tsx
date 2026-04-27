import { useState, useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { themes, type ThemeId, getStoredTheme, saveTheme, applyTheme } from '../themes';
import { translations, type LanguageId, currentLanguage, setLanguage } from '../i18n';
import { Header } from './Header';
import { currentUser } from '../lib/auth';
import { saveUserSettings } from '../lib/supabase';
import { taskOrderMode, saveTaskOrderMode, type TaskOrderMode } from '../store';

interface SettingsPageProps {
  path?: string;
}

export function SettingsPage({}: SettingsPageProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(getStoredTheme());
  const lang = currentLanguage.value;
  const t = translations[lang];

  useEffect(() => {
    applyTheme(selectedTheme);
  }, [selectedTheme]);

  const syncSettings = () => {
    if (currentUser.value) {
      saveUserSettings({
        language: currentLanguage.value,
        theme: selectedTheme,
        taskOrderMode: taskOrderMode.value,
      });
    }
  };

  const handleLanguageChange = (newLanguage: LanguageId) => {
    setLanguage(newLanguage);
    syncSettings();
  };

  const handleThemeChange = (newTheme: ThemeId) => {
    setSelectedTheme(newTheme);
    saveTheme(newTheme);
    applyTheme(newTheme);
    if (currentUser.value) {
      saveUserSettings({
        language: currentLanguage.value,
        theme: newTheme,
        taskOrderMode: taskOrderMode.value,
      });
    }
  };

  const handleTaskOrderModeChange = (newMode: TaskOrderMode) => {
    taskOrderMode.value = newMode;
    saveTaskOrderMode(newMode);
    if (currentUser.value) {
      saveUserSettings({
        language: currentLanguage.value,
        theme: selectedTheme,
        taskOrderMode: newMode,
      });
    }
  };

  return (
    <div class="app">
      <Header
        currentView="settings"
        onNavigate={(path) => route(path)}
      />
      <main class="setup">
        <div class="settings-section">
          <h2>{t.theme}</h2>
          <div class="form-group">
            <label for="language-select">{t.language}</label>
            <select
              id="language-select"
              value={lang}
              onChange={(e) => {
                const newLanguage = (e.target as HTMLSelectElement).value as LanguageId;
                handleLanguageChange(newLanguage);
              }}
              class="theme-select"
            >
              <option value="en">{t.languageEnglish}</option>
              <option value="ru">{t.languageRussian}</option>
            </select>
          </div>
          <div class="form-group">
            <label for="theme-select">{t.colorTheme}</label>
            <select
              id="theme-select"
              value={selectedTheme}
              onChange={(e) => {
                const newTheme = (e.target as HTMLSelectElement).value as ThemeId;
                handleThemeChange(newTheme);
              }}
              class="theme-select"
            >
              {Object.values(themes).map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          </div>
          <div class="form-group">
            <label>{t.taskOrder}</label>
            <div class="toggle-container">
              <label class="toggle-label">
                <input
                  type="checkbox"
                  checked={taskOrderMode.value === 'priority'}
                  onChange={(e) => {
                    const isChecked = (e.target as HTMLInputElement).checked;
                    handleTaskOrderModeChange(isChecked ? 'priority' : 'fixed');
                  }}
                  class="toggle-input"
                />
                <span class="toggle-slider"></span>
                <span class="toggle-text">{t.taskOrderModeLabel}</span>
              </label>
            </div>
            <small class="form-hint toggle-description">
              {taskOrderMode.value === 'priority' ? t.taskOrderPriorityDesc : t.taskOrderFixedDesc}
            </small>
          </div>
        </div>
      </main>
    </div>
  );
}
