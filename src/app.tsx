import { useEffect, useState } from 'preact/hooks';
import { tasks, addTask, deleteTask, completeTask, getDaysRemaining, checkDayChange, formatDaysRemaining, formatOverdueTime, moveTaskUp, moveTaskDown, formatDueDate } from './store';
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

  // Midnight auto-update: Check every 60 seconds if day has changed
  useEffect(() => {
    checkDayChange(); // Initial check
    const interval = setInterval(() => {
      checkDayChange();
    }, 60000); // Every 60 seconds

    return () => clearInterval(interval);
  }, []);

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
    }, 5000);
    
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
        localStorage.setItem('routine-tracker-tasks', JSON.stringify(updated));
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
    if (confirm('Delete this task?')) {
      deleteTask(id);
    }
  };

  // Dashboard View
  if (view === 'dashboard') {
    return (
      <div class="app">
        <button class="settings-button" onClick={() => setView('setup')} aria-label="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        {undoTaskId && (
          <div class="undo-toast" onClick={handleUndoDismiss}>
            <div class="undo-toast-content" onClick={(e) => e.stopPropagation()}>
              <div class="undo-toast-text">Task completed</div>
              <button class="undo-button" onClick={handleUndo} aria-label="Undo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6"/>
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                </svg>
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
              <p>No tasks yet.</p>
              <button class="button-primary" onClick={() => setView('setup')}>
                Add Your First Task
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
                        <h2 class="task-name-overdue">time to {task.name}</h2>
                        <p class="task-overdue-time">{formatOverdueTime(task)}</p>
                        <div class="task-due-date">{formatDueDate(task)}</div>
                      </div>
                    ) : daysRemaining === 0 ? (
                      <div class="task-content">
                        <h2 class="task-name">
                          {task.name}<span class="task-time">today</span>
                        </h2>
                        <div class="task-due-date">{formatDueDate(task)}</div>
                      </div>
                    ) : (
                      <div class="task-content">
                        <h2 class="task-name">
                          {task.name}<span class="task-time">in {formatDaysRemaining(daysRemaining)}</span>
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
      </div>
    );
  }

  // Setup View
  return (
    <div class="app">
      <header class="header">
        <button class="icon-button" onClick={() => setView('dashboard')} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Setup</h1>
        <div style="width: 24px;"></div>
      </header>
      <main class="setup">
        <form class="task-form" onSubmit={handleAddTask}>
          <h2>Add New Task</h2>
          <div class="form-group">
            <label for="task-name">Task Name</label>
            <input
              id="task-name"
              type="text"
              value={taskName}
              onInput={(e) => setTaskName((e.target as HTMLInputElement).value)}
              placeholder="e.g., Water flowers"
              required
            />
          </div>
          <div class="form-group">
            <label for="interval-days">Frequency (days)</label>
            <input
              id="interval-days"
              type="number"
              min="1"
              value={intervalDays}
              onInput={(e) => setIntervalDays(parseInt((e.target as HTMLInputElement).value) || 1)}
              required
            />
          </div>
          <div class="form-group">
            <label for="initial-days">Days until first completion (optional)</label>
            <input
              id="initial-days"
              type="number"
              min="0"
              value={initialDaysOffset}
              onInput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                setInitialDaysOffset(val === '' ? '' : parseInt(val) || 0);
              }}
              placeholder={`Default: ${intervalDays} days`}
            />
            <small class="form-hint">Leave empty to use frequency as default</small>
          </div>
          <button type="submit" class="button-primary">Add Task</button>
        </form>

        <div class="task-list">
          <h2>Your Tasks</h2>
          {tasks.value.length === 0 ? (
            <p class="empty-message">No tasks configured yet.</p>
          ) : (
            tasks.value.map((task, index) => (
              <div key={task.id} class="task-item">
                <div class="task-item-content">
                  <h3>{task.name}</h3>
                  <p>Every {task.intervalDays} day{task.intervalDays !== 1 ? 's' : ''}</p>
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
                    aria-label="Delete task"
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
      </main>
    </div>
  );
}
