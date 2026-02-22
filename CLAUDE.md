# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start dev server (runs at http://localhost:5174/)
npm run dev

# Build for production (TypeScript check + Vite build)
npm run build

# Preview production build
npm run preview

# TypeScript type checking only
npx tsc -b --noEmit
```

## Tech Stack & Key Dependencies

- **Framework**: Preact (NOT React) with JSX
- **State Management**: @preact/signals (reactive signals that persist across component lifecycle)
- **Build Tool**: Vite (via rolldown-vite@7.2.5 - a custom fork)
- **Backend**: Supabase for auth (Google OAuth) and PostgreSQL database
- **CSS**: Custom CSS with CSS variables for theming + Tailwind v3 (scoped with preflight: false)
- **Storage**: localStorage as primary storage, Supabase for cloud sync

## Architecture Overview

### State Management Architecture (CRITICAL)

**Single source of truth for auth**: All auth state lives in `src/lib/auth.ts` using Preact signals.

- `currentUser` signal is initialized ONCE in `src/main.tsx` via `initAuth()` before app renders
- Signals persist across all navigations (they don't reset when components unmount)
- User is only fetched from Supabase on page refresh, NOT on navigation
- All components read directly from `currentUser.value` - no local state, no duplication

**NEVER**:
- Create local user state in components
- Refetch user on component mount
- Duplicate currentUser signal elsewhere

**Always**: Import auth state from `src/lib/auth.ts` and read from signals directly.

### Task Sync Strategy

Tasks use a **hybrid pessimistic/optimistic sync strategy**:

**Pessimistic operations** (block on Supabase when logged in):
- `addTask()` - tries Supabase first, then updates local
- `deleteTask()` - tries Supabase first, then updates local
- `updateTask()` - tries Supabase first, then updates local

**Optimistic operations** (update local immediately, sync in background):
- `completeTask()` - updates local, syncs to Supabase in background
- `undoComplete()` - reverts local, syncs to Supabase in background
- `moveTaskUp()` / `moveTaskDown()` - reorders local, syncs in background
- `adjustTaskTime()` - adjusts local, syncs in background

**Pending sync queue**: Failed background syncs are tracked in `pendingSyncIds` signal and retried every 60 seconds via `retrySyncPending()`.

**On login**: `syncTasksOnLogin()` merges local and remote tasks:
- Remote tasks define the canonical set (local-only tasks are deleted)
- Name and interval always come from remote
- `nextDueDate` uses the latest value (max of local and remote timestamps)

### View Architecture

3 views managed by `src/app.tsx`:

1. **Dashboard** (`src/components/Dashboard.tsx`):
   - Task cards with completion, undo, time adjustment
   - Uses custom CSS only (NO Tailwind)
   - Uses `textfit` library to auto-size task names
   - Plus icon navigates to AddTaskScreen

2. **AddTaskScreen** (`src/components/AddTaskScreen.tsx`):
   - Task CRUD: add new tasks, edit existing, delete, reorder
   - Magic link sharing (base64-encoded task list in URL param)
   - Uses Tailwind + Header component
   - Unsaved changes detection

3. **SettingsPage** (`src/components/SettingsPage.tsx`):
   - Language selector (English/Russian)
   - Theme selector (Default Dark/Solarized Light)
   - Uses Tailwind + Header component
   - Settings sync to Supabase when logged in

**Shared Header** (`src/components/Header.tsx`):
- Used by AddTaskScreen and SettingsPage only (not Dashboard)
- Tailwind-styled navigation with auth UI
- Shows Dashboard/Add Task buttons on left
- Shows login button OR user avatar dropdown on right
- Reads directly from auth signals (no local state)

### Storage Layers

**localStorage** (always updated, works offline):
- Tasks: `one-click-routine-tasks`
- Pending sync queue: `one-click-routine-pending-sync`
- Theme: `one-click-routine-theme`
- Language: `one-click-routine-language`

**Supabase tables**:
- `user_settings` (id UUID FK to auth.users, settings JSONB) - language & theme
- `user_tasks` (id, user_id, name, interval_days, next_due_date, sort_order) - normalized task data
- RLS enabled: users can only access their own rows

### Theming System

Themes use CSS variables defined in `src/themes.ts`:
- All colors are CSS custom properties (e.g., `--bg-primary`, `--accent-green`)
- Tailwind uses CSS variables via `bg-[var(--accent-green)]` syntax for compatibility
- Theme changes apply immediately via `applyTheme()` which sets CSS variables on `:root`
- Dashboard uses CSS variables directly; AddTaskScreen/SettingsPage use Tailwind with CSS variable references

### Internationalization

Two languages supported (English/Russian) via `src/i18n.ts`:
- Translations include time/date formatting functions
- Pluralization rules differ by language (especially complex in Russian)
- Weekday and month names localized separately

## Important Constraints

### CSS and Styling

**Tailwind is scoped**: Only AddTaskScreen, SettingsPage, and Header use Tailwind. Dashboard uses custom CSS.

- `tailwind.config.js` content is scoped to specific files
- `preflight: false` prevents Tailwind from resetting Dashboard styles
- Never add Tailwind classes to Dashboard components
- When adding new Tailwind-styled components, add paths to `tailwind.config.js` content array

### Preact vs React

This is **Preact**, not React. Key differences:
- Import from `preact` and `preact/hooks`, not `react`
- Use `class` attribute, not `className` (except in Tailwind components which accept both)
- Preact signals syntax: `signal.value` to read/write
- Smaller bundle size, slightly different API

### Supabase Auth Callback Constraint

From `src/lib/supabase.ts` line 122-143:

**CRITICAL**: `onAuthStateChange()` callback must be synchronous. Do NOT call other Supabase functions inside it (causes deadlocks). Extract user info directly from session object synchronously.

### Magic Link Sharing

Tasks can be shared via URL query param `?tasks={base64}`:
- Uses custom Unicode-safe base64 encoding/decoding
- Imported tasks are added only if they don't already exist (by ID)
- URL is cleaned after import via `window.history.replaceState()`
- See `generateMagicLink()` and `importTasksFromLink()` in `src/store.ts`

## File Organization

```
src/
├── lib/
│   ├── auth.ts           # Single source of truth for auth (signals)
│   └── supabase.ts       # Supabase client, auth functions, CRUD
├── components/
│   ├── Dashboard.tsx     # Main view (custom CSS only)
│   ├── AddTaskScreen.tsx # Task management (Tailwind + Header)
│   ├── SettingsPage.tsx  # Settings UI (Tailwind + Header)
│   ├── Header.tsx        # Shared nav header (Tailwind)
│   └── Popup.tsx         # Reusable modal component
├── store.ts              # Task state & CRUD operations (signals)
├── themes.ts             # Theme definitions and CSS variable application
├── i18n.ts               # Translations and locale data
├── app.tsx               # Root component with view routing
├── main.tsx              # Entry point (calls initAuth before render)
├── app.css               # Custom CSS (Dashboard styles)
└── tailwind.css          # Tailwind imports
```

## Common Patterns

### Adding a new task action

1. Add function to `src/store.ts`
2. Choose pessimistic (await Supabase first) or optimistic (update local, sync background)
3. Update localStorage via `saveTasks()`
4. For optimistic: add to pending sync queue if Supabase fails
5. Import and use in Dashboard or AddTaskScreen

### Adding a new theme

1. Add theme object to `themes` in `src/themes.ts` with all CSS variable values
2. Theme will automatically appear in SettingsPage dropdown
3. Test both Dashboard (custom CSS) and Tailwind components with new theme

### Adding a new translation string

1. Add to `Translations` interface in `src/i18n.ts`
2. Implement for both `en` and `ru` in `translations` object
3. Import `translations` in component and use: `t.yourNewString`

## Environment Variables

Create `.env.local` (not committed):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Fallback values exist in code but should not be used in production.

## Debugging

- `debug()` function in `src/store.ts` logs only in DEV mode
- Check browser console for Supabase errors (prefixed with `[functionName]`)
- Pending sync queue visible via `pendingSyncIds.value`
- Task state changes trigger signal updates (visible in Preact DevTools if installed)
