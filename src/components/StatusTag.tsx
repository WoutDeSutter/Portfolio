import type { ProjectStatus } from '../content/types';
import { useTranslation } from '../i18n/useTranslation';

export function StatusTag({ status }: { status: ProjectStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`status-tag status-tag--${status} label`}>{t(`project.status.${status}`)}</span>
  );
}
