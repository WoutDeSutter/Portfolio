import { PROJECT_SECTIONS } from '../content/types';
import { useTranslation } from '../i18n/useTranslation';

/**
 * The optional case-study sections. A section only appears when its text exists in the
 * translations; a blank line (\n\n) in the text starts a new paragraph.
 */
export function ProjectSections({ slug }: { slug: string }) {
  const { t, tOptional } = useTranslation();

  const sections = PROJECT_SECTIONS.map((id) => ({
    id,
    text: tOptional(`projects.${slug}.sections.${id}`),
  })).filter((section): section is { id: (typeof PROJECT_SECTIONS)[number]; text: string } =>
    Boolean(section.text),
  );

  return sections.map((section) => (
    <section key={section.id} className="project__section" aria-labelledby={`section-${section.id}`}>
      <h2 id={`section-${section.id}`} className="label">
        {t(`project.sections.${section.id}`)}
      </h2>
      {section.text.split(/\n\s*\n/).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </section>
  ));
}
