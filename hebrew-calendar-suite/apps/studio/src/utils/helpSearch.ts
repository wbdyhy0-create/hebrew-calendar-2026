import type { HelpEntry } from './helpKnowledge';

const HEBREW_NIQQUD_RE = /[\u0591-\u05C7]/g;

function normalize(s: string): string {
  return String(s || '')
    .replace(HEBREW_NIQQUD_RE, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

const SYNONYMS: Array<[string, string[]]> = [
  ['תא', ['משבצת', 'ריבוע']],
  ['תמונה', ['צילום', 'image', 'img', 'רקע']],
  ['גופן', ['פונט', 'font', 'טיפוגרפיה']],
  ['זמנים', ['כניסה', 'יציאה', 'הדלקת נרות', 'הבדלה', 'havdalah']],
  ['אירוע', ['אירועים', 'חג', 'מועד']],
  ['מרכוז', ['מרכז', 'center', 'align']],
];

function expandQueryTokens(q: string): string[] {
  const base = normalize(q).split(' ').filter(Boolean);
  const out: string[] = [...base];
  for (const token of base) {
    for (const [canon, alts] of SYNONYMS) {
      if (token === canon || alts.includes(token)) {
        out.push(canon, ...alts);
      }
    }
  }
  return uniq(out);
}

export type HelpMatch = {
  entry: HelpEntry;
  score: number;
  matched: string[];
};

export function searchHelp(entries: HelpEntry[], query: string, limit = 5): HelpMatch[] {
  const tokens = expandQueryTokens(query);
  if (!tokens.length) return [];

  const results: HelpMatch[] = [];
  for (const entry of entries) {
    const hay = normalize([entry.title, ...entry.keywords].join(' '));
    let score = 0;
    const matched: string[] = [];
    for (const t of tokens) {
      if (!t) continue;
      if (hay.includes(t)) {
        score += Math.min(8, Math.max(1, t.length / 2));
        matched.push(t);
      }
    }
    // Small boost for exact phrase hits.
    const nq = normalize(query);
    if (nq && hay.includes(nq)) score += 12;

    if (score > 0) results.push({ entry, score, matched: uniq(matched) });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, Math.max(1, limit));
}

