import { z } from "zod";
import { opener, PROMPT_VERSION, validateVoice, voiceBudget } from "./voice.js";
import { writerTaste } from "./taste.js";
import { localDay } from "../lib/time.js";

export const BlurbSchema = z
  .object({
    id: z.string().min(1).max(120),
    skip: z.boolean(),
    skipReason: z.string().max(160),
    headline: z.string().max(60),
    text: z.string().max(200),
    cta: z.enum(["look", "listen", "watch", "read", "shop", "go", "keep"]),
    drawPrompt: z.boolean(),
  })
  .strict();
export const WriterSchema = z
  .object({ items: z.array(BlurbSchema).max(15) })
  .strict();
const cut = (text, max) =>
  text.length <= max
    ? text
    : text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
// The safe fallback carries no emoji: source titles often do, and they would spend the edition's
// emoji budget and make later templates unusable (seen emptying a section in production).
const plain = (text) =>
  String(text ?? "")
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{20E3}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
export function templateBlurb(item) {
  const title = plain(item.title) || item.title.toLowerCase();
  return {
    id: item.id,
    skip: false,
    skipReason: "",
    headline: cut(title.toLowerCase(), 60),
    text: cut(title.toLowerCase(), 150) + ". worth a look.",
    cta:
      item.kind === "song"
        ? "listen"
        : item.kind === "merch"
          ? "shop"
          : ["clip", "video", "tutorial"].includes(item.kind)
            ? "watch"
            : ["image", "cosplay", "meme", "look"].includes(item.kind)
              ? "look"
              : "read",
    drawPrompt: false,
  };
}

const sgTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Singapore",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const sgDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Singapore",
  day: "numeric",
  month: "short",
});

/**
 * Deterministic derived facts (Singapore time) so countdowns, air times and approximate SGD prices
 * can be stated without the model doing arithmetic or inventing numbers.
 */
export function derivedFacts(item, day, hint = {}) {
  const f = item.facts ?? {};
  const out = { ...(hint.derived ?? {}) };
  if (typeof f.sgd === "number") out.sgd = `S$${Math.round(f.sgd)}`;
  if (f.airingAt) {
    const at = new Date(f.airingAt);
    out.airingTime = sgTime.format(at);
    const airDay = localDay(at);
    if (airDay === day) out.airingDay = "tonight";
    out.airingDate = sgDate.format(at);
  }
  if (Number.isInteger(f.episode)) out.episode = String(f.episode);
  if (f.eventAt) out.eventStart = sgDate.format(new Date(f.eventAt));
  if (f.eventEndAt) out.eventEnd = sgDate.format(new Date(f.eventEndAt));
  if (f.preorderUntil) out.preorderUntil = sgDate.format(new Date(f.preorderUntil));
  if (f.releaseAt && f.releasePrecision === "month")
    out.releaseMonth = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Singapore" }).format(new Date(f.releaseAt));
  return out;
}

