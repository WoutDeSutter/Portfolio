import { getProject } from '../content/content';

export type PlaceId = 'entrance' | 'about' | 'foh' | 'projects' | 'lab' | 'contact' | 'links' | 'merch';

export type PlaceKind = 'entrance' | 'stage' | 'foh' | 'booth';

export type Place = {
  id: PlaceId;
  kind: PlaceKind;
  /** Route that opens this place. */
  path: string;
  /** Position on the terrain in metres: x = right, z = towards the entrance. */
  x: number;
  z: number;
  /** Direction the front faces, in radians around the vertical axis (0 = towards the entrance). */
  facing: number;
  /** Camera distance when this place is open. */
  viewDistance: number;
};

const FACE_ENTRANCE = 0;
/**
 * Booths face the middle of the field, turned about halfway towards the entrance — like real
 * festival stands angled at the crowd — so their signs are readable from the overview.
 */
const BOOTH_ANGLE = 0.8;
const FACE_RIGHT = BOOTH_ANGLE; // booths on the left
const FACE_LEFT = -BOOTH_ANGLE; // booths on the right

/**
 * The festival terrain, seen from the entrance (front) towards the main stage (back).
 * Left: Projects, Lab. Right: Contact, Links, Merch. FOH in the middle of the field.
 */
export const PLACES: Place[] = [
  { id: 'entrance', kind: 'entrance', path: '/', x: 0, z: 22, facing: FACE_ENTRANCE, viewDistance: 0 },
  { id: 'about', kind: 'stage', path: '/about', x: 0, z: -15, facing: FACE_ENTRANCE, viewDistance: 17 },
  { id: 'foh', kind: 'foh', path: '/foh', x: 0, z: 3, facing: FACE_ENTRANCE, viewDistance: 4.6 },
  { id: 'projects', kind: 'booth', path: '/projects', x: -12, z: -5, facing: FACE_RIGHT, viewDistance: 6 },
  { id: 'lab', kind: 'booth', path: '/lab', x: -12, z: 5, facing: FACE_RIGHT, viewDistance: 6 },
  { id: 'contact', kind: 'booth', path: '/contact', x: 12, z: -7, facing: FACE_LEFT, viewDistance: 6 },
  { id: 'links', kind: 'booth', path: '/links', x: 12, z: 1, facing: FACE_LEFT, viewDistance: 6 },
  { id: 'merch', kind: 'booth', path: '/merch', x: 12, z: 9, facing: FACE_LEFT, viewDistance: 6 },
];

export const ENTRANCE = PLACES[0];

/** Places a visitor can open (everything except the entrance, which is the overview). */
export const OPENABLE_PLACES = PLACES.filter((place) => place.kind !== 'entrance');

export function findPlace(id: PlaceId): Place {
  return PLACES.find((place) => place.id === id) ?? ENTRANCE;
}

/** Which place a URL belongs to. Project pages belong to Projects, or to Lab for LAB entries. */
export function getPlaceForPath(pathname: string): Place {
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  if (projectMatch) return findPlace(getProject(projectMatch[1])?.kind === 'lab' ? 'lab' : 'projects');
  return PLACES.find((place) => place.path === pathname) ?? ENTRANCE;
}
