import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from '../i18n/useTranslation';
import type { CameraHeading } from '../scene/interactive';
import {
  ENTRY,
  PLAN_BOUNDS,
  PLAN_TO_WORLD,
  STATIONS,
  getStationForPath,
} from '../stations/stations';
import './FloorPlan.css';

type FloorPlanProps = {
  /** Where the 3D camera is heading; null when there is no 3D stage. */
  cameraHeading: CameraHeading | null;
};

/**
 * Top-down plan of the stage: shows where the visitor is and where they can go.
 * It is also the conventional, keyboard-accessible navigation.
 */
export function FloorPlan({ cameraHeading }: FloorPlanProps) {
  const { t } = useTranslation();
  const current = getStationForPath(useLocation().pathname);

  return (
    <nav className="floor-plan" aria-label={t('floorPlan.label')}>
      <svg className="floor-plan__map" viewBox="0 0 200 124" aria-hidden="true">
        <rect
          className="floor-plan__boundary"
          x={PLAN_BOUNDS.x0}
          y={PLAN_BOUNDS.y0}
          width={PLAN_BOUNDS.x1 - PLAN_BOUNDS.x0}
          height={PLAN_BOUNDS.y1 - PLAN_BOUNDS.y0}
        />
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
        {cameraHeading && <ViewCone heading={cameraHeading} />}
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

/**
 * A wedge showing the camera's position and viewing direction, like the audience
 * position on a stage plot. Cameras outside the stage are drawn at its edge.
 */
function ViewCone({ heading }: { heading: CameraHeading }) {
  // World units on the floor → floor-plan units (the entry is the world origin).
  const toPlan = ({ x, z }: { x: number; z: number }) => ({
    x: ENTRY.plan.x + x / PLAN_TO_WORLD,
    y: ENTRY.plan.y + z / PLAN_TO_WORLD,
  });
  const camera = toPlan(heading.camera);
  const target = toPlan(heading.lookAt);
  const apex = {
    x: clamp(camera.x, PLAN_BOUNDS.x0, PLAN_BOUNDS.x1),
    y: clamp(camera.y, PLAN_BOUNDS.y0, PLAN_BOUNDS.y1),
  };
  const angle = (Math.atan2(target.y - apex.y, target.x - apex.x) * 180) / Math.PI;

  // Rotate the short way round: pick the equivalent angle closest to the previous one.
  const previousAngle = useRef(angle);
  const displayAngle = angle + 360 * Math.round((previousAngle.current - angle) / 360);
  useEffect(() => {
    previousAngle.current = displayAngle;
  });

  return (
    <path
      className="floor-plan__view"
      d="M0 0 L28 -12 L28 12 Z"
      style={{ transform: `translate(${apex.x}px, ${apex.y}px) rotate(${displayAngle}deg)` }}
    />
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
