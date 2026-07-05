import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import {
  tasks,
  getSortedTasks,
  getDaysRemaining,
  getDaysOverdue,
  completeTask,
  undoComplete,
  cancelCompletion,
  checkDayChange,
  refreshTasksCompletedToday,
  tasksCompletedToday,
  lastCompletionId,
  currentDate,
  type Task,
} from '../store';
import { translations, currentLanguage } from '../i18n';
import { currentUser, signInWithGoogle } from '../lib/auth';
import { lists, getTasksInList, isTaskEffectivelyHidden } from '../lib/lists';
import { Header } from './Header';
import { Popup } from './Popup';
import { ChangeDatePopup } from './ChangeDatePopup';
import { TaskEditor } from './TaskEditor';

interface AppPageProps {
  path?: string; // Required by preact-router
}

interface ChangeDateState {
  taskId: string;
  completionId: string;
  dueDate: number;
  fresh: boolean; // completion was created just now (undo on cancel)
  prevDueDate: number;
}

export function AppPage({}: AppPageProps) {
  // 'new' = the add-task editor is open; a task id = that card is being edited.
  const [expandedId, setExpandedId] = useState<string | 'new' | null>(null);
  // Guest-only complete/undo bookkeeping: taskId -> pre-completion nextDueDate.
  const [localCompleted, setLocalCompleted] = useState<Map<string, number>>(new Map());
  const [changeDate, setChangeDate] = useState<ChangeDateState | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [, setCurrentTime] = useState(new Date());

  const t = translations[currentLanguage.value];
  const loggedIn = currentUser.value !== null;

  useEffect(() => {
    refreshTasksCompletedToday();
  }, []);

  // 60s tick: refresh clock + day-change check. Reset guest completion state on rollover.
  useEffect(() => {
    const tick = async () => {
      setCurrentTime(new Date());
      const before = currentDate.value;
      await checkDayChange().catch(err => console.error('[AppPage] checkDayChange error:', err));
      if (currentDate.value !== before) {
        setLocalCompleted(new Map());
      }
    };
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  const isDone = (task: Task): boolean =>
    loggedIn ? tasksCompletedToday.value.has(task.id) : localCompleted.has(task.id);

  const handleToggle = async (task: Task) => {
    if (loggedIn) {
      const info = tasksCompletedToday.value.get(task.id);
      if (info) {
        await cancelCompletion(task.id, info.completionId, info.dueDate);
      } else {
        await completeTask(task.id);
      }
      return;
    }
    // Guest path
    if (localCompleted.has(task.id)) {
      const prev = localCompleted.get(task.id)!;
      undoComplete(task.id, prev);
      setLocalCompleted(prev2 => {
        const next = new Map(prev2);
        next.delete(task.id);
        return next;
      });
    } else {
      const prev = task.nextDueDate;
      await completeTask(task.id);
      setLocalCompleted(prev2 => new Map(prev2).set(task.id, prev));
    }
  };

  const handleCalendar = async (task: Task) => {
    if (!loggedIn) {
      setShowLoginPrompt(true);
      return;
    }
    const info = tasksCompletedToday.value.get(task.id);
    if (info) {
      setChangeDate({
        taskId: task.id,
        completionId: info.completionId,
        dueDate: info.dueDate,
        fresh: false,
        prevDueDate: info.dueDate,
      });
      return;
    }
    // Not done today: create a completion, then let the user pick the real date.
    const prevDue = task.nextDueDate;
    const result = await completeTask(task.id);
    if (result.kind === 'already-today') {
      if (!result.completion) return;
      setChangeDate({
        taskId: task.id,
        completionId: result.completion.id,
        dueDate: result.completion.dueDate,
        fresh: false,
        prevDueDate: result.completion.dueDate,
      });
      return;
    }
    const completionId = lastCompletionId.value;
    if (!completionId) return;
    setChangeDate({
      taskId: task.id,
      completionId,
      dueDate: prevDue,
      fresh: true,
      prevDueDate: prevDue,
    });
  };

  const handleEdit = (task: Task) => {
    if (!loggedIn) {
      setShowLoginPrompt(true);
      return;
    }
    setExpandedId(task.id);
  };

  const handleChangeDateCancelled = () => {
    if (changeDate?.fresh) {
      undoComplete(changeDate.taskId, changeDate.prevDueDate);
    }
    setChangeDate(null);
  };

  const handleChangeDateSaved = () => {
    setChangeDate(null);
  };

  const handleLogin = async () => {
    setShowLoginPrompt(false);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const sortedTasks = getSortedTasks();

  // Lists that currently contain at least one existing task — only those are
  // worth offering as filters (mirrors the Dashboard's panel logic).
  const filterableLists = loggedIn
    ? lists.value.filter(l => getTasksInList(l.id).some(id => tasks.value.some(tk => tk.id === id)))
    : [];
  const showFilterBar = filterableLists.length > 0;
  const activeListId =
    selectedListId && filterableLists.some(l => l.id === selectedListId) ? selectedListId : null;
  // "All" hides tasks marked hidden (they live only inside their lists);
  // a selected list shows everything in it, hidden included.
  const visibleTasks = activeListId
    ? sortedTasks.filter(tk => getTasksInList(activeListId).includes(tk.id))
    : sortedTasks.filter(tk => !isTaskEffectivelyHidden(tk));
  const visibleTaskIds = visibleTasks.map(tk => tk.id);

  // Lists holding a hidden task that is due/overdue — their chips get an
  // attention color since the task isn't visible under "All".
  const listHasHiddenDue = (listId: string): boolean =>
    getTasksInList(listId).some(id => {
      const tk = tasks.value.find(x => x.id === id);
      return !!tk && !!tk.hidden && getDaysRemaining(tk) <= 0;
    });

  return (
    <div class="app">
      <Header currentView="app" onNavigate={(path) => route(path)} />

      <main class="app-page-main">
        {showFilterBar && (
          <div class="app-filter-bar">
            <button
              class={`app-filter-chip${activeListId === null ? ' active' : ''}`}
              onClick={() => setSelectedListId(null)}
            >
              {t.allTasks}
            </button>
            {filterableLists.map((list) => (
              <button
                key={list.id}
                class={`app-filter-chip${activeListId === list.id ? ' active' : ''}${listHasHiddenDue(list.id) ? ' has-hidden-due' : ''}`}
                onClick={() => setSelectedListId(list.id)}
              >
                {list.name}
              </button>
            ))}
          </div>
        )}

        <div class="app-card-list">
          {visibleTasks.length === 0 && expandedId !== 'new' && (
            <p class="empty-message">{t.noTasksConfigured}</p>
          )}

          {visibleTasks.map((task) => {
            const daysRemaining = getDaysRemaining(task);
            const overdue = daysRemaining <= 0;
            const daysOverdue = getDaysOverdue(task);
            const dueToday = overdue && daysOverdue === 0;
            const dueNum = overdue ? daysOverdue : daysRemaining;
            const done = isDone(task);
            const cardClass = `app-card${overdue ? ' overdue' : ''}${done ? ' done' : ''}`;

            if (expandedId === task.id) {
              return (
                <div key={task.id} class="app-card app-card-expanded">
                  <TaskEditor mode="edit" task={task} onDone={() => setExpandedId(null)} visibleTaskIds={visibleTaskIds} />
                </div>
              );
            }

            return (
              <div key={task.id} class={cardClass}>
                <button
                  class="app-card-main"
                  onClick={() => handleToggle(task)}
                  aria-label={done ? t.undo : t.markComplete}
                >
                  {done && (
                    <span class="app-card-done-check" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                  <span class="app-card-text">
                    <span class="app-card-name">{task.name}</span>
                    <span class="app-card-every">{t.everyDays(task.intervalDays)}</span>
                  </span>
                </button>

                <span class="app-card-due">
                  {dueToday ? (
                    <span class="app-card-due-today">{t.today}</span>
                  ) : (
                    <>
                      <span class="app-card-due-num">{dueNum}</span>
                      <span class="app-card-due-unit">{overdue ? t.daysAgo : t.daysUnit}</span>
                    </>
                  )}
                </span>
                <div class="app-card-actions">
                  <button
                    class="app-card-icon"
                    onClick={() => handleCalendar(task)}
                    aria-label={t.completeWithDate}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </button>
                  <button
                    class="app-card-icon"
                    onClick={() => handleEdit(task)}
                    aria-label={t.editTask}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {expandedId === 'new' ? (
            <div class="app-card app-card-expanded">
              <TaskEditor mode="add" onDone={() => setExpandedId(null)} />
            </div>
          ) : (
            <button class="app-add-row" onClick={() => setExpandedId('new')}>
              + {t.addTaskInline}
            </button>
          )}
        </div>
      </main>

      {changeDate && (
        <ChangeDatePopup
          taskId={changeDate.taskId}
          taskName={tasks.value.find(t => t.id === changeDate.taskId)?.name || ''}
          completionId={changeDate.completionId}
          dueDate={changeDate.dueDate}
          onCancelled={handleChangeDateCancelled}
          onSaved={handleChangeDateSaved}
        />
      )}

      {showLoginPrompt && (
        <Popup
          title={t.loginRequired}
          message={t.loginRequiredMessage}
          buttons={[
            { label: t.login, onClick: handleLogin, className: 'button-primary' },
            { label: t.ok, onClick: () => setShowLoginPrompt(false), className: 'button-secondary' },
          ]}
          onClose={() => setShowLoginPrompt(false)}
        />
      )}
    </div>
  );
}
