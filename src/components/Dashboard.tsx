import { useEffect, useState, useRef } from 'preact/hooks';
import { tasks, completeTask, getDaysRemaining, checkDayChange, getDueDate, getDaysOverdue, adjustTaskTime, type Task } from '../store';
import { translations, weekdays, months, type LanguageId } from '../i18n';
import textFit from 'textfit';

interface DashboardProps {
  selectedLanguage: LanguageId;
  onSettingsClick: () => void;
}

export function Dashboard({ selectedLanguage, onSettingsClick }: DashboardProps) {
  const [undoTaskId, setUndoTaskId] = useState<string | null>(null);
  const [undoPreviousTime, setUndoPreviousTime] = useState<number | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeAdjustPopup, setTimeAdjustPopup] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const isClosingPopupRef = useRef(false);
  const taskNameRefs = useRef<Map<string, HTMLElement>>(new Map());
  
  const t = translations[selectedLanguage];
  const weekdayNames = weekdays[selectedLanguage];
  const monthNames = months[selectedLanguage];

  // Close popup handler (simplified - backdrop handles clicks outside)
  const handleClosePopup = () => {
    isClosingPopupRef.current = true;
    setTimeAdjustPopup(null);
    setTimeout(() => {
      isClosingPopupRef.current = false;
    }, 0);
  };

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

  // Helper function to apply textFit to a single element
  const applyTextFitToElement = (element: HTMLElement) => {
    textFit(element, {
      minFontSize: 12,
      maxFontSize: 200,
      multiLine: true,
      alignVert: true,
      alignHoriz: true,
    });
    // Fix vertical centering by adjusting the wrapper height
    const wrapper = element.querySelector('*') as HTMLElement;
    if (wrapper) {
      // Set the wrapper height to auto so it only takes the space it needs
      wrapper.style.height = 'auto';
      wrapper.style.minHeight = '0';
      wrapper.style.maxHeight = 'none';
      // Use flexbox to center the actual content
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.justifyContent = 'center';
    }
  };

  // Helper function to apply textFit to all task name elements
  const applyTextFitToAll = () => {
    taskNameRefs.current.forEach((element) => {
      if (element) {
        applyTextFitToElement(element);
      }
    });
  };

  // Apply textFit to task names
  useEffect(() => {
    // Use requestAnimationFrame for immediate application
    const frameId = requestAnimationFrame(() => {
      // Double RAF to ensure layout is complete
      requestAnimationFrame(() => {
        applyTextFitToAll();
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [tasks.value, selectedLanguage]);

  // Recalculate textFit on window resize
  useEffect(() => {
    const handleResize = () => {
      applyTextFitToAll();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
    
    // Set timeout to auto-dismiss after 3 seconds
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

  return (
    <div class="app">
      <div class="time-bar">
        <div class="time-bar-content">
          <span class="time-display">{formatTime(currentTime)}</span>
          <span class="date-display">{formatDate(currentTime)}</span>
        </div>
      </div>
      <button class="settings-button" onClick={onSettingsClick} aria-label="Settings">
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
            <button class="button-primary" onClick={onSettingsClick}>
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
                  key={`${task.id}-${isOverdue}`}
                  class={`task-card ${isOverdue ? 'overdue' : ''}`}
                  onClick={() => handleCompleteTask(task.id)}
                >
                  {isOverdue ? (
                    <>
                      <div 
                        class="task-name-overdue"
                        ref={(el) => {
                          if (el) {
                            taskNameRefs.current.set(task.id, el);
                          } else {
                            taskNameRefs.current.delete(task.id);
                          }
                        }}
                      >
                        {t.timeTo} { task.name.toLowerCase()}
                      </div>
                      <span 
                        class="task-time"
                        onClick={(e) => handleTimeElementClick(e, task.id)}
                        style="cursor: pointer;"
                      >
                        {t.formatOverdueTime(getDaysOverdue(task))}
                      </span>
                      <div class="task-due-date">{formatDueDate(task)}</div>
                    </>
                  ) : (
                    <>
                      <div 
                        class="task-name"
                        ref={(el) => {
                          if (el) {
                            taskNameRefs.current.set(task.id, el);
                          } else {
                            taskNameRefs.current.delete(task.id);
                          }
                        }}
                      >
                        {task.name}
                      </div>
                      <span 
                        class="task-time"
                        onClick={(e) => handleTimeElementClick(e, task.id)}
                        style="cursor: pointer;"
                      >
                        {t.inDays(t.formatDays(daysRemaining))}
                      </span>
                      <div class="task-due-date">{formatDueDate(task)}</div>
                    </>
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

