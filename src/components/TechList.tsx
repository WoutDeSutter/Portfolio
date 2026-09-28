import { getSkill } from '../content/content';

/** Renders skill ids from projects.json as their display names. */
export function TechList({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;

  return (
    <ul className="tech-list" role="list">
      {ids.map((id) => (
        <li key={id} className="label">
          {getSkill(id)?.name ?? id}
        </li>
      ))}
    </ul>
  );
}
