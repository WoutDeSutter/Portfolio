import { ContactForm } from '../components/ContactForm';
import { Panel } from '../components/Panel';
import { site } from '../content/content';
import { useTranslation } from '../i18n/useTranslation';

/** The info point: email and the contact form (socials are at the Links stand). */
export function ContactPanel() {
  const { t } = useTranslation();
  const { email } = site.contact;
  const { formspreeId } = site.contactForm;

  return (
    <Panel title={t('places.contact')}>
      <p className="panel-intro">{t('contact.intro')}</p>

      {email && (
        <dl className="channels">
          <div className="channels__item">
            <dt className="label">{t('contact.email')}</dt>
            <dd>
              <a href={`mailto:${email}`}>{email}</a>
            </dd>
          </div>
        </dl>
      )}

      {/* The form only appears once a Formspree id is set in site.json. */}
      {formspreeId && <ContactForm formspreeId={formspreeId} fallbackEmail={email} />}

      {!email && !formspreeId && <p className="panel-empty">{t('contact.notConfigured')}</p>}
    </Panel>
  );
}
