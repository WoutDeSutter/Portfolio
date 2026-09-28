import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import './ContactForm.css';

type FieldName = 'name' | 'email' | 'message';
type FieldError = 'required' | 'email';
type Status = 'idle' | 'sending' | 'success' | 'error';

const FIELDS: FieldName[] = ['name', 'email', 'message'];
const EMPTY: Record<FieldName, string> = { name: '', email: '', message: '' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactFormProps = {
  /** Form id from formspree.io (the part after /f/). */
  formspreeId: string;
  /** Shown when sending fails, so the visitor always has a way to reach Wout. */
  fallbackEmail: string;
};

/** Errors are stored as keys, not text, so they follow a language switch. */
function validate(values: Record<FieldName, string>): Partial<Record<FieldName, FieldError>> {
  const errors: Partial<Record<FieldName, FieldError>> = {};
  for (const field of FIELDS) {
    if (!values[field].trim()) errors[field] = 'required';
  }
  if (!errors.email && !EMAIL_PATTERN.test(values.email.trim())) errors.email = 'email';
  return errors;
}

/**
 * A "controlled" form: React state holds every field's value, so validation can run
 * while typing. Messages are sent to Formspree, because GitHub Pages has no server.
 */
export function ContactForm({ formspreeId, fallbackEmail }: ContactFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, FieldError>>>({});
  const [status, setStatus] = useState<Status>('idle');
  const fieldRefs = useRef<Partial<Record<FieldName, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const field = event.target.name as FieldName;
    const next = { ...values, [field]: event.target.value };
    setValues(next);
    // Once a field shows an error, update it while typing so it disappears when fixed.
    if (errors[field]) setErrors((current) => ({ ...current, [field]: validate(next)[field] }));
    if (status === 'success' || status === 'error') setStatus('idle');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    const firstInvalid = FIELDS.find((field) => found[field]);
    if (firstInvalid) {
      fieldRefs.current[firstInvalid]?.focus();
      return;
    }

    setStatus('sending');
    try {
      const response = await fetch(`https://formspree.io/f/${formspreeId}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(event.currentTarget),
      });
      if (!response.ok) throw new Error(`Formspree responded ${response.status}`);
      setStatus('success');
      setValues(EMPTY);
    } catch {
      setStatus('error');
    }
  };

  const field = (name: FieldName, input: 'input' | 'textarea') => {
    const id = `contact-${name}`;
    const errorId = `${id}-error`;
    const error = errors[name];
    const shared = {
      id,
      name,
      value: values[name],
      onChange: handleChange,
      required: true,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? errorId : undefined,
    };

    return (
      <div className="form-field">
        <label htmlFor={id} className="label">
          {t(`contact.form.${name}`)}
        </label>
        {input === 'textarea' ? (
          <textarea {...shared} rows={6} ref={(element) => void (fieldRefs.current[name] = element)} />
        ) : (
          <input
            {...shared}
            type={name === 'email' ? 'email' : 'text'}
            autoComplete={name}
            ref={(element) => void (fieldRefs.current[name] = element)}
          />
        )}
        {error && (
          <p id={errorId} className="form-field__error">
            {t(`contact.form.errors.${error}`)}
          </p>
        )}
      </div>
    );
  };

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate aria-labelledby="contact-form-heading">
      <h2 id="contact-form-heading" className="label">
        {t('contact.form.heading')}
      </h2>

      {field('name', 'input')}
      {field('email', 'input')}
      {field('message', 'textarea')}

      {/* Spam trap: invisible to people, bots fill it in and Formspree then drops the message. */}
      <input type="text" name="_gotcha" className="contact-form__trap" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <div className="contact-form__actions">
        <button type="submit" className="header-action header-action--accent" disabled={status === 'sending'}>
          <span className="label">{t(status === 'sending' ? 'contact.form.sending' : 'contact.form.submit')}</span>
        </button>

        {/* Live region: always present (even when empty) so screen readers announce changes. */}
        <div className="contact-form__status" role="status">
          {status === 'success' && <p>{t('contact.form.success')}</p>}
          {status === 'error' && (
            <p className="contact-form__status--error">
              {t('contact.form.error')}{' '}
              {fallbackEmail && <a href={`mailto:${fallbackEmail}`}>{fallbackEmail}</a>}
            </p>
          )}
        </div>
      </div>

      <p className="contact-form__privacy">{t('contact.form.privacy')}</p>
    </form>
  );
}
