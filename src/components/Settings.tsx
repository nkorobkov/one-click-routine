import { useState, useEffect } from 'preact/hooks';
import { tasks, addTask, deleteTask, moveTaskUp, moveTaskDown, generateMagicLink } from '../store';
import { themes, type ThemeId, getStoredTheme, saveTheme, applyTheme } from '../themes';
import { translations, type LanguageId, getStoredLanguage, saveLanguage } from '../i18n';

interface SettingsProps {
  selectedLanguage: LanguageId;
  onBackClick: () => void;
  onLanguageChange: (language: LanguageId) => void;
}

export function Settings({ selectedLanguage, onBackClick, onLanguageChange }: SettingsProps) {
  const [taskName, setTaskName] = useState('');
  const [intervalDays, setIntervalDays] = useState(5);
  const [initialDaysOffset, setInitialDaysOffset] = useState<number | ''>('');
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(getStoredTheme());
  const [magicLinkCopied, setMagicLinkCopied] = useState(false);
  
  const t = translations[selectedLanguage];

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(selectedTheme);
  }, [selectedTheme]);

  const handleAddTask = (e: Event) => {
    e.preventDefault();
    if (taskName.trim() && intervalDays > 0) {
      const offset = initialDaysOffset === '' ? undefined : Number(initialDaysOffset);
      addTask(taskName.trim(), intervalDays, offset);
      setTaskName('');
      setIntervalDays(5);
      setInitialDaysOffset('');
    }
  };

  const handleDeleteTask = (id: string) => {
    if (confirm(t.deleteTaskConfirm)) {
      deleteTask(id);
    }
  };

  const handleCopyMagicLink = async () => {
    const link = generateMagicLink();
    if (link) {
      try {
        await navigator.clipboard.writeText(link);
        setMagicLinkCopied(true);
        setTimeout(() => setMagicLinkCopied(false), 2000);
      } catch (e) {
        console.error('Failed to copy link:', e);
        // Fallback: select the text
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setMagicLinkCopied(true);
          setTimeout(() => setMagicLinkCopied(false), 2000);
        } catch (err) {
          console.error('Fallback copy failed:', err);
        }
        document.body.removeChild(textArea);
      }
    }
  };

  return (
    <div class="app">
      <header class="header">
        <button class="icon-button" onClick={onBackClick} aria-label={t.back}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>{t.setup}</h1>
        <div style="width: 24px;"></div>
      </header>
      <main class="setup">
        <form class="task-form" onSubmit={handleAddTask}>
          <h2>{t.addNewTask}</h2>
          <div class="form-group">
            <label for="task-name">{t.taskName}</label>
            <input
              id="task-name"
              type="text"
              value={taskName}
              onInput={(e) => setTaskName((e.target as HTMLInputElement).value)}
              placeholder={t.taskNamePlaceholder}
              required
            />
          </div>
          <div class="form-group">
            <label for="interval-days">{t.frequencyDays}</label>
            <input
              id="interval-days"
              type="number"
              inputmode="numeric"
              min="1"
              value={intervalDays}
              onInput={(e) => setIntervalDays(parseInt((e.target as HTMLInputElement).value) || 1)}
              required
            />
          </div>
          <div class="form-group">
            <label for="initial-days">{t.daysUntilFirstCompletion}</label>
            <input
              id="initial-days"
              type="number"
              inputmode="numeric"
              min="0"
              value={initialDaysOffset}
              onInput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setInitialDaysOffset(val === '' ? '' : parseInt(val) || 0);
              }}
              placeholder={`${t.inDays(intervalDays.toString())}`}
            />
            <small class="form-hint">{t.daysUntilFirstCompletionHint}</small>
          </div>
          <button type="submit" class="button-primary">{t.addTask}</button>
        </form>

        <div class="task-list">
          <h2>{t.yourTasks}</h2>
          {tasks.value.length === 0 ? (
            <p class="empty-message">{t.noTasksConfigured}</p>
          ) : (
            tasks.value.map((task, index) => (
              <div key={task.id} class="task-item">
                <div class="task-item-content">
                  <h3>{task.name}</h3>
                  <p>{t.everyDays(task.intervalDays)}</p>
                </div>
                <div class="task-item-actions">
                  <button
                    class="button-reorder"
                    onClick={() => moveTaskUp(task.id)}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 15l-6-6-6 6"/>
                    </svg>
                  </button>
                  <button
                    class="button-reorder"
                    onClick={() => moveTaskDown(task.id)}
                    disabled={index === tasks.value.length - 1}
                    aria-label="Move down"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>
                  <button
                    class="button-danger"
                    onClick={() => handleDeleteTask(task.id)}
                    aria-label={t.deleteTask}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div class="settings-section">
          <h2>{t.shareTasks}</h2>
          {tasks.value.length === 0 ? (
            <p class="empty-message">{t.noTasksToShare}</p>
          ) : (
            <div class="form-group">
              <label>{t.shareLinkDescription}</label>
              <div class="magic-link-container">
                <input
                  type="text"
                  readOnly
                  value={generateMagicLink()}
                  class="magic-link-input"
                  id="magic-link-input"
                />
                <button
                  type="button"
                  class={`button-copy ${magicLinkCopied ? 'copied' : ''}`}
                  onClick={handleCopyMagicLink}
                  aria-label={magicLinkCopied ? t.linkCopied : t.copyLink}
                >
                  {magicLinkCopied ? t.linkCopied : t.copyLink}
                </button>
              </div>
              <small class="form-hint">{t.shareLinkHint}</small>
            </div>
          )}
        </div>
        <div class="settings-section">
          <h2>{t.theme}</h2>
          <div class="form-group">
            <label for="language-select">{t.language}</label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => {
                const newLanguage = (e.target as HTMLSelectElement).value as LanguageId;
                saveLanguage(newLanguage);
                onLanguageChange(newLanguage);
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
                setSelectedTheme(newTheme);
                saveTheme(newTheme);
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

