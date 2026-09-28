/*
 * Shapes of the JSON content in src/data.
 * All user-facing text lives in src/data/i18n, keyed by project slug.
 */

export type ProjectKind = 'featured' | 'project' | 'lab';

export type ProjectStatus = 'concept' | 'in-progress' | 'completed' | 'archived';

export type MediaItem =
  | { type: 'image'; src: string; altKey: string }
  | { type: 'video'; src: string; poster?: string; captionKey?: string }
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
