export type LanguageId = 'en' | 'ru';

export interface Translations {
  // Time bar
  timeFormat: (hours: number, minutes: number) => string;
  dateFormat: (weekday: string, day: number, month: string) => string;
  
  // Dashboard
  noTasksYet: string;
  addYourFirstTask: string;
  taskCompleted: string;
  timeTo: string;
  today: string;
  inDays: (days: string) => string;
  formatDays: (days: number) => string;
  
  // Setup
  setup: string;
  addNewTask: string;
  taskName: string;
  taskNamePlaceholder: string;
  frequencyDays: string;
  daysUntilFirstCompletion: string;
  daysUntilFirstCompletionHint: string;
  addTask: string;
  yourTasks: string;
  noTasksConfigured: string;
  deleteTask: string;
  deleteTaskConfirm: string;
  
  // Theme
  theme: string;
  colorTheme: string;
  language: string;
  
  // Common
  undo: string;
  back: string;
  
  // Language names
  languageEnglish: string;
  languageRussian: string;
  
  // Task list
  everyDays: (days: number) => string;
  
  // Overdue formatting
  formatOverdueTime: (daysOverdue: number) => string;
  
  // Share tasks
  shareTasks: string;
  shareLinkDescription: string;
  shareLinkHint: string;
  copyLink: string;
  linkCopied: string;
  noTasksToShare: string;
}

