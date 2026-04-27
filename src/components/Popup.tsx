import { translations, currentLanguage } from '../i18n';

interface PopupButton {
  label: string;
  onClick: () => void;
  className: string;
}

interface PopupProps {
  title: string;
  message: string;
  buttons: PopupButton[];
  onClose: () => void;
}

export function Popup({ title, message, buttons, onClose }: PopupProps) {
  const t = translations[currentLanguage.value];

  return (
    <>
      <div
        class="popup-backdrop"
        onClick={(e) => e.stopPropagation()}
      />
      <div class="popup">
        <div class="popup-header">
          <h2>{title}</h2>
          <button
            class="popup-close"
            onClick={onClose}
            aria-label={t.back}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <p class="popup-message">{message}</p>
        <div class="popup-actions">
          {buttons.map((button, index) => (
            <button
              key={index}
              class={button.className}
              onClick={button.onClick}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

