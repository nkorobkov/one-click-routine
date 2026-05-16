import { useEffect, useLayoutEffect, useState, useRef } from 'preact/hooks';
import { route } from 'preact-router';
import { tasks, completeTask, undoComplete, cancelCompletion, getDaysRemaining, checkDayChange, getDueDate, getDaysOverdue, adjustTaskTime, getSortedTasks, lastCompletionId, tasksCompletedToday, refreshTasksCompletedToday, type Task } from '../store';
import { translations, weekdays, months, currentLanguage } from '../i18n';
import { currentUser, signInWithGoogle } from '../lib/auth';
import { Popup } from './Popup';
import { ChangeDatePopup } from './ChangeDatePopup';
import textFit from 'textfit';
import { lists, getTasksInList } from '../lib/lists';

interface DashboardProps {
  path?: string; // Required by preact-router
}

export function Dashboard({}: DashboardProps) {
  const [undoTaskId, setUndoTaskId] = useState<string | null>(null);
  const [undoPreviousTime, setUndoPreviousTime] = useState<number | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<number | null>(null);
  const [alreadyTodayCompletionId, setAlreadyTodayCompletionId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeAdjustPopup, setTimeAdjustPopup] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [activePanel, setActivePanel] = useState(1); // Start at "All Tasks" panel
  const [changeDateCompletionId, setChangeDateCompletionId] = useState<string | null>(null);
  const [toastPaused, setToastPaused] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const isClosingPopupRef = useRef(false);
  const taskNameRefs = useRef<Map<string, HTMLElement>>(new Map());
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  const lang = currentLanguage.value;
  const t = translations[lang];
  const weekdayNames = weekdays[lang];
  const monthNames = months[lang];

  // Track active panel on scroll
  const handleScroll = () => {
    if (!swipeContainerRef.current) return;
    const scrollLeft = swipeContainerRef.current.scrollLeft;
    const panelWidth = swipeContainerRef.current.offsetWidth;
    const newIndex = Math.round(scrollLeft / panelWidth);
    setActivePanel(newIndex);
  };

  // Scroll to "All Tasks" panel (index 1) on mount - use useLayoutEffect to prevent flash
  useLayoutEffect(() => {
    if (swipeContainerRef.current) {
      const container = swipeContainerRef.current;
      // Temporarily disable smooth scrolling for instant positioning
      const originalScrollBehavior = container.style.scrollBehavior;
      container.style.scrollBehavior = 'auto';

      const panelWidth = container.offsetWidth;
      container.scrollLeft = panelWidth * 1; // Scroll to index 1 (All Tasks)

      // Restore smooth scrolling for user interactions
      // Use setTimeout to ensure it's restored after the scroll completes
      setTimeout(() => {
        container.style.scrollBehavior = originalScrollBehavior;
      }, 0);
    }
  }, []); // Empty dependency array = run once on mount

  // Close popup handler (simplified - backdrop handles clicks outside)
  const handleClosePopup = () => {
    isClosingPopupRef.current = true;
    setTimeAdjustPopup(null);
    setTimeout(() => {
      isClosingPopupRef.current = false;
    }, 0);
  };

  // 60s tick: refresh clock + run day-change check
  useEffect(() => {
    const tick = () => {
      setCurrentTime(new Date());
      checkDayChange().catch(err => console.error('[Dashboard] checkDayChange error:', err));
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    refreshTasksCompletedToday();
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
  }, [tasks.value, lang, activePanel, lists.value]);

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

  const startToastAutoDismiss = () => {
    const timeout = window.setTimeout(() => {
      handleUndoDismiss();
    }, 6000);
    setUndoTimeout(timeout);
  };

  const handleCompleteTask = async (id: string) => {
    if (undoTaskId === id && undoTaskId !== null) {
      handleUndoDismiss();
      return;
    }

    if (undoTaskId !== null && undoTaskId !== id) {
      handleUndoDismiss();
    }

    const task = tasks.value.find((t) => t.id === id);
    if (!task) return;

    const previousTime = task.nextDueDate;
    const result = await completeTask(id);

    if (result.kind === 'already-today') {
      if (!result.completion) return;
      setUndoTaskId(id);
      setUndoPreviousTime(result.completion.dueDate);
      setAlreadyTodayCompletionId(result.completion.id);
      if (undoTimeout !== null) clearTimeout(undoTimeout);
      startToastAutoDismiss();
      return;
    }

    setUndoTaskId(id);
    setUndoPreviousTime(previousTime);
    setAlreadyTodayCompletionId(null);
    if (undoTimeout !== null) clearTimeout(undoTimeout);
    startToastAutoDismiss();

    if (!currentUser.value) {
      setShowLoginPrompt(true);
    }
  };

  const handleUndo = () => {
    if (undoTaskId && undoPreviousTime !== null && undoTimeout !== null) {
      clearTimeout(undoTimeout);
      undoComplete(undoTaskId, undoPreviousTime);
      handleUndoDismiss();
    }
  };

  const handleCancelToday = async () => {
    if (!undoTaskId || !alreadyTodayCompletionId || undoPreviousTime === null) return;
    if (undoTimeout !== null) clearTimeout(undoTimeout);
    setToastPaused(true);
    const ok = await cancelCompletion(undoTaskId, alreadyTodayCompletionId, undoPreviousTime);
    if (!ok) {
      // Cancel failed — keep the toast open so the user can retry.
      setToastPaused(false);
      startToastAutoDismiss();
      return;
    }
    handleUndoDismiss();
  };

  const handleUndoDismiss = () => {
    if (undoTimeout !== null) {
      clearTimeout(undoTimeout);
    }
    setUndoTaskId(null);
    setUndoPreviousTime(null);
    setUndoTimeout(null);
    setAlreadyTodayCompletionId(null);
    setToastPaused(false);
  };

  const isAlreadyTodayMode = alreadyTodayCompletionId !== null;
  const popupCompletionId = isAlreadyTodayMode ? alreadyTodayCompletionId : lastCompletionId.value;

  const handleOpenChangeDate = () => {
    if (!popupCompletionId) return;
    if (undoTimeout !== null) {
      clearTimeout(undoTimeout);
      setUndoTimeout(null);
    }
    setToastPaused(true);
    setChangeDateCompletionId(popupCompletionId);
  };

  const handleCancelledChangeDate = () => {
    // In "fresh" mode, dismissing the date picker reverts the completion the
    // user just made. In "already-today" mode the completion existed before
    // the popup opened, so we leave it alone and just close the popup.
    if (!isAlreadyTodayMode && undoTaskId !== null && undoPreviousTime !== null) {
      undoComplete(undoTaskId, undoPreviousTime);
      setChangeDateCompletionId(null);
      handleUndoDismiss();
      return;
    }
    setChangeDateCompletionId(null);
    setToastPaused(false);
    handleUndoDismiss();
  };

  const handleSavedChangeDate = () => {
    setChangeDateCompletionId(null);
    handleUndoDismiss();
  };

  const handleLoginFromPrompt = async () => {
    setShowLoginPrompt(false);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
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

  // Helper function to render task cards
  const renderTaskCard = (task: Task, panelIndex: number) => {
    const daysRemaining = getDaysRemaining(task);
    const isOverdue = daysRemaining <= 0;
    const wasDoneToday = tasksCompletedToday.value.has(task.id);
    // Use composite key for ref: panelIndex-taskId to handle same task in multiple panels
    const refKey = `${panelIndex}-${task.id}`;
    return (
      <button
        key={`${task.id}-${isOverdue}`}
        class={`task-card ${isOverdue ? 'overdue' : ''}`}
        onClick={() => handleCompleteTask(task.id)}
      >
        {wasDoneToday && (
          <div class="task-card-done-badge" aria-label={t.alreadyCompletedToday}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
        )}
        {isOverdue ? (
          <>
            <div
              class="task-name-overdue"
              ref={(el) => {
                if (el) {
                  taskNameRefs.current.set(refKey, el);
                } else {
                  taskNameRefs.current.delete(refKey);
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
                  taskNameRefs.current.set(refKey, el);
                } else {
                  taskNameRefs.current.delete(refKey);
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
  };

  // Generate panels: "Due Tasks" + "All Tasks" + one per list (only lists with tasks)
  // Apply sorting based on task order mode
  const sortedTasks = getSortedTasks();
  const dueTasks = getSortedTasks(sortedTasks.filter(task => getDaysRemaining(task) <= 0));
  const panelsData = [
    { name: t.dueTasks, tasks: dueTasks, isDuePanel: true },
    { name: t.allTasks, tasks: sortedTasks, isDuePanel: false },
    ...lists.value
      .map(list => {
        const taskIds = getTasksInList(list.id);
        const listTasks = sortedTasks.filter(task => taskIds.includes(task.id));
        return { name: list.name, tasks: listTasks, isDuePanel: false };
      })
      .filter(panel => panel.tasks.length > 0) // Only show lists with tasks
  ];

  const currentPanelName = panelsData[activePanel]?.name || t.allTasks;

  return (
    <div class="app">
      <div class="time-bar">
        <div class="time-bar-content">
          <span class="time-display">{formatTime(currentTime)}</span>
          <span class="date-display">{formatDate(currentTime)}</span>
        </div>
        {currentUser.value && lists.value.length > 0 && (
          <div class="time-bar-list-name">{currentPanelName}</div>
        )}
      </div>
      <button class="settings-button" onClick={() => route('/add')} aria-label="Settings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      {undoTaskId && (
        <>
          <div class="undo-toast-backdrop" onClick={handleUndoDismiss} />
          <div class="undo-toast">
            <div class="undo-toast-content" onClick={(e) => e.stopPropagation()}>
              <div class="undo-toast-text">
                {tasks.value.find((t) => t.id === undoTaskId)?.name}{' '}
                {isAlreadyTodayMode ? t.alreadyCompletedToday : t.taskCompleted}
                {!currentUser.value && !isAlreadyTodayMode && (
                  <div style="font-size: 0.75em; opacity: 0.8; margin-top: 2px;">{t.loginToSaveMessage}</div>
                )}
              </div>
              <div class="undo-toast-actions">
                {currentUser.value && popupCompletionId && (
                  <button class="undo-button-secondary" onClick={handleOpenChangeDate}>
                    {t.changeDate}
                  </button>
                )}
                {isAlreadyTodayMode ? (
                  <button class="undo-button" onClick={handleCancelToday}>
                    {t.cancelTodaysCompletion}
                  </button>
                ) : (
                  <button class="undo-button" onClick={handleUndo} aria-label={t.undo}>
                    {t.undo}
                  </button>
                )}
              </div>
              <div class="undo-progress-bar" key={undoTaskId}>
                <div class={`undo-progress-fill${toastPaused ? ' paused' : ''}`}></div>
              </div>
            </div>
          </div>
        </>
      )}
      {changeDateCompletionId && undoTaskId && undoPreviousTime !== null && (
        <ChangeDatePopup
          taskId={undoTaskId}
          taskName={tasks.value.find((t) => t.id === undoTaskId)?.name || ''}
          completionId={changeDateCompletionId}
          dueDate={undoPreviousTime}
          onCancelled={handleCancelledChangeDate}
          onSaved={handleSavedChangeDate}
        />
      )}
      {/* Swipeable container */}
      <div
        ref={swipeContainerRef}
        class="dashboard-swipe-container"
        onScroll={handleScroll}
      >
        {panelsData.map((panel, index) => (
          <main key={index} class="dashboard dashboard-panel">
            {panel.tasks.length === 0 ? (
              <div class="empty-state">
                {panel.isDuePanel ? (
                  <p>{t.noTasksDue}</p>
                ) : (
                  <>
                    <h1 class="app-title">One-Click Routine</h1>
                    <p class="app-description">Recurring tasks that count from completion, not from the calendar.
                    One-click tracking for maintenance, health, and household routines</p>
                    <p>{t.noTasksYet}</p>
                    <button class="button-primary" onClick={() => route('/add')}>
                      {t.addYourFirstTask}
                    </button>
                    <div class="empty-state-footer">
                      <a href="/privacy.html" target="_blank" rel="noopener noreferrer">
                        Privacy Policy
                      </a>
                      <span class="footer-separator">•</span>
                      <a href="/terms.html" target="_blank" rel="noopener noreferrer">
                        Terms of Service
                      </a>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div class="task-list">
                {panel.tasks.map(task => renderTaskCard(task, index))}
              </div>
            )}
          </main>
        ))}
      </div>
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
      {showLoginPrompt && (
        <Popup
          title={t.loginToSave}
          message={t.loginToSaveMessage}
          buttons={[
            {
              label: t.login,
              onClick: handleLoginFromPrompt,
              className: 'button-primary',
            },
            {
              label: t.ok,
              onClick: () => setShowLoginPrompt(false),
              className: 'button-secondary',
            },
          ]}
          onClose={() => setShowLoginPrompt(false)}
        />
      )}
    </div>
  );
}

