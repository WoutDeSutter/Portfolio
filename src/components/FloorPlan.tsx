import { Link, useLocation } from 'react-router';
import { useTranslation } from '../i18n/useTranslation';
import { ENTRY, STATIONS, getStationForPath } from '../stations/stations';
import './FloorPlan.css';

/**
 * Top-down plan of the stage: shows where the visitor is and where they can go.
 * It is also the conventional, keyboard-accessible navigation.
 */
export function FloorPlan() {
  const { t } = useTranslation();
  const current = getStationForPath(useLocation().pathname);

  return (
    <nav className="floor-plan" aria-label={t('floorPlan.label')}>
      <svg className="floor-plan__map" viewBox="0 0 200 124" aria-hidden="true">
        <rect className="floor-plan__boundary" x="4" y="4" width="192" height="116" />
        {STATIONS.filter((station) => station !== ENTRY).map((station) => (
          <line
            key={station.id}
            className={
              station === current ? 'floor-plan__path floor-plan__path--active' : 'floor-plan__path'
            }
            x1={ENTRY.plan.x}
            y1={ENTRY.plan.y}
            x2={station.plan.x}
            y2={station.plan.y}
          />
        ))}
        {STATIONS.map((station) => (
          <g
            key={station.id}
            className={station === current ? 'floor-plan__mark floor-plan__mark--current' : 'floor-plan__mark'}
            transform={`translate(${station.plan.x} ${station.plan.y})`}
          >
            <rect x="-4" y="-4" width="8" height="8" />
            {station === current && <circle className="floor-plan__pulse" r="9" />}
          </g>
        ))}
      </svg>

      <ol className="floor-plan__list" role="list">
        {STATIONS.map((station) => {
          const isCurrent = station === current;
          return (
            <li key={station.id}>
              <Link
                to={station.path}
                className="floor-plan__link"
                aria-current={isCurrent ? 'location' : undefined}
              >
                <span className="floor-plan__cue">{station.cue}</span>
                <span>{t(`stations.${station.id}`)}</span>
                {isCurrent && <span className="visually-hidden">({t('floorPlan.youAreHere')})</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
