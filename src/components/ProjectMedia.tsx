import type { MediaItem } from '../content/types';
import { useTranslation } from '../i18n/useTranslation';

/** One image or video with its optional caption. Loads lazily so long pages stay fast. */
export function MediaFigure({ item, eager = false }: { item: MediaItem; eager?: boolean }) {
  const { t, tOptional, language } = useTranslation();
  // 3D models are presented by the Three.js layer, not in the page.
  if (item.type === 'model') return null;

  return (
    <figure className="project-media__item">
      {item.type === 'image' ? (
        <img src={item.src} alt={t(item.altKey)} loading={eager ? 'eager' : 'lazy'} decoding="async" />
      ) : (
        <video src={item.src} poster={item.poster} controls preload="none" playsInline>
          {/* Subtitles: the track in the site's current language is on by default. */}
          {Object.entries(item.subtitles ?? {}).map(([lang, src]) => (
            <track
              key={lang}
              kind="subtitles"
              src={src}
              srcLang={lang}
              label={lang === 'nl' ? 'Nederlands' : 'English'}
              default={lang === language}
            />
          ))}
        </video>
      )}
      {item.type === 'video' && item.captionKey && (
        <figcaption className="label">{tOptional(item.captionKey)}</figcaption>
      )}
    </figure>
  );
}

/** Everything after the hero image, as a gallery section. */
export function ProjectGallery({ items }: { items: MediaItem[] }) {
  const { t } = useTranslation();
  const visible = items.filter((item) => item.type !== 'model');
  if (visible.length === 0) return null;

  return (
    <section className="project__section" aria-labelledby="project-media">
      <h2 id="project-media" className="label">
        {t('project.media')}
      </h2>
      <div className="project-media">
        {visible.map((item, index) => (
          <MediaFigure key={`${index}-${item.src}`} item={item} />
        ))}
      </div>
    </section>
  );
}
