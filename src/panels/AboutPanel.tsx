import { Link } from 'react-router';
import { Panel } from '../components/Panel';
import { getProjectsUsingSkill, skills } from '../content/content';
import type { SkillGroup } from '../content/types';
import { useTranslation } from '../i18n/useTranslation';

const SKILL_GROUPS: SkillGroup[] = ['xr', 'software', 'physical'];

/** The main stage: about Wout, and the technologies linked to real projects. */
export function AboutPanel() {
  const { t } = useTranslation();

  return (
    <Panel title={t('places.about')}>
      <p className="panel-intro">{t('about.intro')}</p>

      <section className="panel-section" aria-labelledby="about-skills">
        <h2 id="about-skills" className="label">
          {t('about.skillsHeading')}
        </h2>
        <div className="skills">
          {SKILL_GROUPS.map((group) => (
            <div key={group} className="skills__group">
              <h3 className="skills__group-title">{t(`skills.groups.${group}`)}</h3>
              <ul className="skills__list" role="list">
                {skills
                  .filter((skill) => skill.group === group)
                  .map((skill) => {
                    // Skills link to the real projects that use them — no proficiency scores.
                    const usedIn = getProjectsUsingSkill(skill.id);
                    return (
                      <li key={skill.id} className="skills__item">
                        <span>{skill.name}</span>
                        {usedIn.length > 0 && (
                          <span className="skills__used-in">
                            <span className="visually-hidden">{t('about.usedIn')}: </span>
                            {usedIn.map((project) => (
                              <Link key={project.slug} to={`/projects/${project.slug}`} className="label">
                                {t(`projects.${project.slug}.title`)}
                              </Link>
                            ))}
                          </span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </Panel>
  );
}
