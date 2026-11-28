/** Parsed shape of a button-template / carousel message. `contentAttributes` is a loose JSON-value
 * union in the generated schema, so everything here is parsed defensively — anything that doesn't
 * look like a template yields `null` and the bubble falls back to its plain text. */

export type TemplateButton =
  | { kind: 'url'; title: string; url: string }
  | { kind: 'phone'; title: string; phone: string }
  | { kind: 'copy-code'; title: string; code: string }
  | { kind: 'postback'; title: string };

export interface TemplateCard {
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  buttons: TemplateButton[];
}

export type ParsedTemplate =
  | { kind: 'button'; text: string | null; buttons: TemplateButton[] }
  | { kind: 'carousel'; cards: TemplateCard[] };

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function parseButton(raw: unknown): TemplateButton | null {
  if (!isRecord(raw)) return null;
  const title = str(raw.title) ?? str(raw.text) ?? str(raw.label);
  if (!title) return null;
  const type = str(raw.type);
  const url = str(raw.url);
  const phone = str(raw.phone) ?? str(raw.phoneNumber) ?? str(raw.payload);
  const code = str(raw.code) ?? str(raw.copyCode) ?? str(raw.payload);

  if (type === 'url' || type === 'web_url') {
    return url ? { kind: 'url', title, url } : null;
  }
  if (type === 'phone' || type === 'phone_number') {
    return phone ? { kind: 'phone', title, phone } : null;
  }
  if (type === 'copy-code' || type === 'copy_code') {
    return code ? { kind: 'copy-code', title, code } : null;
  }
  // Postbacks (and unknown types) are shown but not actionable on the agent side.
  return { kind: 'postback', title };
}

function parseButtons(raw: unknown): TemplateButton[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => parseButton(item) ?? []);
}

function parseCard(raw: unknown): TemplateCard | null {
  if (!isRecord(raw)) return null;
  const card: TemplateCard = {
    title: str(raw.title),
    subtitle: str(raw.subtitle),
    imageUrl: str(raw.imageUrl) ?? str(raw.image_url) ?? str(raw.image),
    buttons: parseButtons(raw.buttons),
  };
  return card.title || card.subtitle || card.imageUrl || card.buttons.length > 0 ? card : null;
}

export function parseTemplate(contentAttributes: unknown): ParsedTemplate | null {
  if (!isRecord(contentAttributes) || contentAttributes.type !== 'template') return null;
  const templateType = str(contentAttributes.templateType);

  if (templateType === 'carousel' || Array.isArray(contentAttributes.cards)) {
    const cards = Array.isArray(contentAttributes.cards)
      ? contentAttributes.cards.flatMap((item) => parseCard(item) ?? [])
      : [];
    return cards.length > 0 ? { kind: 'carousel', cards } : null;
  }

  const buttons = parseButtons(contentAttributes.buttons);
  if (buttons.length === 0) return null;
  return { kind: 'button', text: str(contentAttributes.text), buttons };
}
