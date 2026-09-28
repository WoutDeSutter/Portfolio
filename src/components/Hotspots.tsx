import { Link, useLocation } from 'react-router';
import { PLACES, getPlaceForPath } from '../festival/places';
import { useTranslation } from '../i18n/useTranslation';
import './Hotspots.css';

/**
 * A real link for every place on the terrain. In the 3D festival they stay invisible until
 * reached with the keyboard (Tab); in the text version they are the ordinary navigation.
 */
export function Hotspots() {
  const { t } = useTranslation();
  const current = getPlaceForPath(useLocation().pathname);

  return (
    <nav className="hotspots" aria-label={t('places.navLabel')}>
      <ul role="list">
        {PLACES.map((place) => (
          <li key={place.id}>
            <Link
              to={place.path}
              className="hotspots__link label"
              data-place={place.id}
              aria-current={place === current ? 'location' : undefined}
            >
              {t(`places.${place.id}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
