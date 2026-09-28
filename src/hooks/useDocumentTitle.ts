import { useEffect } from 'react';
import { site } from '../content/content';

/** Sets the browser tab title, e.g. "Work — Wout De Sutter". */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — ${site.name}`;
  }, [title]);
}
