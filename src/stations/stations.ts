import { getProject } from '../content/content';

export type StationId = 'entry' | 'work' | 'lab' | 'about' | 'contact';

export type Station = {
  id: StationId;
  path: string;
  /** Cue number shown as a label, like a cue on a stage cue sheet. */
  cue: string;
  /** Position on the floor plan (viewBox 0 0 200 120). The 3D scene will use the same layout. */
  plan: { x: number; y: number };
};

export const STATIONS: Station[] = [
  { id: 'entry', path: '/', cue: '01', plan: { x: 100, y: 62 } },
  { id: 'work', path: '/work', cue: '02', plan: { x: 170, y: 62 } },
  { id: 'lab', path: '/lab', cue: '03', plan: { x: 72, y: 22 } },
  { id: 'about', path: '/about', cue: '04', plan: { x: 30, y: 62 } },
  { id: 'contact', path: '/contact', cue: '05', plan: { x: 72, y: 102 } },
];

export const ENTRY = STATIONS[0];

/** Which station a URL belongs to. Project pages belong to Work or Lab. */
export function getStationForPath(pathname: string): Station {
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  if (projectMatch) {
    const project = getProject(projectMatch[1]);
    return findStation(project?.kind === 'lab' ? 'lab' : 'work');
  }
  return STATIONS.find((station) => station.path === pathname) ?? ENTRY;
}

export function findStation(id: StationId): Station {
  return STATIONS.find((station) => station.id === id) ?? ENTRY;
}
