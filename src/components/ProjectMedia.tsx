import type { MediaItem } from '../content/types';
import { useTranslation } from '../i18n/useTranslation';

/** Images and videos load lazily so a project page stays fast with many media items. */
export function ProjectMedia({ items }: { items: MediaItem[] }) {
  const { t, tOptional } = useTranslation();
  // 3D models are presented by the Three.js layer (added in a later step).
  const visible = items.filter((item) => item.type !== 'model');
  if (visible.length === 0) return null;

  return (
    <div className="project-media">
      {visible.map((item) => (
        <figure key={item.src} className="project-media__item">
          {item.type === 'image' && <img src={item.src} alt={t(item.altKey)} loading="lazy" />}
          {item.type === 'video' && (
            <>
              <video src={item.src} poster={item.poster} controls preload="none" playsInline />
              {item.captionKey && <figcaption className="label">{tOptional(item.captionKey)}</figcaption>}
            </>
          )}
        </figure>
      ))}
    </div>
  );
}
