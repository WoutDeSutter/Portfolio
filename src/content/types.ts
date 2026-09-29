/*
 * Shapes of the JSON content in src/data.
 * All user-facing text lives in src/data/i18n, keyed by project slug.
 */

import type { Language } from '../i18n/dictionaries';

export type ProjectKind = 'featured' | 'project' | 'lab';

export type ProjectStatus = 'concept' | 'in-progress' | 'completed' | 'archived';

export type MediaItem =
  | { type: 'image'; src: string; altKey: string }
  | {
      type: 'video';
      src: string;
      poster?: string;
      captionKey?: string;
      /** WebVTT subtitle files per language, e.g. { "en": "media/x/en.vtt" }. */
      subtitles?: Partial<Record<Language, string>>;
    }
  | { type: 'model'; src: string; altKey: string };

export type LinkType = 'github' | 'demo' | 'apk' | 'external' | 'download';

export type ProjectLink = {
  type: LinkType;
  url: string;
};

export type ProjectDemo =
  | { enabled: false }
  | { enabled: true; type: 'webgl' | 'webxr' | 'external'; url: string };

export type Project = {
  slug: string;
  kind: ProjectKind;
  status: ProjectStatus;
  year?: number;
  categories: string[];
  /** Skill ids from skills.json */
  technologies: string[];
  media: MediaItem[];
  links: ProjectLink[];
  demo: ProjectDemo;
  /**
   * Small animated 3D model shown on the booth counter (Projects or Lab), e.g.
   * "models/items/tagrun.glb" — exported from festival.blend (collection item_<slug>).
   * Leave it out for no model.
   */
  model?: string;
};

/**
 * Optional case-study sections, in display order.
 * A section is shown only when `projects.<slug>.sections.<id>` exists in the translations.
 */
export const PROJECT_SECTIONS = [
  'overview',
  'problem',
  'concept',
  'development',
  'interaction',
  'role',
  'challenges',
  'result',
] as const;

export type ProjectSectionId = (typeof PROJECT_SECTIONS)[number];

export type SkillGroup = 'xr' | 'software' | 'physical';

export type Skill = {
  id: string;
  name: string;
  group: SkillGroup;
};

export type SiteConfig = {
  name: string;
  contact: {
    email: string;
    linkedin: string;
    github: string;
    discord: string;
  };
  cv: { file: string };
  contactForm: { formspreeId: string };
};

/** A track for the FOH easter egg (src/data/music.json). Title and credit are shown while it plays. */
export type Track = {
  id: string;
  /** Relative to public/, e.g. "music/alan-walker-dreamer.mp3". */
  file: string;
  title: string;
  artist: string;
  /** Credit line required by the licence, e.g. "Music provided by NoCopyrightSounds". */
  credit: string;
};
