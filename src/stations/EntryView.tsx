import { Link } from 'react-router';
import { site } from '../content/content';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../i18n/useTranslation';
import { ENTRY, STATIONS } from './stations';

export function EntryView() {
  const { t } = useTranslation();
  useDocumentTitle(t('meta.role'));

  return (
    <div className="station station--entry">
      <header className="station__header">
        <p className="label">
          <span className="station__cue">{ENTRY.cue}</span> / {t('stations.entry')}
        </p>
        <h1 className="entry__name">{site.name}</h1>
        <p className="entry__role">{t('meta.role')}</p>
        <p className="station__intro">{t('entry.intro')}</p>
      </header>

      <nav aria-labelledby="entry-explore">
        <h2 id="entry-explore" className="label">
          {t('entry.explore')}
        </h2>
        <ol className="entry__routes" role="list">
          {STATIONS.filter((station) => station !== ENTRY).map((station) => (
            <li key={station.id}>
              <Link to={station.path} className="entry__route">
                <span className="label">{station.cue}</span>
                <span className="entry__route-name">{t(`stations.${station.id}`)}</span>
                <span className="entry__route-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
