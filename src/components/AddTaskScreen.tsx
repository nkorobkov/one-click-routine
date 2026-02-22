import { useState } from 'preact/hooks';
import { tasks, addTask, deleteTask, moveTaskUp, moveTaskDown, updateTask, type Task } from '../store';
import { translations, type LanguageId } from '../i18n';
import { currentUser, signInWithGoogle } from '../lib/auth';
import { Popup } from './Popup';
import { Header, type View } from './Header';

interface AddTaskScreenProps {
  selectedLanguage: LanguageId;
  onNavigate: (view: View) => void;
}

interface EditingTask {
  id: string;
  name: string;
  intervalDays: number | '';
}

export function AddTaskScreen({ selectedLanguage, onNavigate }: AddTaskScreenProps) {
  const [taskName, setTaskName] = useState('');
  const [intervalDays, setIntervalDays] = useState<number | ''>(5);
  const [initialDaysOffset, setInitialDaysOffset] = useState<number | ''>('');
  const [editingTasks, setEditingTasks] = useState<Map<string, EditingTask>>(new Map());
  const [showUnsavedChangesPopup, setShowUnsavedChangesPopup] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<View | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showLoginRequiredPopup, setShowLoginRequiredPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const t = translations[selectedLanguage];
  const loggedIn = currentUser.value !== null;

  // Check if there are unsaved changes (only if values actually differ from original)
  const hasUnsavedChanges = Array.from(editingTasks.entries()).some(([taskId, editingTask]) => {
    const originalTask = tasks.value.find(t => t.id === taskId);
    if (!originalTask) return false;
    const editingDays = typeof editingTask.intervalDays === 'number' ? editingTask.intervalDays : parseInt(String(editingTask.intervalDays)) || 0;
    return editingTask.name.trim() !== originalTask.name.trim() ||
           editingDays !== originalTask.intervalDays;
  });

  const handleAddTask = async (e: Event) => {
    e.preventDefault();
    const days = typeof intervalDays === 'number' ? intervalDays : parseInt(String(intervalDays)) || 0;
    if (taskName.trim() && days > 0) {
      setIsSubmitting(true);
      setErrorMessage(null);
      const offset = initialDaysOffset === '' ? undefined : Number(initialDaysOffset);
      const success = await addTask(taskName.trim(), days, offset);
      setIsSubmitting(false);

      if (success) {
        setTaskName('');
        setIntervalDays(5);
        setInitialDaysOffset('');
        // Show login prompt for non-logged-in users
        if (!loggedIn) {
          setShowLoginPrompt(true);
        }
      } else {
        setErrorMessage(t.addTaskFailed);
      }
    }
  };

  const handleDeleteTask = (id: string) => {
    setTaskToDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (taskToDelete) {
      setIsDeleting(true);
      setErrorMessage(null);
      const success = await deleteTask(taskToDelete);
      setIsDeleting(false);
      if (success) {
        setTaskToDelete(null);
      } else {
        setErrorMessage(t.deleteTaskFailed);
      }
    }
  };

  const handleCancelDelete = () => {
    setTaskToDelete(null);
  };

  const handleEditTask = (task: Task) => {
    // Non-logged-in users cannot edit — show login required popup
    if (!loggedIn) {
      setShowLoginRequiredPopup(true);
      return;
    }

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

  const handleSaveEdit = async (taskId: string) => {
    const editingTask = editingTasks.get(taskId);
    if (editingTask && editingTask.name.trim()) {
      const days = typeof editingTask.intervalDays === 'number' ? editingTask.intervalDays : parseInt(String(editingTask.intervalDays)) || 0;
      if (days > 0) {
        setSavingTaskId(taskId);
        setErrorMessage(null);
        const success = await updateTask(taskId, editingTask.name.trim(), days);
        setSavingTaskId(null);
        if (success) {
          const newEditingTasks = new Map(editingTasks);
          newEditingTasks.delete(taskId);
          setEditingTasks(newEditingTasks);
        } else {
          setErrorMessage(t.updateTaskFailed);
        }
      }
    }
  };

  const handleUpdateEditingTask = (taskId: string, field: 'name' | 'intervalDays', value: string | number | '') => {
    const editingTask = editingTasks.get(taskId);
    if (editingTask) {
      const newEditingTasks = new Map(editingTasks);
      if (field === 'intervalDays') {
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

  const handleNavigateWithCheck = (view: View) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(view);
      setShowUnsavedChangesPopup(true);
    } else {
      onNavigate(view);
    }
  };

  const handleSaveAndExit = async () => {
    // Save all editing tasks (pessimistic)
    for (const [, editingTask] of editingTasks) {
      if (editingTask.name.trim()) {
        const days = typeof editingTask.intervalDays === 'number' ? editingTask.intervalDays : parseInt(String(editingTask.intervalDays)) || 0;
        if (days > 0) {
          const success = await updateTask(editingTask.id, editingTask.name.trim(), days);
          if (!success) {
            setErrorMessage(t.updateTaskFailed);
            setShowUnsavedChangesPopup(false);
            return; // Stop on first failure
          }
        }
      }
    }
    setEditingTasks(new Map());
    setShowUnsavedChangesPopup(false);
    if (pendingNavigation) {
      onNavigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  const handleDiscardAndExit = () => {
    setEditingTasks(new Map());
    setShowUnsavedChangesPopup(false);
    if (pendingNavigation) {
      onNavigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  const handleStay = () => {
    setShowUnsavedChangesPopup(false);
    setPendingNavigation(null);
  };

  const handleLoginFromPrompt = async () => {
    setShowLoginPrompt(false);
    setShowLoginRequiredPopup(false);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div class="app">
      <Header
        currentView="addTask"
        onNavigate={(view) => handleNavigateWithCheck(view)}
        onDashboardClick={() => handleNavigateWithCheck('dashboard')}
      />
      <main class="setup">
        <form class="task-form" onSubmit={handleAddTask}>
          <h2>{t.addNewTask}</h2>
          {errorMessage && (
            <div style="color: var(--danger); padding: 8px 12px; border-radius: 8px; background: rgba(255,59,48,0.1); margin-bottom: 12px; font-size: 0.9em;">
              {errorMessage}
            </div>
          )}
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
            disabled={!taskName.trim() || intervalDays === '' || (typeof intervalDays === 'number' && intervalDays <= 0) || isSubmitting}
          >
            {isSubmitting ? '...' : t.addTask}
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
              const isSaving = savingTaskId === task.id;

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
                        disabled={isSaving}
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
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                    <div class="task-item-actions">
                      <button
                        class="button-action button-save"
                        onClick={() => handleSaveEdit(task.id)}
                        aria-label="Save"
                        disabled={!editingTask.name.trim() || editingTask.intervalDays === '' || (typeof editingTask.intervalDays === 'number' && editingTask.intervalDays <= 0) || isSaving}
                      >
                        {isSaving ? (
                          <span style="font-size: 12px;">...</span>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        )}
                      </button>
                      <button
                        class="button-action button-cancel"
                        onClick={() => handleCancelEdit(task.id)}
                        aria-label="Cancel"
                        disabled={isSaving}
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
                      class={`button-action button-edit${!loggedIn ? ' button-disabled' : ''}`}
                      onClick={() => handleEditTask(task)}
                      aria-label={t.editTask}
                      style={!loggedIn ? 'opacity: 0.4; cursor: not-allowed;' : ''}
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
                label: isDeleting ? '...' : t.delete,
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
          selectedLanguage={selectedLanguage}
        />
      )}
      {showLoginRequiredPopup && (
        <Popup
          title={t.loginRequired}
          message={t.loginRequiredMessage}
          buttons={[
            {
              label: t.login,
              onClick: handleLoginFromPrompt,
              className: 'button-primary',
            },
            {
              label: t.ok,
              onClick: () => setShowLoginRequiredPopup(false),
              className: 'button-secondary',
            },
          ]}
          onClose={() => setShowLoginRequiredPopup(false)}
          selectedLanguage={selectedLanguage}
        />
      )}
    </div>
  );
}
