import { useState } from 'preact/hooks';
import { translations, type LanguageId } from '../i18n';
import type { Task } from '../store';

interface TaskDescriptionPopupProps {
  task: Task;
  onClose: () => void;
  onSave: (taskId: string, description: string) => Promise<boolean>;
  selectedLanguage: LanguageId;
}

export function TaskDescriptionPopup({ task, onClose, onSave, selectedLanguage }: TaskDescriptionPopupProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(task.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const t = translations[selectedLanguage];

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    const success = await onSave(task.id, description);
    setIsSaving(false);
    if (!success) {
      setErrorMessage(t.saveDescriptionFailed);
    }
    // If success, parent closes popup
  };

  const handleCancel = () => {
    setDescription(task.description || '');
    setIsEditing(false);
    setErrorMessage(null);
  };

  return (
    <>
      {/* Backdrop - click to close only in view mode */}
      <div
        class="task-description-backdrop"
        onClick={!isEditing ? onClose : undefined}
      />

      {/* Popup */}
      <div class="task-description-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header with task name and close button */}
        <div class="task-description-header">
          <h2>{task.name}</h2>
          <button onClick={onClose} class="task-description-close" aria-label={t.close}>
            {/* Close icon (X) */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content area (scrollable) */}
        <div class="task-description-content">
          {!isEditing ? (
            description.trim() === '' ? (
              // Empty state
              <div class="task-description-empty">
                <p>{t.noDescriptionYet}</p>
                <button onClick={() => setIsEditing(true)}>
                  {t.addDescription}
                </button>
              </div>
            ) : (
              // Read-only description
              <div class="task-description-text">{description}</div>
            )
          ) : (
            // Edit mode
            <textarea
              value={description}
              onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              placeholder={t.descriptionPlaceholder}
              autoFocus
              disabled={isSaving}
            />
          )}

          {errorMessage && <div class="error-message" style="color: var(--accent-red); margin-top: 12px;">{errorMessage}</div>}
        </div>

        {/* Footer with action buttons */}
        <div class="task-description-footer">
          {!isEditing ? (
            description.trim() !== '' && (
              <button onClick={() => setIsEditing(true)}>
                {/* Edit icon (pencil) */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {t.editDescription}
              </button>
            )
          ) : (
            <>
              <button onClick={handleSave} disabled={isSaving}>
                {/* Save icon (checkmark) */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {t.saveDescription}
              </button>
              <button onClick={handleCancel} disabled={isSaving}>
                {t.cancel}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
