import { useState, useEffect } from 'preact/hooks';
import { themes, type ThemeId, getStoredTheme, saveTheme, applyTheme } from '../themes';
import { translations, type LanguageId, saveLanguage } from '../i18n';
import { Header, type View } from './Header';
import { getCurrentUser, saveUserSettings } from '../lib/supabase';

interface SettingsPageProps {
  selectedLanguage: LanguageId;
  onNavigate: (view: View) => void;
  onLanguageChange: (language: LanguageId) => void;
  onUserLogin?: () => void;
}

export function SettingsPage({ selectedLanguage, onNavigate, onLanguageChange, onUserLogin }: SettingsPageProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(getStoredTheme());
  const t = translations[selectedLanguage];

  useEffect(() => {
    applyTheme(selectedTheme);
  }, [selectedTheme]);

  const handleLanguageChange = async (newLanguage: LanguageId) => {
    saveLanguage(newLanguage);
    onLanguageChange(newLanguage);
    // Sync to Supabase if logged in (fire-and-forget)
    const user = await getCurrentUser();
    if (user) {
      saveUserSettings({ language: newLanguage, theme: selectedTheme });
    }
  };

  const handleThemeChange = async (newTheme: ThemeId) => {
    setSelectedTheme(newTheme);
    saveTheme(newTheme);
    applyTheme(newTheme);
    // Sync to Supabase if logged in (fire-and-forget)
    const user = await getCurrentUser();
    if (user) {
      saveUserSettings({ language: selectedLanguage, theme: newTheme });
    }
  };

  return (
    <div class="app">
      <Header
        currentView="settings"
        onNavigate={onNavigate}
        onUserLogin={onUserLogin}
      />
      <main class="setup">
        <div class="settings-section">
          <h2>{t.theme}</h2>
          <div class="form-group">
            <label for="language-select">{t.language}</label>
            <select
              id="language-select"
              value={selectedLanguage}
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
        </div>
      </main>
    </div>
  );
}
