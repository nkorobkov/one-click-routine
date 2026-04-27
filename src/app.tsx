import { useEffect } from 'preact/hooks';
import Router from 'preact-router';
import { getStoredTheme, applyTheme } from './themes';
import { refreshTasksIfLoggedIn } from './lib/auth';
import { Dashboard } from './components/Dashboard';
import { AddTaskScreen } from './components/AddTaskScreen';
import { StatsPage } from './components/StatsPage';
import { SettingsPage } from './components/SettingsPage';
import './app.css';

export function App() {
  useEffect(() => {
    applyTheme(getStoredTheme());
    refreshTasksIfLoggedIn();
  }, []);

  return (
    <Router>
      <Dashboard path="/" />
      <AddTaskScreen path="/add" />
      <StatsPage path="/stats" />
      <SettingsPage path="/settings" />
    </Router>
  );
}
