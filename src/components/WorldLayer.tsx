import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getProject, getProjectsByKind, site, skills, tracks } from '../content/content';
import type { Project } from '../content/types';
import { getState as getMusicState, pause, play, setVolume, stop } from '../audio/music';
import { useMusic } from '../audio/useMusic';
import { LIGHT_MODES, setLightMode, toggleLightColor, useLights, type LightMode } from '../festival/lights';
import { OPENABLE_PLACES, getPlaceForPath, type PlaceId } from '../festival/places';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useTranslation } from '../i18n/useTranslation';
import { whenIdle } from '../utils/whenIdle';
import type { BoardRow } from '../world/board';
import type { FohAction } from '../world/fohDesk';
import type { FestivalWorld, HoverInfo, WorldLabels } from '../world/world';
import './WorldLayer.css';

type WorldLayerProps = {
  /** Pixels covered by the open panel, so the world can keep the place beside it. */
  frame: { right: number; bottom: number };
  /** The world could not start (e.g. the GPU refused a WebGL context); show the text version. */
  onFail: () => void;
};

/**
 * The 3D festival, filling the screen behind everything. The URL decides where the camera
 * is: this component forwards route changes, labels and panel size to the world.
 */
/**
 * What the boards inside the booths show, from the same content as the panels: the Projects menu
 * (clickable, opens the case study), the Lab tap list, the Merch price list, the info point and
 * the profiles at Links.
 */
function useBoards(): WorldLabels['boards'] {
  const { t } = useTranslation();
  const toRow = (project: Project): BoardRow => ({
    label: t(`projects.${project.slug}.title`),
    detail: t(`project.status.${project.status}`),
    path: `/projects/${project.slug}`,
  });
  const profiles = (['linkedin', 'github', 'discord'] as const).filter((id) => site.contact[id]);

  return {
    projects: {
      title: t('booths.projects.board'),
      rows: [...getProjectsByKind('featured'), ...getProjectsByKind('project')].map(toRow),
    },
    lab: { title: t('booths.lab.board'), rows: getProjectsByKind('lab').map(toRow), empty: t('booths.lab.empty') },
    merch: { title: t('booths.merch.board'), rows: [{ label: t('booths.merch.cv'), detail: t('booths.merch.free') }] },
    contact: { title: t('booths.contact.board'), icon: 'i' },
    links: {
      title: t('booths.links.board'),
      rows: profiles.map((id) => ({ label: t(`contact.${id}`) })),
      empty: t('booths.links.empty'),
    },
  };
}

/**
 * The item on each counter: the open project's model, otherwise the first project of that
 * booth that has one (the "dish of the day").
 */
function itemsFor(pathname: string): { projects: string | null; lab: string | null } {
  const open = getProject(pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? '');
  const first = (list: Project[]) => list.find((project) => project.model)?.model ?? null;
  const menu = [...getProjectsByKind('featured'), ...getProjectsByKind('project')];
  return {
    projects: open && open.kind !== 'lab' && open.model ? open.model : first(menu),
    lab: open && open.kind === 'lab' && open.model ? open.model : first(getProjectsByKind('lab')),
  };
}

/** A click on one of the FOH desk screens in the world: the same actions as the FOH panel. */
function runFohAction(action: FohAction) {
  switch (action.type) {
    case 'track': {
      const track = tracks.find((candidate) => candidate.id === action.id);
      if (!track) return;
      const { track: current, playing } = getMusicState();
      if (current?.id === track.id && playing) pause();
      else play(track);
      return;
    }
    case 'play': {
      const current = getMusicState().track;
      if (current) play(current);
      return;
    }
    case 'pause':
      return pause();
    case 'stop':
      return stop();
    case 'volume':
      return setVolume(action.value);
    case 'mode':
      return setLightMode(action.mode);
    case 'color':
      return toggleLightColor(action.color);
  }
}

