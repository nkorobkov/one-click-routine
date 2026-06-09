import { route } from 'preact-router';
import { translations, currentLanguage } from '../i18n';
import { Header } from './Header';

interface InstallPageProps {
  path?: string;
}

// iOS Share icon (square with upward arrow)
function ShareIcon() {
  return (
    <svg class="install-inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M7 11H5v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8h-2" />
    </svg>
  );
}

// Android overflow menu icon (three vertical dots)
function MenuIcon() {
  return (
    <svg class="install-inline-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

export function InstallPage({}: InstallPageProps) {
  const t = translations[currentLanguage.value];

  return (
    <div class="app">
      <Header currentView="install" onNavigate={(path) => route(path)} />
      <main class="setup">
        <div class="install-hero">
          <img src="/oneclick-logo.svg" alt="One-Click Routine" class="install-logo" />
          <h2 class="install-title">{t.installApp}</h2>
          <p class="install-intro">{t.installIntro}</p>
        </div>

        <section class="settings-section">
          <h2>{t.installIosTitle}</h2>
          <ol class="install-steps">
            <li>{t.installIosStep1}</li>
            <li>
              {t.installIosStep2} <ShareIcon />
            </li>
            <li>{t.installIosStep3}</li>
            <li>{t.installIosStep4}</li>
          </ol>
          <p class="install-note">{t.installIosNote}</p>
        </section>

        <section class="settings-section">
          <h2>{t.installAndroidTitle}</h2>
          <ol class="install-steps">
            <li>{t.installAndroidStep1}</li>
            <li>
              {t.installAndroidStep2} <MenuIcon />
            </li>
            <li>{t.installAndroidStep3}</li>
            <li>{t.installAndroidStep4}</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
