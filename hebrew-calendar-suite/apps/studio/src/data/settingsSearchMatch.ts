import type { SettingsSearchItem } from './settingsSearchItems';
import { anchorSlugTerms, lexiconForAnchor, normalizeForSearch } from './settingsSearchLexicon';

export type SettingsSearchMatchMode = 'strict' | 'relaxed';

/** מפרק מחרוזת חיפוש למילים (רווחים, פסיקים, נקודה-פסיק וכו׳). */
export function tokenizeSearchQuery(q: string): string[] {
  const parts = q
    .trim()
    .toLowerCase()
    .split(/[\s\u00A0,.;:]+/u);
  return parts
    .map((t) => t.replace(/^['"״\-–—]+|['"״\-–—]+$/g, '').trim())
    .map((t) => normalizeForSearch(t))
    .filter((t) => t.length > 0);
}

/** מרחיב מפתחות מסוג camelCase / snake_case לחיפוש חופשי. */
function expandDevTokens(tokens: string | undefined): string {
  if (!tokens) return '';
  const camel = tokens.replace(/([a-z])([A-Z])/g, '$1 $2');
  const unders = camel.replace(/_/g, ' ');
  return `${tokens} ${camel} ${unders}`;
}

/** כל הטקסט שנסרק בחיפוש לפריט אחד. */
export function buildSearchHaystack(item: SettingsSearchItem): string {
  const slug = anchorSlugTerms(item.anchorId);
  const lex = lexiconForAnchor(item.anchorId);
  const dev = expandDevTokens(item.tokens);
  const raw = `${item.label} ${item.category} ${item.tokens ?? ''} ${dev} ${slug} ${lex}`;
  return normalizeForSearch(raw.toLowerCase());
}

function matchesStrict(haystack: string, words: string[]): boolean {
  return words.length > 0 && words.every((w) => haystack.includes(w));
}

function relaxedScore(haystack: string, words: string[]): number {
  return words.reduce((n, w) => n + (haystack.includes(w) ? 1 : 0), 0);
}

/**
 * חיפוש מדויק: כל מילה חייבת להופיע (AND).
 * אם אין תוצאות — חיפוש חופשי: לפחות מילה אחת (OR) עם דירוג לפי מספר התאמות.
 */
export function searchSettingsItems(
  items: readonly SettingsSearchItem[],
  words: string[],
): { results: SettingsSearchItem[]; mode: SettingsSearchMatchMode } {
  if (words.length === 0) return { results: [], mode: 'strict' };

  const enriched = items.map((item) => ({
    item,
    hay: buildSearchHaystack(item),
  }));

  const strictHits = enriched.filter(({ hay }) => matchesStrict(hay, words)).map(({ item }) => item);
  if (strictHits.length > 0) {
    return { results: strictHits.slice(0, 48), mode: 'strict' };
  }

  const scored = enriched
    .map(({ item, hay }) => ({ item, score: relaxedScore(hay, words) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.item.label.localeCompare(b.item.label, 'he', { sensitivity: 'base' }),
    );

  return { results: scored.map((x) => x.item).slice(0, 48), mode: 'relaxed' };
}
