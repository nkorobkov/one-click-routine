import { useEffect, useState, useRef } from 'preact/hooks';
import { tasks, addTask, deleteTask, completeTask, getDaysRemaining, checkDayChange, moveTaskUp, moveTaskDown, type Task, getDueDate, getDaysOverdue, generateMagicLink, importTasksFromLink, adjustTaskTime } from './store';
import { themes, type ThemeId, getStoredTheme, saveTheme, applyTheme } from './themes';
import { translations, weekdays, months, type LanguageId, getStoredLanguage, saveLanguage } from './i18n';
import './app.css';

type View = 'dashboard' | 'setup';

export function App() {
  const [view, setView] = useState<View>('dashboard');
  const [taskName, setTaskName] = useState('');
  const [intervalDays, setIntervalDays] = useState(5);
  const [initialDaysOffset, setInitialDaysOffset] = useState<number | ''>('');
  const [undoTaskId, setUndoTaskId] = useState<string | null>(null);
  const [undoPreviousTime, setUndoPreviousTime] = useState<number | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(getStoredTheme());
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageId>(getStoredLanguage());
  const [magicLinkCopied, setMagicLinkCopied] = useState(false);
  const [timeAdjustPopup, setTimeAdjustPopup] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const isClosingPopupRef = useRef(false);
  
  const t = translations[selectedLanguage];
  const weekdayNames = weekdays[selectedLanguage];
  const monthNames = months[selectedLanguage];

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

  // Close popup handler (simplified - backdrop handles clicks outside)
  const handleClosePopup = () => {
    isClosingPopupRef.current = true;
    setTimeAdjustPopup(null);
    setTimeout(() => {
      isClosingPopupRef.current = false;
    }, 0);
  };

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(selectedTheme);
  }, [selectedTheme]);

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date());
    };
    updateTime(); // Initial update
    const timeInterval = setInterval(updateTime, 60000); // Every minute
    
    return () => clearInterval(timeInterval);
  }, []);

  // Midnight auto-update: Check every 60 seconds if day has changed
  useEffect(() => {
    checkDayChange(); // Initial check
    const interval = setInterval(() => {
      checkDayChange();
    }, 60000); // Every 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Format time and date using translations
  const formatTime = (date: Date): string => {
    return t.timeFormat(date.getHours(), date.getMinutes());
  };

  const formatDate = (date: Date): string => {
    return t.dateFormat(weekdayNames[date.getDay()], date.getDate(), monthNames[date.getMonth()]);
  };
  
  const formatDueDate = (task: Task): string => {
    return formatDate(getDueDate(task));
  };

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

  const handleCompleteTask = (id: string) => {
    // If clicking the same task that's showing undo toast, close toast and complete
    if (undoTaskId === id && undoTaskId !== null) {
      handleUndoDismiss();
      return; // Task is already completed, just closing the toast
    }
    
    // If clicking a different task while undo toast is showing, confirm the previous task
    if (undoTaskId !== null && undoTaskId !== id) {
      // Dismiss previous undo toast (this confirms that task)
      handleUndoDismiss();
    }
    
    // Store previous lastCompleted before completing
    const task = tasks.value.find((t) => t.id === id);
    if (!task) return;
    
    const previousTime = task.lastCompleted;
    
    // Complete the task
    completeTask(id);
    
    // Show undo toast with previous time
    setUndoTaskId(id);
    setUndoPreviousTime(previousTime);
    
    // Clear any existing timeout
    if (undoTimeout !== null) {
      clearTimeout(undoTimeout);
    }
    
    // Set timeout to auto-dismiss after 5 seconds
    const timeout = window.setTimeout(() => {
      setUndoTaskId(null);
      setUndoPreviousTime(null);
      setUndoTimeout(null);
    }, 3000);
    
    setUndoTimeout(timeout);
  };

  const handleUndo = () => {
    if (undoTaskId && undoPreviousTime !== null && undoTimeout !== null) {
      clearTimeout(undoTimeout);
      
      // Revert the completion by restoring previous lastCompleted
      const updated = tasks.value.map((t) =>
        t.id === undoTaskId ? { ...t, lastCompleted: undoPreviousTime } : t
      );
      tasks.value = updated;
      
      // Save to localStorage (using the saveTasks function from store)
      try {
        localStorage.setItem('one-click-routine-tasks', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save tasks:', e);
      }
      
      setUndoTaskId(null);
      setUndoPreviousTime(null);
      setUndoTimeout(null);
    }
  };

  const handleUndoDismiss = () => {
    if (undoTimeout !== null) {
      clearTimeout(undoTimeout);
    }
    setUndoTaskId(null);
    setUndoPreviousTime(null);
    setUndoTimeout(null);
  };

  const handleDeleteTask = (id: string) => {
    if (confirm(t.deleteTaskConfirm)) {
      deleteTask(id);
    }
  };

  const handleTimeElementClick = (e: Event, taskId: string) => {
    e.stopPropagation(); // Prevent task completion
    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    // Position popup above the element, centered horizontally
    setTimeAdjustPopup({
      taskId,
      x: rect.left + rect.width / 2, // Center horizontally
      y: rect.top, // Top of the element (popup will be positioned above via CSS transform)
    });
  };

  const handleAdjustTime = (taskId: string, delta: number) => {
    adjustTaskTime(taskId, delta);
    // Keep popup open for multiple adjustments
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

  // Dashboard View
  if (view === 'dashboard') {
    return (
      <div class="app">
        <div class="time-bar">
          <div class="time-bar-content">
            <span class="time-display">{formatTime(currentTime)}</span>
            <span class="date-display">{formatDate(currentTime)}</span>
          </div>
        </div>
        <button class="settings-button" onClick={() => setView('setup')} aria-label="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        {undoTaskId && (
          <div class="undo-toast" onClick={handleUndoDismiss}>
            <div class="undo-toast-content" onClick={(e) => e.stopPropagation()}>
              <div class="undo-toast-text">{tasks.value.find((t) => t.id === undoTaskId)?.name} {t.taskCompleted}</div>
              <button class="undo-button" onClick={handleUndo} aria-label={t.undo}>
                {t.undo}
              </button>
              <div class="undo-progress-bar" key={undoTaskId}>
                <div class="undo-progress-fill"></div>
              </div>
            </div>
          </div>
        )}
        <main class="dashboard">
          {tasks.value.length === 0 ? (
            <div class="empty-state">
              <p>{t.noTasksYet}</p>
              <button class="button-primary" onClick={() => setView('setup')}>
                {t.addYourFirstTask}
              </button>
            </div>
          ) : (
            <div class="task-list">
              {tasks.value.map((task) => {
                const daysRemaining = getDaysRemaining(task);
                const isOverdue = daysRemaining <= 0;
                return (
                  <button
                    key={task.id}
                    class={`task-card ${isOverdue ? 'overdue' : ''}`}
                    onClick={() => handleCompleteTask(task.id)}
                  >
                    {isOverdue ? (
                      <div class="task-content-overdue">
                        <h2 class="task-name-overdue">{t.timeTo} {task.name}</h2>
                        <p 
                          class="task-overdue-time"
                          onClick={(e) => handleTimeElementClick(e, task.id)}
                          style="cursor: pointer;"
                        >
                          {t.formatOverdueTime(getDaysOverdue(task))}
                        </p>
                        <div class="task-due-date">{formatDueDate(task)}</div>
                      </div>
                    ) : daysRemaining === 0 ? (
                      <div class="task-content">
                        <h2 class="task-name">
                          {task.name}
                          <span 
                            class="task-time"
                            onClick={(e) => handleTimeElementClick(e, task.id)}
                            style="cursor: pointer;"
                          >
                            {t.today}
                          </span>
                        </h2>
                        <div class="task-due-date">{formatDueDate(task)}</div>
                      </div>
                    ) : (
                      <div class="task-content">
                        <h2 class="task-name">
                          {task.name}
                          <span 
                            class="task-time"
                            onClick={(e) => handleTimeElementClick(e, task.id)}
                            style="cursor: pointer;"
                          >
                            {t.inDays(t.formatDays(daysRemaining))}
                          </span>
                        </h2>
                        <div class="task-due-date">{formatDueDate(task)}</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </main>
        {timeAdjustPopup && (
          <>
            <div
              class="time-adjust-popup-backdrop"
              onClick={handleClosePopup}
            />
            <div
              ref={popupRef}
              class="time-adjust-popup"
              style={`left: ${timeAdjustPopup.x}px; top: ${timeAdjustPopup.y}px;`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                class="time-adjust-button"
                onClick={() => {
                  handleAdjustTime(timeAdjustPopup.taskId, -1);
                  // Remove focus to prevent stuck highlighting
                  (document.activeElement as HTMLElement)?.blur();
                }}
                aria-label="Subtract one day"
              >
                −
              </button>
              <button
                class="time-adjust-button"
                onClick={() => {
                  handleAdjustTime(timeAdjustPopup.taskId, 1);
                  // Remove focus to prevent stuck highlighting
                  (document.activeElement as HTMLElement)?.blur();
                }}
                aria-label="Add one day"
              >
                +
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Setup View
  return (
    <div class="app">
      <header class="header">
        <button class="icon-button" onClick={() => setView('dashboard')} aria-label={t.back}>
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
                setSelectedLanguage(newLanguage);
                saveLanguage(newLanguage);
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
