import projectsData from '../data/projects.json';
import skillsData from '../data/skills.json';
import musicData from '../data/music.json';
import siteData from '../data/site.json';
import type { Project, ProjectKind, SiteConfig, Skill, Track } from './types';

// JSON imports are loosely typed; these casts tell TypeScript which shape we
// expect. types.ts is the contract that the JSON files must follow.
export const projects = projectsData as Project[];
export const skills = skillsData as Skill[];
export const site = siteData as SiteConfig;
export const tracks = musicData as Track[];

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

export function getProjectsByKind(kind: ProjectKind): Project[] {
  return projects.filter((project) => project.kind === kind);
}

/**
 * Previous and next project in the same order as their overview page:
 * Work lists featured projects first, then the others; Lab has its own list.
 */
export function getNeighbours(project: Project): { previous?: Project; next?: Project } {
  const list =
    project.kind === 'lab'
      ? getProjectsByKind('lab')
      : [...getProjectsByKind('featured'), ...getProjectsByKind('project')];
  const index = list.indexOf(project);
  return { previous: list[index - 1], next: list[index + 1] };
}

export function getProjectsUsingSkill(skillId: string): Project[] {
  return projects.filter((project) => project.technologies.includes(skillId));
}

export function getSkill(id: string): Skill | undefined {
  return skills.find((skill) => skill.id === id);
}