export function WorldLayer({ frame, onFail }: WorldLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<FestivalWorld | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { pathname } = useLocation();
  const placeId = getPlaceForPath(pathname).id;
  const items = itemsFor(pathname);
  const lights = useLights();
  const music = useMusic();

  const labels: WorldLabels = {
    places: Object.fromEntries(OPENABLE_PLACES.map((place) => [place.id, t(`places.${place.id}`)])) as Record<
      PlaceId,
      string
    >,
    boards: useBoards(),
    name: site.name,
    role: t('meta.role'),
    about: {
      name: site.name,
      role: t('meta.role'),
      title: t('places.about'),
      intro: t('about.intro'),
      technologies: t('about.skillsHeading'),
      groups: (['xr', 'software', 'physical'] as const).map((group) => ({
        title: t(`skills.groups.${group}`),
        items: skills.filter((skill) => skill.group === group).map((skill) => skill.name),
      })),
    },
    foh: {
      tracks,
      music: t('foh.music'),
      lights: t('foh.lights'),
      colors: t('foh.colors'),
      volume: t('foh.volume'),
      noTracks: t('foh.noTracks'),
      nowPlaying: t('foh.nowPlaying'),
      paused: t('foh.paused'),
      idle: t('foh.idle'),
      modes: Object.fromEntries(LIGHT_MODES.map((mode) => [mode, t(`foh.modes.${mode}`)])) as Record<LightMode, string>,
    },
  };

  // Refs let the loading effect read the latest values without restarting the world.
  // `navigate` is among them: React Router gives it a new identity on every route change,
  // and as an effect dependency it would rebuild the whole world on each click.
  const fohState = { track: music.track?.id ?? null, playing: music.playing, volume: music.volume, lights };
  const latest = useRef({ placeId, labels, frame, items, lights, fohState, navigate, onFail });
  useEffect(() => {
    latest.current = { placeId, labels, frame, items, lights, fohState, navigate, onFail };
  });

  useEffect(() => {
    worldRef.current?.setFohState(latest.current.fohState);
  }, [fohState.track, fohState.playing, fohState.volume, lights]);

  useEffect(() => {
    worldRef.current?.setLights(lights);
  }, [lights]);

  useEffect(() => {
    worldRef.current?.showItem('projects', items.projects);
    worldRef.current?.showItem('lab', items.lab);
  }, [items.projects, items.lab]);

  useEffect(() => {
    worldRef.current?.goTo(placeId);
  }, [placeId]);

  useEffect(() => {
    worldRef.current?.setLabels(latest.current.labels);
  }, [language]);

  useEffect(() => {
    worldRef.current?.setFrame(frame.right, frame.bottom);
  }, [frame.right, frame.bottom]);

  useEffect(() => {
    let cancelled = false;

    const start = () => {
      performance.mark('world:start');
      // Dynamic import: Three.js is downloaded as a separate file, after the page has shown.
      import('../world/world')
        .then(({ createFestivalWorld }) => {
          if (cancelled || !containerRef.current) return;
          const world = createFestivalWorld(containerRef.current, {
            initialPlace: latest.current.placeId,
            labels: latest.current.labels,
            reducedMotion,
            onNavigate: (path) => latest.current.navigate(path),
            onHover: setHover,
            onFoh: runFohAction,
          });
          world.setFrame(latest.current.frame.right, latest.current.frame.bottom);
          world.showItem('projects', latest.current.items.projects);
          world.showItem('lab', latest.current.items.lab);
          world.setLights(latest.current.lights);
          world.setFohState(latest.current.fohState);
          worldRef.current = world;
          return world.ready.then(() => {
            if (cancelled) return;
            performance.measure('world:ready', 'world:start');
            setIsReady(true);
          });
        })
        .catch((error: unknown) => {
          console.error('[world] Could not start the 3D festival:', error);
          if (!cancelled) latest.current.onFail();
        });
    };
    const idle = whenIdle(start);

    return () => {
      cancelled = true;
      idle.cancel();
      worldRef.current?.dispose();
      worldRef.current = null;
      setIsReady(false);
      setHover(null);
    };
  }, [reducedMotion]);

  return (
    <>
      <div
        ref={containerRef}
        className={isReady ? 'world world--ready' : 'world'}
        aria-hidden="true"
      />
      {!isReady && <div className="world__loading label" aria-hidden="true" />}
      {hover && (
        <div
          className="world-label label"
          aria-hidden="true"
          style={{ transform: `translate(${hover.clientX}px, ${hover.clientY}px)` }}
        >
          {t(hover.labelKey)}
        </div>
      )}
    </>
  );
}