export const translations: Record<LanguageId, Translations> = {
  en: {
    timeFormat: (hours, minutes) => {
      const h = hours.toString().padStart(2, '0');
      const m = minutes.toString().padStart(2, '0');
      return `${h}:${m}`;
    },
    dateFormat: (weekday, day, month) => `${weekday} ${day} ${month}`,
    noTasksYet: 'No tasks yet.',
    addYourFirstTask: 'Add Your First Task',
    taskCompleted: 'Task completed',
    timeTo: 'Time to',
    today: 'today',
    inDays: (days) => `in ${days}`,
    formatDays: (days) => {
      if (days === 1) return '1 day';
      if (days < 7) return `${days} days`;
      const weeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      if (remainingDays === 0) return `${weeks}w`;
      return `${weeks}w ${remainingDays}d`;
    },
    setup: 'Setup',
    addNewTask: 'Add New Task',
    taskName: 'Task Name',
    taskNamePlaceholder: 'e.g., Water flowers',
    frequencyDays: 'Frequency (days)',
    daysUntilFirstCompletion: 'Days until first completion (optional)',
    daysUntilFirstCompletionHint: 'Leave empty to use frequency as default',
    addTask: 'Add Task',
    yourTasks: 'Your Tasks',
    noTasksConfigured: 'No tasks configured yet.',
    deleteTask: 'Delete task',
    deleteTaskConfirm: 'Delete this task?',
    theme: 'Theme',
    colorTheme: 'Color Theme',
    language: 'Language',
    undo: 'Undo',
    back: 'Back',
    languageEnglish: 'English',
    languageRussian: 'Russian',
    everyDays: (days) => `Every ${days} day${days !== 1 ? 's' : ''}`,
    formatOverdueTime: (daysOverdue) => {
      if (daysOverdue === 0) return 'today';
      if (daysOverdue < 7) {
        return `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago`;
      }
      if (daysOverdue < 30) {
        const weeks = Math.floor(daysOverdue / 7);
        const days = daysOverdue % 7;
        if (days === 0) {
          return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
        }
        return `${weeks}w ${days}d ago`;
      }
      const months = Math.floor(daysOverdue / 30);
      const remainingDays = daysOverdue % 30;
      if (remainingDays === 0) {
        return `${months} month${months !== 1 ? 's' : ''} ago`;
      }
      const weeks = Math.floor(remainingDays / 7);
      if (weeks === 0) {
        return `${months}mo ${remainingDays}d ago`;
      }
      return `${months}mo ${weeks}w ago`;
    },
    shareTasks: 'Share Tasks',
    shareLinkDescription: 'Copy this link to share your tasks',
    shareLinkHint: 'Paste this link in another browser to import all tasks',
    copyLink: 'Copy',
    linkCopied: 'Copied!',
    noTasksToShare: 'Add tasks to generate a share link',
  },
  ru: {
    timeFormat: (hours, minutes) => {
      const h = hours.toString().padStart(2, '0');
      const m = minutes.toString().padStart(2, '0');
      return `${h}:${m}`;
    },
    dateFormat: (weekday, day, month) => `${weekday} ${day} ${month}`,
    noTasksYet: 'Пока делать нечего',
    addYourFirstTask: 'Добавить рутину',
    taskCompleted: '✅',
    timeTo: 'Пора',
    today: 'сегодня',
    inDays: (days) => `${days}`,
    formatDays: (days) => {
      if (days === 1) return 'завтра';
      if (days < 5) return `${days} дня`;
      if (days < 7) return `${days} дней`;
      const weeks = Math.floor(days / 7);
      const remainingDays = days % 7;
      if (remainingDays === 0) {
        const weekWord = weeks%10 === 1 ? 'неделя' : weeks%10 < 5 ? 'недели' : 'недель';
        return `${weeks} ${weekWord}`;
      }
      return `${weeks}н ${remainingDays}д`;
    },
    setup: 'Настройки',
    addNewTask: 'Добавить новую рутину',
    taskName: 'Название',
    taskNamePlaceholder: 'Полить цветы',
    frequencyDays: 'Частота (в днях)',
    daysUntilFirstCompletion: 'До первого выполнения',
    daysUntilFirstCompletionHint: 'Оставьте пустым, чтобы использовать частоту по умолчанию',
    addTask: 'Добавить',
    yourTasks: 'Ваши рутины',
    noTasksConfigured: 'Нет рутин',
    deleteTask: 'Удалить',
    deleteTaskConfirm: 'Удалить эту рутину?',
    theme: 'Настройки',
    colorTheme: 'Цветовая тема',
    language: 'Язык',
    undo: 'Отменить',
    back: 'Назад',
    languageEnglish: 'Английский',
    languageRussian: 'Русский',
    everyDays: (days) => {
      const dayWord = days%10 === 1 ? 'день' : days%10 < 5 ? 'дня' : 'дней';
      return `Каждые ${days} ${dayWord}`;
    },
    formatOverdueTime: (daysOverdue) => {
      if (daysOverdue === 0) return 'сегодня';
      if (daysOverdue < 7) {
        const dayWord = daysOverdue === 1 ? 'день' : daysOverdue < 5 ? 'дня' : 'дней';
        return `${daysOverdue} ${dayWord} назад`;
      }
      if (daysOverdue < 30) {
        const weeks = Math.floor(daysOverdue / 7);
        const days = daysOverdue % 7;
        if (days === 0) {
          const weekWord = weeks%10 === 1 ? 'неделю' : weeks%10 < 5 ? 'недели' : 'недель';
          return `${weeks} ${weekWord} назад`;
        }
        return `${weeks}н ${days}д назад`;
      }
      const months = Math.floor(daysOverdue / 30);
      const remainingDays = daysOverdue % 30;
      if (remainingDays === 0) {
        const monthWord = months === 1 ? 'месяц' : months < 5 ? 'месяца' : 'месяцев';
        return `${months} ${monthWord} назад`;
      }
      const weeks = Math.floor(remainingDays / 7);
      if (weeks === 0) {
        return `${months}м ${remainingDays}д назад`;
      }
      return `${months}м ${weeks}н назад`;
    },
    shareTasks: 'Поделиться рутинами',
    shareLinkDescription: 'Скопируйте эту ссылку, чтобы поделиться своими рутинами',
    shareLinkHint: 'Вставьте эту ссылку в другом браузере, чтобы импортировать все рутины',
    copyLink: 'Копировать',
    linkCopied: 'Скопировано!',
    noTasksToShare: 'Добавьте рутины, чтобы создать ссылку для обмена',
  },
};

// Weekday names
export const weekdays: Record<LanguageId, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
};

// Month names
export const months: Record<LanguageId, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
};

export function getStoredLanguage(): LanguageId {
  try {
    const stored = localStorage.getItem('one-click-routine-language');
    if (stored && stored in translations) {
      return stored as LanguageId;
    }
  } catch (e) {
    console.error('Failed to load language from localStorage:', e);
  }
  return 'en';
}

export function saveLanguage(languageId: LanguageId) {
  try {
    localStorage.setItem('one-click-routine-language', languageId);
  } catch (e) {
    console.error('Failed to save language to localStorage:', e);
  }
}

