import { useState, useEffect } from 'preact/hooks';
import { tasks, addTask, deleteTask, moveTaskUp, moveTaskDown, generateMagicLink, updateTask, type Task } from '../store';
import { themes, type ThemeId, getStoredTheme, saveTheme, applyTheme } from '../themes';
import { translations, type LanguageId, saveLanguage } from '../i18n';
import { Popup } from './Popup';

interface SettingsProps {
  selectedLanguage: LanguageId;
  onBackClick: () => void;
  onLanguageChange: (language: LanguageId) => void;
}

interface EditingTask {
  id: string;
  name: string;
  intervalDays: number | '';
}

export function Settings({ selectedLanguage, onBackClick, onLanguageChange }: SettingsProps) {
  const [taskName, setTaskName] = useState('');
  const [intervalDays, setIntervalDays] = useState<number | ''>(5);
  const [initialDaysOffset, setInitialDaysOffset] = useState<number | ''>('');
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(getStoredTheme());
  const [magicLinkCopied, setMagicLinkCopied] = useState(false);
  const [editingTasks, setEditingTasks] = useState<Map<string, EditingTask>>(new Map());
  const [showUnsavedChangesPopup, setShowUnsavedChangesPopup] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  
  const t = translations[selectedLanguage];
  
  // Check if there are unsaved changes (only if values actually differ from original)
  const hasUnsavedChanges = Array.from(editingTasks.entries()).some(([taskId, editingTask]) => {
    const originalTask = tasks.value.find(t => t.id === taskId);
    if (!originalTask) return false;
    const editingDays = typeof editingTask.intervalDays === 'number' ? editingTask.intervalDays : parseInt(String(editingTask.intervalDays)) || 0;
    return editingTask.name.trim() !== originalTask.name.trim() || 
           editingDays !== originalTask.intervalDays;
  });

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(selectedTheme);
  }, [selectedTheme]);

  const handleAddTask = (e: Event) => {
    e.preventDefault();
    const days = typeof intervalDays === 'number' ? intervalDays : parseInt(String(intervalDays)) || 0;
    if (taskName.trim() && days > 0) {
      const offset = initialDaysOffset === '' ? undefined : Number(initialDaysOffset);
      addTask(taskName.trim(), days, offset);
      setTaskName('');
      setIntervalDays(5);
      setInitialDaysOffset('');
    }
  };

  const handleDeleteTask = (id: string) => {
    setTaskToDelete(id);
  };

  const handleConfirmDelete = () => {
    if (taskToDelete) {
      deleteTask(taskToDelete);
      setTaskToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setTaskToDelete(null);
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

  const handleEditTask = (task: Task) => {
    const newEditingTasks = new Map(editingTasks);
    newEditingTasks.set(task.id, {
      id: task.id,
      name: task.name,
      intervalDays: task.intervalDays,
    });
    setEditingTasks(newEditingTasks);
  };

  const handleCancelEdit = (taskId: string) => {
    const newEditingTasks = new Map(editingTasks);
    newEditingTasks.delete(taskId);
    setEditingTasks(newEditingTasks);
  };

  const handleSaveEdit = (taskId: string) => {
    const editingTask = editingTasks.get(taskId);
    if (editingTask && editingTask.name.trim()) {
      const days = typeof editingTask.intervalDays === 'number' ? editingTask.intervalDays : parseInt(String(editingTask.intervalDays)) || 0;
      if (days > 0) {
        updateTask(taskId, editingTask.name.trim(), days);
        const newEditingTasks = new Map(editingTasks);
        newEditingTasks.delete(taskId);
        setEditingTasks(newEditingTasks);
      }
    }
  };

  const handleUpdateEditingTask = (taskId: string, field: 'name' | 'intervalDays', value: string | number | '') => {
    const editingTask = editingTasks.get(taskId);
    if (editingTask) {
      const newEditingTasks = new Map(editingTasks);
      if (field === 'intervalDays') {
        // Allow empty string, or parse the number
        const numValue: number | '' = value === '' ? '' : (typeof value === 'number' ? value : parseInt(String(value)) || '');
        newEditingTasks.set(taskId, {
          ...editingTask,
          intervalDays: numValue,
        });
      } else {
        newEditingTasks.set(taskId, {
          ...editingTask,
          name: value as string,
        });
      }
      setEditingTasks(newEditingTasks);
    }
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesPopup(true);
    } else {
      onBackClick();
    }
  };

  const handleSaveAndExit = () => {
    // Save all editing tasks
    editingTasks.forEach((editingTask) => {
      if (editingTask.name.trim()) {
        const days = typeof editingTask.intervalDays === 'number' ? editingTask.intervalDays : parseInt(String(editingTask.intervalDays)) || 0;
        if (days > 0) {
          updateTask(editingTask.id, editingTask.name.trim(), days);
        }
      }
    });
    setEditingTasks(new Map());
    setShowUnsavedChangesPopup(false);
    onBackClick();
  };

  const handleDiscardAndExit = () => {
    setEditingTasks(new Map());
    setShowUnsavedChangesPopup(false);
    onBackClick();
  };

  const handleStay = () => {
    setShowUnsavedChangesPopup(false);
  };

  return (
    <div class="app">
      <header class="header">
        <button class="icon-button" onClick={handleBackClick} aria-label={t.back}>
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
              onInput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setIntervalDays(val === '' ? '' : (parseInt(val) || ''));
              }}
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
          <button 
            type="submit" 
            class="button-primary"
            disabled={!taskName.trim() || intervalDays === '' || (typeof intervalDays === 'number' && intervalDays <= 0)}
          >
            {t.addTask}
          </button>
        </form>

        <div class="task-list">
          <h2>{t.yourTasks}</h2>
          {tasks.value.length === 0 ? (
            <p class="empty-message">{t.noTasksConfigured}</p>
          ) : (
            tasks.value.map((task, index) => {
              const isEditing = editingTasks.has(task.id);
              const editingTask = editingTasks.get(task.id);
              
              if (isEditing && editingTask) {
                return (
                  <div key={task.id} class="task-item task-item-editing">
                    <div class="task-item-content">
                      <input
                        type="text"
                        value={editingTask.name}
                        onInput={(e) => handleUpdateEditingTask(task.id, 'name', (e.target as HTMLInputElement).value)}
                        class="task-edit-input"
                        placeholder={t.taskNamePlaceholder}
                      />
                      <div class="task-edit-period">
                        <label>{t.frequencyDays}:</label>
                        <input
                          type="number"
                          inputmode="numeric"
                          min="1"
                          value={editingTask.intervalDays}
                          onInput={(e) => {
                            const val = (e.target as HTMLInputElement).value;
                            handleUpdateEditingTask(task.id, 'intervalDays', val === '' ? '' : (parseInt(val) || ''));
                          }}
                          class="task-edit-input task-edit-input-number"
                        />
                      </div>
                    </div>
                    <div class="task-item-actions">
                      <button
                        class="button-action button-save"
                        onClick={() => handleSaveEdit(task.id)}
                        aria-label="Save"
                        disabled={!editingTask.name.trim() || editingTask.intervalDays === '' || (typeof editingTask.intervalDays === 'number' && editingTask.intervalDays <= 0)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                      </button>
                      <button
                        class="button-action button-cancel"
                        onClick={() => handleCancelEdit(task.id)}
                        aria-label="Cancel"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              }
              
              return (
                <div key={task.id} class="task-item">
                  <div class="task-item-content">
                    <h3>{task.name}</h3>
                    <p>{t.everyDays(task.intervalDays)}</p>
                  </div>
                  <div class="task-item-actions">
                    <button
                      class="button-action button-reorder"
                      onClick={() => moveTaskUp(task.id)}
                      disabled={index === 0}
                      aria-label="Move up"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 15l-6-6-6 6"/>
                      </svg>
                    </button>
                    <button
                      class="button-action button-reorder"
                      onClick={() => moveTaskDown(task.id)}
                      disabled={index === tasks.value.length - 1}
                      aria-label="Move down"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </button>
                    <button
                      class="button-action button-edit"
                      onClick={() => handleEditTask(task)}
                      aria-label={t.editTask}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      class="button-action button-danger"
                      onClick={() => handleDeleteTask(task.id)}
                      aria-label={t.deleteTask}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
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
      {showUnsavedChangesPopup && (
        <Popup
          title={t.unsavedChanges}
          message={t.unsavedChangesMessage}
          buttons={[
            {
              label: t.saveAndExit,
              onClick: handleSaveAndExit,
              className: 'button-primary',
            },
            {
              label: t.discardAndExit,
              onClick: handleDiscardAndExit,
              className: 'button-danger',
            },
            {
              label: t.stay,
              onClick: handleStay,
              className: 'button-secondary',
            },
          ]}
          onClose={handleStay}
          selectedLanguage={selectedLanguage}
        />
      )}
      {taskToDelete && (() => {
        const task = tasks.value.find(t => t.id === taskToDelete);
        const taskName = task?.name || '';
        return (
          <Popup
            title={`${t.deleteTask} "${taskName}"`}
            message={t.deleteTaskMessage}
            buttons={[
              {
                label: t.delete,
                onClick: handleConfirmDelete,
                className: 'button-danger',
              },
              {
                label: t.keep,
                onClick: handleCancelDelete,
                className: 'button-secondary',
              },
            ]}
            onClose={handleCancelDelete}
            selectedLanguage={selectedLanguage}
          />
        );
      })()}
    </div>
  );
}

