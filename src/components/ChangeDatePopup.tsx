import { useEffect, useMemo, useState } from 'preact/hooks';
import { translations, currentLanguage } from '../i18n';
import { updateCompletionDate, getEarliestEditableDay } from '../store';

interface Props {
  taskId: string;
  taskName: string;
  completionId: string;
  dueDate: number;
  onCancelled: () => void;
  onSaved: () => void;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function noonOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function ChangeDatePopup({ taskId, taskName, completionId, dueDate, onCancelled, onSaved }: Props) {
  const t = translations[currentLanguage.value];
  const locale = currentLanguage.value === 'ru' ? 'ru-RU' : 'en-US';

  const todayStart = startOfDay(Date.now());
  const [selected, setSelected] = useState<number>(noonOfDay(Date.now()));
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [minDay, setMinDay] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    getEarliestEditableDay(taskId, completionId).then(day => {
      if (day !== null) setMinDay(day);
    });
  }, [taskId, completionId]);

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // Jan 4 2026 is a Sunday — anchor the week.
    const sunday = new Date(2026, 0, 4);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return fmt.format(d);
    });
  }, [locale]);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewMonth);
  }, [viewMonth, locale]);

  // 6×7 grid starting from the Sunday on or before the 1st of the viewed month.
  const gridDays = useMemo(() => {
    const firstOfMonth = new Date(viewMonth);
    const offsetToSunday = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(1 - offsetToSunday);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [viewMonth]);

  const isOutOfRange = (ts: number): boolean => {
    const day = startOfDay(ts);
    if (day > todayStart) return true;
    if (minDay !== null && day < minDay) return true;
    return false;
  };

  const canGoPrev = (() => {
    if (minDay === null) return true;
    const prevMonthEnd = new Date(viewMonth);
    prevMonthEnd.setDate(0); // last day of previous month
    return prevMonthEnd.getTime() >= minDay;
  })();

  const canGoNext = (() => {
    const nextMonthStart = new Date(viewMonth);
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
    return nextMonthStart.getTime() <= todayStart;
  })();

  const goPrev = () => {
    if (!canGoPrev) return;
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() - 1);
    setViewMonth(d);
  };

  const goNext = () => {
    if (!canGoNext) return;
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() + 1);
    setViewMonth(d);
  };

  const handleSelect = (d: Date) => {
    if (isOutOfRange(d.getTime())) return;
    setSelected(noonOfDay(d.getTime()));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    const ok = await updateCompletionDate(taskId, completionId, selected, dueDate);
    setIsSaving(false);
    if (ok) {
      onSaved();
    } else {
      setErrorMessage(t.changeDateFailed);
    }
  };

  return (
    <>
      <div class="popup-backdrop" onClick={onCancelled} />
      <div class="popup">
        <div class="popup-header">
          <h2>{taskName}</h2>
          <button class="popup-close" onClick={onCancelled} aria-label={t.close}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <p class="popup-message">{t.changeDatePopupTitle}</p>

        <div class="calendar">
          <div class="calendar-header">
            <button
              type="button"
              class="calendar-nav"
              onClick={goPrev}
              disabled={!canGoPrev}
              aria-label="Previous month"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <div class="calendar-month-label">{monthLabel}</div>
            <button
              type="button"
              class="calendar-nav"
              onClick={goNext}
              disabled={!canGoNext}
              aria-label="Next month"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6"/>
              </svg>
            </button>
          </div>
          <div class="calendar-weekdays">
            {weekdayLabels.map((label) => (
              <div key={label} class="calendar-weekday">{label}</div>
            ))}
          </div>
          <div class="calendar-grid">
            {gridDays.map((d) => {
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const disabled = isOutOfRange(d.getTime());
              const isSelected = sameDay(d.getTime(), selected);
              const isToday = sameDay(d.getTime(), todayStart);
              const cls = [
                'calendar-day',
                inMonth ? '' : 'is-other-month',
                isSelected ? 'is-selected' : '',
                isToday ? 'is-today' : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={d.getTime()}
                  type="button"
                  class={cls}
                  disabled={disabled}
                  onClick={() => handleSelect(d)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {errorMessage && (
          <p class="popup-message" style="color: var(--danger);">{errorMessage}</p>
        )}
        <div class="popup-actions">
          <button
            class="button-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? '...' : t.save}
          </button>
          <button class="button-secondary" onClick={onCancelled} disabled={isSaving}>
            {t.cancel}
          </button>
        </div>
      </div>
    </>
  );
}
