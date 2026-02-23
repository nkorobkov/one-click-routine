import { useState } from 'preact/hooks';
import { lists, moveListUp, moveListDown, updateList, deleteList, getTasksInList } from '../lib/lists';
import { tasks } from '../store';
import { translations, type LanguageId } from '../i18n';
import { Popup } from './Popup';

interface ListManagerProps {
  selectedLanguage: LanguageId;
}

export function ListManager({ selectedLanguage }: ListManagerProps) {
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState('');
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const t = translations[selectedLanguage];

  if (lists.value.length === 0) {
    return null;
  }

  const handleEditList = (list: { id: string; name: string }) => {
    setEditingListId(list.id);
    setEditingListName(list.name);
  };

  const handleSaveEdit = async (listId: string) => {
    const trimmedName = editingListName.trim();
    if (!trimmedName) {
      setEditingListId(null);
      setEditingListName('');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    const success = await updateList(listId, trimmedName);
    setIsSaving(false);

    if (success) {
      setEditingListId(null);
      setEditingListName('');
    } else {
      setErrorMessage(t.updateListFailed);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleCancelEdit = () => {
    setEditingListId(null);
    setEditingListName('');
  };

  const handleDeleteList = (listId: string) => {
    setListToDelete(listId);
  };

  const handleConfirmDelete = async () => {
    if (!listToDelete) return;

    setIsDeleting(true);
    setErrorMessage(null);
    const success = await deleteList(listToDelete);
    setIsDeleting(false);

    if (success) {
      setListToDelete(null);
    } else {
      setErrorMessage(t.deleteListFailed);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleKeyDown = (e: KeyboardEvent, listId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(listId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const getTaskCount = (listId: string): number => {
    const taskIds = getTasksInList(listId);
    // Filter to only count tasks that exist in tasks.value
    return taskIds.filter(taskId => tasks.value.some(t => t.id === taskId)).length;
  };

  return (
    <div class="task-list" style="margin-top: 2rem;">
      <h2>{t.manageLists}</h2>
      {errorMessage && (
        <div style="color: var(--danger); padding: 8px 12px; border-radius: 8px; background: rgba(255,59,48,0.1); margin-bottom: 12px; font-size: 0.9em;">
          {errorMessage}
        </div>
      )}
      <div>
        {lists.value.map((list, index) => {
          const isEditing = editingListId === list.id;
          const taskCount = getTaskCount(list.id);

          return (
            <div key={list.id} class={isEditing ? "task-item task-item-editing" : "task-item"}>
              <div class="task-item-content">
                {isEditing ? (
                  <input
                    type="text"
                    value={editingListName}
                    onInput={(e) => setEditingListName((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => handleKeyDown(e, list.id)}
                    disabled={isSaving}
                    autoFocus
                    class="task-edit-input"
                    placeholder={t.listNamePlaceholder}
                  />
                ) : (
                  <>
                    <h3>{list.name}</h3>
                    <p>{t.tasksInList(taskCount)}</p>
                  </>
                )}
              </div>

              <div class="task-item-actions">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => handleSaveEdit(list.id)}
                      disabled={!editingListName.trim() || isSaving}
                      class="button-action button-save"
                      aria-label="Save"
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
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      class="button-action button-cancel"
                      aria-label="Cancel"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => moveListUp(list.id)}
                      disabled={index === 0}
                      class="button-action button-reorder"
                      aria-label="Move up"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 15l-6-6-6 6"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => moveListDown(list.id)}
                      disabled={index === lists.value.length - 1}
                      class="button-action button-reorder"
                      aria-label="Move down"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEditList(list)}
                      class="button-action button-edit"
                      aria-label={t.editListName}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteList(list.id)}
                      class="button-action button-danger"
                      aria-label={t.deleteList}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation popup */}
      {listToDelete && (() => {
        const list = lists.value.find(l => l.id === listToDelete);
        const listName = list?.name || '';
        return (
          <Popup
            title={`${t.deleteList} "${listName}"`}
            message={t.deleteListMessage}
            buttons={[
              {
                label: isDeleting ? '...' : t.delete,
                onClick: handleConfirmDelete,
                className: 'button-danger',
              },
              {
                label: t.keep,
                onClick: () => setListToDelete(null),
                className: 'button-secondary',
              },
            ]}
            onClose={() => setListToDelete(null)}
            selectedLanguage={selectedLanguage}
          />
        );
      })()}
    </div>
  );
}
