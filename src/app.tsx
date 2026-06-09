import { useEffect } from 'preact/hooks';
import Router from 'preact-router';
import { getStoredTheme, applyTheme } from './themes';
import { refreshTasksIfLoggedIn } from './lib/auth';
import { defaultScreen } from './store';
import { Dashboard } from './components/Dashboard';
import { AppPage } from './components/AppPage';
import { StatsPage } from './components/StatsPage';
import { SettingsPage } from './components/SettingsPage';
import './app.css';

// Renders whichever screen the user picked as their device-local default.
function Home(_props: { path?: string }) {
  return defaultScreen.value === 'dashboard' ? <Dashboard /> : <AppPage />;
}

export function App() {
  useEffect(() => {
    applyTheme(getStoredTheme());
    refreshTasksIfLoggedIn();
  }, []);

  return (
    <Router>
      <Home path="/" />
      <Dashboard path="/dashboard" />
      <AppPage path="/app" />
      <AppPage path="/add" />
      <StatsPage path="/stats" />
      <SettingsPage path="/settings" />
    </Router>
  );
}
