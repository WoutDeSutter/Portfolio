import { setMuted } from '../audio/music';
import { useMusic } from '../audio/useMusic';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Next to the language toggle, only while FOH music plays: mutes and unmutes it from anywhere.
 * An icon button, so its name comes from aria-label; aria-pressed says whether it is muted.
 */
export function MuteButton() {
  const { t } = useTranslation();
  const { playing, muted } = useMusic();
  if (!playing) return null;

  return (
    <button
      type="button"
      className="header-action"
      aria-label={t('foh.mute')}
      aria-pressed={muted}
      onClick={() => setMuted(!muted)}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
        {muted ? (
          <path d="M16 9l6 6M22 9l-6 6" strokeLinecap="round" />
        ) : (
          <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
