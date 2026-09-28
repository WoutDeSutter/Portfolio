import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../i18n/useTranslation';
import { findStation, type StationId } from './stations';

type StationHeaderProps = {
  id: StationId;
  intro?: string;
};

/** Cue label + heading shared by the Work, Lab, About and Contact stations. */
export function StationHeader({ id, intro }: StationHeaderProps) {
  const { t } = useTranslation();
  const name = t(`stations.${id}`);
  useDocumentTitle(name);

  return (
    <header className="station__header">
      <p className="label">
        <span className="station__cue">{findStation(id).cue}</span> / {name}
      </p>
      <h1 className="station__title">{name}</h1>
      {intro && <p className="station__intro">{intro}</p>}
    </header>
  );
}
