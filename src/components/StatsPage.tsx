import { useState, useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { Header } from './Header';
import { CompletionChart } from './CompletionChart';
import { fetchTaskCompletions } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';
import { computeGlobalStats, computeAllTaskStats, computeTaskStats } from '../lib/stats';
import type { TaskCompletion } from '../lib/supabase';
import type { GlobalStats, TaskStats } from '../lib/stats';
import { translations, currentLanguage } from '../i18n';

interface StatsPageProps {
  path?: string; // Required by preact-router
}

export function StatsPage({}: StatsPageProps) {
  const t = translations[currentLanguage.value];

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStats[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Fetch completions on mount
  useEffect(() => {
    const userId = getCurrentUserId();
    if (!userId) {
      setError(t.pleaseLoginToViewStats || 'Please log in to view statistics');
      setLoading(false);
      return;
    }

    fetchTaskCompletions(userId)
      .then(data => {
        if (data) {
          setCompletions(data);
          setGlobalStats(computeGlobalStats(data));
          setTaskStats(computeAllTaskStats(data));
        } else {
          setError(t.failedToLoadStats || 'Failed to load statistics');
        }
      })
      .catch(err => {
        console.error('[StatsPage] Failed to fetch completions:', err);
        setError(t.errorLoadingStats || 'An error occurred while loading statistics');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Render loading state
  if (loading) {
    return (
      <div class="app">
        <Header
          currentView="stats"
          onNavigate={(path) => route(path)}
        />
        <main class="setup">
          <div class="text-center py-8">
            <p>{t.loading || 'Loading statistics...'}</p>
          </div>
        </main>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div class="app">
        <Header
          currentView="stats"
          onNavigate={(path) => route(path)}
        />
        <main class="setup">
          <div class="text-center py-8">
            <p style="color: var(--accent-red)">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  // Render empty state
  if (completions.length === 0) {
    return (
      <div class="app">
        <Header
          currentView="stats"
          onNavigate={(path) => route(path)}
        />
        <main class="setup">
          <div class="text-center py-8">
            <p>{t.noCompletionsYet || 'No completions yet. Complete some tasks to see statistics!'}</p>
          </div>
        </main>
      </div>
    );
  }

  // Render stats
  return (
    <div class="app">
      <Header
        currentView="stats"
        onNavigate={(path) => route(path)}
      />
      <main class="setup">
        {/* Global Statistics Panel */}
        <div class="stats-section">
          <h2>{t.globalStatistics || 'Global Statistics'}</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">{t.totalCompletions || 'Total Completions'}</div>
              <div class="stat-value">{globalStats?.totalCompletions || 0}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{t.daysLate || 'Days Late'}</div>
              <div class="stat-value-row">
                <div class="stat-value">{globalStats?.totalDaysLate || 0}</div>
                <div class="stat-subtitle">
                  avg: {globalStats?.averageDaysLate.toFixed(1) || 0}
                </div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{t.daysEarly || 'Days Early'}</div>
              <div class="stat-value-row">
                <div class="stat-value">{globalStats?.totalDaysEarly || 0}</div>
                <div class="stat-subtitle">
                  avg: {globalStats?.averageDaysEarly.toFixed(1) || 0}
                </div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">{t.onTimeRate || 'On-Time Rate'}</div>
              <div class="stat-value">{globalStats?.onTimeRate.toFixed(0) || 0}%</div>
            </div>
          </div>
        </div>

        {/* Completion History Chart */}
        <div class="stats-section">
          <h2>{t.completionHistory || 'Completion History'}</h2>
          {selectedTaskId ? (
            <div>
              <CompletionChart
                completionHistory={
                  computeTaskStats(completions, selectedTaskId)?.completionHistory || []
                }
              />
              <button
                class="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-4"
                style="background: none; border: none; cursor: pointer;"
                onClick={() => setSelectedTaskId(null)}
              >
                ← {t.allTasks || 'All Tasks'}
              </button>
            </div>
          ) : (
            <CompletionChart
              completionHistory={completions.map(c => ({
                date: c.completed_at,
                delay: c.delay_days
              }))}
            />
          )}
        </div>

        {/* Per-Task Breakdown */}
        <div class="stats-section">
          <h2>{t.perTaskBreakdown || 'Per-Task Breakdown'}</h2>
          <div class="task-stats-list">
            {taskStats.map(stats => (
              <div
                key={stats.taskId}
                class="task-stat-item"
                onClick={() => setSelectedTaskId(stats.taskId)}
              >
                <div class="task-stat-info">
                  <div class="task-stat-name">{stats.taskName}</div>
                  <div class="task-stat-subtitle">
                    {stats.totalCompletions} {t.completions || 'completions'}
                  </div>
                </div>
                <div class="task-stat-metrics">
                  <div class="task-stat-delay">
                    {stats.averageDaysLate > 0 && `+${stats.averageDaysLate.toFixed(1)}d late`}
                    {stats.averageDaysEarly > 0 && `-${stats.averageDaysEarly.toFixed(1)}d early`}
                    {stats.averageDaysLate === 0 && stats.averageDaysEarly === 0 && t.onTime}
                  </div>
                  <div class="task-stat-subtitle">
                    {stats.onTimeRate.toFixed(0)}% {t.onTime || 'on time'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
