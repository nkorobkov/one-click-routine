import { render } from 'preact'
import './index.css'
import './tailwind.css'
import { App } from './app.tsx'
import { getStoredTheme, applyTheme } from './themes'
import { initAuth } from './lib/auth'

// Global error handlers for debugging
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
  console.error('[Stack]', event.reason?.stack);
  // Don't prevent default - we want to see the error in console
});

window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error);
  console.error('[Message]', event.message);
  console.error('[Stack]', event.error?.stack);
});

// Initialize auth and apply theme before rendering
applyTheme(getStoredTheme())

// Initialize auth once (fetches user from Supabase, sets up listener)
initAuth().then(() => {
  render(<App />, document.getElementById('app')!)
})
