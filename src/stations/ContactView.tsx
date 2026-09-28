import { ContactForm } from '../components/ContactForm';
import { ExternalLink } from '../components/ExternalLink';
import { site } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';
import { StationHeader } from './StationHeader';

type Channel = {
  id: 'email' | 'linkedin' | 'github' | 'discord';
  value: string;
  href?: string;
};

export function ContactView() {
  const { t } = useTranslation();
  const { email, linkedin, github, discord } = site.contact;
  const { formspreeId } = site.contactForm;

  const channels: Channel[] = [
    { id: 'email', value: email, href: `mailto:${email}` },
    { id: 'linkedin', value: linkedin, href: linkedin },
    { id: 'github', value: github, href: github },
    // Discord has no public profile URL for usernames, so it is shown as text.
    { id: 'discord', value: discord },
  ];
  const configured = channels.filter((channel) => channel.value);

  return (
    <div className="station">
      <StationHeader id="contact" intro={t('contact.intro')} />

      <section className="station__section">
        {configured.length === 0 && !formspreeId && (
          <p className="station__empty">{t('contact.notConfigured')}</p>
        )}
        {configured.length > 0 && (
          <dl className="contact__channels">
            {configured.map((channel) => (
              <div key={channel.id} className="contact__channel">
                <dt className="label">{t(`contact.${channel.id}`)}</dt>
                <dd>
                  {channel.id === 'email' ? (
                    <a href={channel.href}>{channel.value}</a>
                  ) : channel.href ? (
                    <ExternalLink href={channel.href}>{channel.value}</ExternalLink>
                  ) : (
                    channel.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* The form only appears once a Formspree id is set in site.json; until then the
          channels above (including email) are the way to get in touch. */}
      {formspreeId && <ContactForm formspreeId={formspreeId} fallbackEmail={email} />}
    </div>
  );
}
