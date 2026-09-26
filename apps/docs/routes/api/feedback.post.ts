import { defineEventHandler, readBody, setResponseStatus } from 'h3';
import { useStorage } from 'nitro/storage';
import { parseFeedbackSubmission, feedbackStorageKey, type FeedbackRecord } from '../../src/lib/feedback';

// DX-061: cookieless "was this helpful" feedback. This handler never reads a
// cookie or a request header, and stores only what parseFeedbackSubmission
// returns — page path, verdict, an already-redacted comment, and a coarse
// (day-granularity) timestamp. No per-visitor identifier exists to store.
//
// Registered explicitly in nitro.config.ts rather than picked up by
// file-based route scanning (serverDir is unset in this app, so that scan
// never runs — see the comment there), which also means this file cannot
// rely on Nitro's auto-imported globals and must import h3/nitro helpers
// itself.
const MAX_RECORDS_PER_PAGE = 500;

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const record = parseFeedbackSubmission(body);

  if (!record) {
    setResponseStatus(event, 400);
    return { ok: false };
  }

  const storage = useStorage('feedback');
  const key = feedbackStorageKey(record.path);
  const existing = (await storage.getItem<Array<FeedbackRecord>>(key)) ?? [];
  existing.push(record);
  while (existing.length > MAX_RECORDS_PER_PAGE) existing.shift();
  await storage.setItem(key, existing);

  setResponseStatus(event, 204);
  return null;
});
