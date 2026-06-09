import { useState } from 'preact/hooks';
import { addTask, updateTask, deleteTask, updateTaskDescription, tasks, type Task } from '../store';
import { translations, currentLanguage } from '../i18n';
import { currentUser, signInWithGoogle } from '../lib/auth';
import { setTaskListsForTask, getTaskLists } from '../lib/lists';
import { ListSelector } from './ListSelector';
import { Popup } from './Popup';

interface TaskEditorProps {
  mode: 'add' | 'edit';
  task?: Task;
  onDone: () => void;
}

export function TaskEditor({ mode, task, onDone }: TaskEditorProps) {
  const t = translations[currentLanguage.value];
  const loggedIn = currentUser.value !== null;

  const [name, setName] = useState(task?.name ?? '');
  const [intervalDays, setIntervalDays] = useState<number | ''>(task?.intervalDays ?? 5);
  const [initialDaysOffset, setInitialDaysOffset] = useState<number | ''>('');
  const [selectedListIds, setSelectedListIds] = useState<string[]>(
    mode === 'edit' && task ? getTaskLists(task.id).map(l => l.id) : []
  );
  const [description, setDescription] = useState(task?.description ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const days = typeof intervalDays === 'number' ? intervalDays : parseInt(String(intervalDays)) || 0;
  const canSave = name.trim().length > 0 && days > 0 && !isSaving;

  const toggleList = (listId: string) => {
    setSelectedListIds(prev =>
      prev.includes(listId) ? prev.filter(id => id !== listId) : [...prev, listId]
    );
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setErrorMessage(null);

    if (mode === 'add') {
      const offset = initialDaysOffset === '' ? undefined : Number(initialDaysOffset);
      const ok = await addTask(name.trim(), days, offset);
      if (!ok) {
        setIsSaving(false);
        setErrorMessage(t.addTaskFailed);
        return;
      }
      const newTask = tasks.value[tasks.value.length - 1];
      if (newTask) {
        if (loggedIn && selectedListIds.length > 0) {
          await setTaskListsForTask(newTask.id, selectedListIds);
        }
        if (description.trim()) {
          await updateTaskDescription(newTask.id, description.trim());
        }
      }
      setIsSaving(false);
      if (!loggedIn) {
        setShowLoginPrompt(true);
        return;
      }
      onDone();
      return;
    }

    // edit mode
    if (!task) return;
    const taskOk = await updateTask(task.id, name.trim(), days);
    const listsOk = await setTaskListsForTask(task.id, selectedListIds);
    let descOk = true;
    if ((task.description ?? '') !== description.trim()) {
      descOk = await updateTaskDescription(task.id, description.trim());
    }
    setIsSaving(false);
    if (taskOk && listsOk && descOk) {
      onDone();
    } else {
      setErrorMessage(t.updateTaskFailed);
    }
  };

  const handleConfirmDelete = async () => {
    if (!task) return;
    setIsDeleting(true);
    setErrorMessage(null);
    const ok = await deleteTask(task.id);
    setIsDeleting(false);
    if (ok) {
      setShowDeleteConfirm(false);
      onDone();
    } else {
      setShowDeleteConfirm(false);
      setErrorMessage(t.deleteTaskFailed);
    }
  };

  const handleLogin = async () => {
    setShowLoginPrompt(false);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg text-base bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] outline-none focus:border-[var(--accent-green)]';

  return (
    <div class="task-editor">
      {errorMessage && (
        <div class="text-[var(--danger)] text-sm mb-3 px-3 py-2 rounded-lg bg-[rgba(255,59,48,0.1)]">
          {errorMessage}
        </div>
      )}

      <div class="mb-3">
        <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t.taskName}</label>
        <input
          type="text"
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder={t.taskNamePlaceholder}
          class={inputClass}
          disabled={isSaving}
          autoFocus
        />
      </div>

      <div class="mb-3">
        <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t.frequencyDays}</label>
        <input
          type="number"
          inputmode="numeric"
          min="1"
          value={intervalDays}
          onInput={(e) => {
            const val = (e.target as HTMLInputElement).value;
            setIntervalDays(val === '' ? '' : (parseInt(val) || ''));
          }}
          class={inputClass}
          disabled={isSaving}
        />
      </div>

      {mode === 'add' && (
        <div class="mb-3">
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1">
            {t.daysUntilFirstCompletion}
          </label>
          <input
            type="number"
            inputmode="numeric"
            min="0"
            value={initialDaysOffset}
            onInput={(e) => {
              const val = (e.target as HTMLInputElement).value;
              setInitialDaysOffset(val === '' ? '' : (parseInt(val) || 0));
            }}
            placeholder={t.inDays(intervalDays.toString())}
            class={inputClass}
            disabled={isSaving}
          />
          <small class="block mt-1 text-xs text-[var(--text-secondary)]">{t.daysUntilFirstCompletionHint}</small>
        </div>
      )}

      {loggedIn && (
        <div class="mb-3">
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t.lists}</label>
          <ListSelector
            selectedListIds={selectedListIds}
            onToggle={toggleList}
            disabled={isSaving}
          />
        </div>
      )}

      <div class="mb-4">
        <label class="block text-sm font-medium text-[var(--text-secondary)] mb-1">{t.taskDescription}</label>
        <textarea
          value={description}
          onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          placeholder={t.descriptionPlaceholder}
          rows={3}
          class={`${inputClass} resize-y leading-relaxed`}
          disabled={isSaving}
        />
      </div>

      <div class="flex items-center gap-2">
        <button
          class="button-primary"
          style="flex: 1; padding: 12px 16px; font-size: 16px;"
          onClick={handleSave}
          disabled={!canSave}
        >
          {isSaving ? '...' : (mode === 'add' ? t.addTask : t.save)}
        </button>
        <button
          class="task-editor-secondary"
          onClick={onDone}
          disabled={isSaving}
        >
          {t.cancel}
        </button>
        {mode === 'edit' && (
          <button
            class="task-editor-delete"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isSaving}
            aria-label={t.deleteTask}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        )}
      </div>

      {showDeleteConfirm && task && (
        <Popup
          title={`${t.deleteTask} "${task.name}"`}
          message={t.deleteTaskMessage}
          buttons={[
            {
              label: isDeleting ? '...' : t.delete,
              onClick: handleConfirmDelete,
              className: 'button-danger',
            },
            {
              label: t.keep,
              onClick: () => setShowDeleteConfirm(false),
              className: 'button-secondary',
            },
          ]}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}

      {showLoginPrompt && (
        <Popup
          title={t.loginToSave}
          message={t.loginToSaveMessage}
          buttons={[
            { label: t.login, onClick: handleLogin, className: 'button-primary' },
            { label: t.ok, onClick: () => { setShowLoginPrompt(false); onDone(); }, className: 'button-secondary' },
          ]}
          onClose={() => { setShowLoginPrompt(false); onDone(); }}
        />
      )}
    </div>
  );
}
