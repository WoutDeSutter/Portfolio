import type { ReactNode } from 'react';
import { useTranslation } from '../i18n/useTranslation';

type ExternalLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

/** A link that opens in a new tab and says so to screen-reader users. */
export function ExternalLink({ href, className, children }: ExternalLinkProps) {
  const { t } = useTranslation();
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="visually-hidden"> {t('common.opensInNewTab')}</span>
    </a>
  );
}
