import { useState } from 'preact/hooks';
import { lists, addList } from '../lib/lists';
import { translations, type LanguageId } from '../i18n';

interface ListSelectorProps {
  selectedListIds: string[];
  onToggle: (listId: string) => void;
  disabled?: boolean;
  selectedLanguage: LanguageId;
}

export function ListSelector({ selectedListIds, onToggle, disabled, selectedLanguage }: ListSelectorProps) {
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justPressedEnter, setJustPressedEnter] = useState(false);

  const t = translations[selectedLanguage];

  const handleAddList = async () => {
    // Prevent double-save when Enter triggers both keydown and blur
    if (justPressedEnter) {
      setJustPressedEnter(false);
      return;
    }

    const trimmedName = newListName.trim();
    if (!trimmedName) {
      setIsAddingList(false);
      setNewListName('');
      return;
    }

    if (lists.value.length >= 10) {
      setErrorMessage(t.maxListsReached);
      setTimeout(() => setErrorMessage(null), 3000);
      setIsAddingList(false);
      setNewListName('');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    const success = await addList(trimmedName);
    setIsSubmitting(false);

    if (success) {
      setIsAddingList(false);
      setNewListName('');
    } else {
      setErrorMessage(t.addListFailed);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setJustPressedEnter(true);
      handleAddList();
      // Reset flag after a short delay
      setTimeout(() => setJustPressedEnter(false), 100);
    } else if (e.key === 'Escape') {
      setIsAddingList(false);
      setNewListName('');
    }
  };

  return (
    <div class="mb-4">
      {errorMessage && (
        <div class="text-[var(--danger)] text-sm mb-2 px-3 py-2 rounded-lg bg-[rgba(255,59,48,0.1)]">
          {errorMessage}
        </div>
      )}
      <div class="flex flex-wrap gap-2 items-center">
        {lists.value.map((list) => {
          const isSelected = selectedListIds.includes(list.id);
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => !disabled && onToggle(list.id)}
              disabled={disabled}
              class={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-[var(--accent-green)] text-[var(--bg-primary)]'
                  : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--card-bg-hover)]'
              } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              style={!isSelected ? 'border: 1px solid rgba(128, 128, 128, 0.4);' : ''}
            >
              {list.name}
            </button>
          );
        })}

        {isAddingList ? (
          <input
            type="text"
            value={newListName}
            onInput={(e) => setNewListName((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            onBlur={handleAddList}
            placeholder={t.listNamePlaceholder}
            disabled={isSubmitting || disabled}
            autoFocus
            class="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--accent-green)] outline-none focus:ring-2 focus:ring-[var(--accent-green)] min-w-[120px] max-w-[200px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => !disabled && setIsAddingList(true)}
            disabled={disabled || lists.value.length >= 10}
            class={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              disabled || lists.value.length >= 10
                ? 'opacity-40 cursor-not-allowed bg-[var(--card-bg)] text-[var(--text-secondary)]'
                : 'bg-[var(--card-bg)] text-[var(--accent-green)] hover:bg-[var(--card-bg-hover)] cursor-pointer'
            }`}
            title={lists.value.length >= 10 ? t.maxListsReached : t.addList}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
