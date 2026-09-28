import { useEffect } from 'react';

/**
 * Sets the meta description (and Open Graph description) while a page is shown,
 * and restores the site default afterwards.
 */
export function useDocumentDescription(description: string) {
  useEffect(() => {
    const tags = [
      document.querySelector<HTMLMetaElement>('meta[name="description"]'),
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]'),
    ].filter((tag): tag is HTMLMetaElement => tag !== null);

    const previous = tags.map((tag) => tag.content);
    for (const tag of tags) tag.content = description;
    return () => tags.forEach((tag, index) => (tag.content = previous[index]));
  }, [description]);
}