export function writerInput(
  items,
  {
    taste,
    day,
    section,
    recentOpeners = [],
    lexicon = { formats: [], fresh: [] },
    hints = {},
    saves = null,
  },
) {
  return {
    day,
    section,
    taste: writerTaste(taste),
    references: {
      pastCosplays: taste.pastCosplays,
      draws: "digital (iPad) and traditional drawing; drawPrompt may suggest drawing a picture",
      saves,
    },
    lexicon,
    recentOpeners: recentOpeners.slice(-30),
    items: items.map((i) => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      creator: i.credit.name,
      tags: i.tags,
      facts: {
        excerpts: i.facts.excerpts,
        names: i.facts.names,
        dates: i.facts.dates,
        prices: i.facts.prices,
        venue: i.facts.venue ?? "",
        city: i.facts.city ?? "",
        availability: i.facts.availability ?? null,
        links: (i.facts.links ?? []).map((l) => l.kind),
        lang: i.facts.lang ?? "",
      },
      derived: derivedFacts(i, day, hints[i.id]),
      why: hints[i.id]?.why ?? [],
      hook: hints[i.id]?.hook ?? null,
      pairedWith: hints[i.id]?.pairedWith ?? null,
      slotType: hints[i.id]?.slotType ?? null,
    })),
  };
}
const tasteNamesOf = (taste) => {
  const t = writerTaste(taste);
  return [...t.characters, ...t.fandoms, ...t.voicebanks, ...t.pastCosplays, ...t.cosplayWishlist];
};
export function inspectBatch(raw, items, context = {}) {
  const checked = WriterSchema.safeParse(raw);
  const accepted = [],
    failed = [];
  if (!checked.success)
    return {
      accepted,
      failed: items.map((i) => ({ id: i.id, reason: "malformed_output" })),
    };
  const ids = checked.data.items.map((i) => i.id),
    allowed = new Set(items.map((i) => i.id));
  if (new Set(ids).size !== ids.length || ids.some((id) => !allowed.has(id)))
    return {
      accepted,
      failed: items.map((i) => ({ id: i.id, reason: "unexpected_output_ids" })),
    };
  const tasteNames = context.taste ? tasteNamesOf(context.taste) : [];
  for (const item of items) {
    const b = checked.data.items.find((b) => b.id === item.id);
    let reason = !b
      ? "missing_output_id"
      : b.skip
        ? !b.skipReason
          ? "missing_skip_reason"
          : null
        : !b.text.trim() || !b.headline.trim()
          ? "empty_output"
          : validateVoice(b, item, {
              ...context,
              derived: derivedFacts(item, context.day, context.hints?.[item.id]),
              tasteNames,
              recentOpeners: [
                ...(context.recentOpeners ?? []),
                ...accepted.filter((x) => !x.skip).map((x) => opener(x.text)),
              ],
            });
    if (
      !reason &&
      b &&
      !b.skip &&
      !voiceBudget(
        [...accepted.filter((x) => !x.skip), b],
        context.history ?? [],
      )
    )
      reason = "voice_budget";
    if (reason) failed.push({ id: item.id, reason });
    else accepted.push(b);
  }
  return { accepted, failed };
}
export async function writeBlurbs(items, provider, context) {
  const approved = items.filter(
    (i) => i.safetyStatus === "approved" && i.visibility === "active",
  );
  let pending = approved,
    accepted = [],
    violations = [];
  const stats = { batches: 0, retries: 0, templates: 0, skipped: 0, reasons: {} };
  // Batches of ≤12 keep each request within the input bound and make retries cheap.
  for (let start = 0; start < approved.length; start += 12) {
    let batch = approved.slice(start, start + 12);
    for (let attempt = 0; attempt < 2 && batch.length; attempt++) {
      stats.batches++;
      if (attempt) stats.retries++;
      try {
        const raw = await provider.write(writerInput(batch, context), {
          attempt,
          violations: violations.filter((v) => batch.some((i) => i.id === v.id)),
        });
        const result = inspectBatch(raw, batch, {
          ...context,
          history: [
            ...(context.history ?? []),
            ...accepted.filter((b) => !b.skip),
          ],
          recentOpeners: [
            ...(context.recentOpeners ?? []),
            ...accepted.filter((b) => !b.skip).map((b) => opener(b.text)),
          ],
          offLimits: context.taste.offLimits,
        });
        accepted.push(
          ...result.accepted.map((b) => ({
            ...b,
            model: attempt ? provider.fallbackModel : provider.model,
            promptVersion: PROMPT_VERSION,
            writtenAt: new Date().toISOString(),
          })),
        );
        violations = [
          ...violations.filter((v) => !batch.some((i) => i.id === v.id)),
          ...result.failed,
        ];
        for (const f of result.failed) stats.reasons[f.reason] = (stats.reasons[f.reason] ?? 0) + 1;
        batch = batch.filter((i) => result.failed.some((v) => v.id === i.id));
      } catch (error) {
        if (
          [
            "paused_for_budget",
            "request_limit",
            "invocation_request_limit",
            "deadline",
            "lease_lost",
            "request_uncertain",
            "unknown_model_price",
          ].includes(error.code)
        )
          throw error;
        violations = [
          ...violations.filter((v) => !batch.some((i) => i.id === v.id)),
          ...batch.map((i) => ({ id: i.id, reason: error.code ?? "provider_unavailable" })),
        ];
        stats.reasons[error.code ?? "provider_unavailable"] = (stats.reasons[error.code ?? "provider_unavailable"] ?? 0) + batch.length;
      }
    }
    pending = [...pending.filter((i) => !approved.slice(start, start + 12).includes(i)), ...batch];
  }
  pending = approved.filter((i) => !accepted.some((b) => b.id === i.id));
  for (const item of pending) {
    const b = templateBlurb(item);
    const reason =
      validateVoice(b, item, {
        offLimits: context.taste.offLimits,
        tasteNames: tasteNamesOf(context.taste),
        lexicon: context.lexicon,
        derived: derivedFacts(item, context.day, context.hints?.[item.id]),
        recentOpeners: [
          ...(context.recentOpeners ?? []),
          ...accepted.filter((b) => !b.skip).map((b) => opener(b.text)),
        ],
      }) ||
      (!voiceBudget(
        [...accepted.filter((b) => !b.skip), b],
        context.history ?? [],
      )
        ? "voice_budget"
        : null);
    if (reason) stats.skipped++;
    else stats.templates++;
    accepted.push({
      ...b,
      ...(reason
        ? { skip: true, skipReason: "no_safe_template", text: "", headline: "" }
        : {}),
      model: "template",
      promptVersion: PROMPT_VERSION,
      writtenAt: new Date().toISOString(),
      fallbackReason:
        violations.find((v) => v.id === item.id)?.reason ?? "unavailable",
    });
  }
  if (context.stats) Object.assign(context.stats, stats);
  return accepted;
}
