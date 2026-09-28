import projectsData from '../data/projects.json';
import skillsData from '../data/skills.json';
import siteData from '../data/site.json';
import type { Project, ProjectKind, SiteConfig, Skill } from './types';

// JSON imports are loosely typed; these casts tell TypeScript which shape we
// expect. types.ts is the contract that the JSON files must follow.
export const projects = projectsData as Project[];
export const skills = skillsData as Skill[];
export const site = siteData as SiteConfig;

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

export function getProjectsByKind(kind: ProjectKind): Project[] {
  return projects.filter((project) => project.kind === kind);
}

export function getProjectsUsingSkill(skillId: string): Project[] {
  return projects.filter((project) => project.technologies.includes(skillId));
}

export function getSkill(id: string): Skill | undefined {
  return skills.find((skill) => skill.id === id);
}
