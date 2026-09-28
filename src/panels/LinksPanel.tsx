import { ExternalLink } from '../components/ExternalLink';
import { Panel } from '../components/Panel';
import { site } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';

/** The Links stand: professional profiles. */
export function LinksPanel() {
  const { t } = useTranslation();
  const { linkedin, github, discord } = site.contact;
  const channels = [
    { id: 'linkedin', value: linkedin, href: linkedin },
    { id: 'github', value: github, href: github },
    // Discord has no public profile URL for usernames, so it is shown as text.
    { id: 'discord', value: discord, href: '' },
  ].filter((channel) => channel.value);

  return (
    <Panel title={t('places.links')}>
      {channels.length > 0 ? (
        <dl className="channels">
          {channels.map((channel) => (
            <div key={channel.id} className="channels__item">
              <dt className="label">{t(`contact.${channel.id}`)}</dt>
              <dd>{channel.href ? <ExternalLink href={channel.href}>{channel.value}</ExternalLink> : channel.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="panel-empty">{t('links.empty')}</p>
      )}
    </Panel>
  );
}
