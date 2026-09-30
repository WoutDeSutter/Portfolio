import { ExternalLink } from '../components/ExternalLink';
import { Panel } from '../components/Panel';
import { site } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';

/** The Links stand: professional profiles. */
export function LinksPanel() {
  const { t } = useTranslation();
  const { linkedin, github, discord } = site.contact;
  // A profile URL becomes a link; a plain username (e.g. for Discord) is shown as text.
  const channels = [
    { id: 'linkedin', value: linkedin },
    { id: 'github', value: github },
    { id: 'discord', value: discord },
  ]
    .filter((channel) => channel.value)
    .map((channel) => ({ ...channel, href: isUrl(channel.value) ? channel.value : '' }));

  return (
    <Panel title={t('places.links')}>
      {channels.length > 0 ? (
        <dl className="channels">
          {channels.map((channel) => (
            <div key={channel.id} className="channels__item">
              <dt className="label">{t(`contact.${channel.id}`)}</dt>
              <dd>
                {channel.href ? <ExternalLink href={channel.href}>{shortUrl(channel.value)}</ExternalLink> : channel.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="panel-empty">{t('links.empty')}</p>
      )}
    </Panel>
  );
}

function isUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

/** "https://www.github.com/WoutDeSutter/" → "github.com/WoutDeSutter": easier to read in the panel. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}
