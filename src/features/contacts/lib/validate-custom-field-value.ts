/** Field types that have a client-side format check. Others (shortText/longText/unknown) accept
 * any text. */
export type ValidatedFieldType =
  'number' | 'email' | 'phoneNumber' | 'boolean' | 'date' | 'datetime';

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s().-]{6,20}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function isParseableDate(value: string, pattern: RegExp): boolean {
  return pattern.test(value) && !Number.isNaN(Date.parse(value.replace(' ', 'T')));
}

const CHECKS: Record<ValidatedFieldType, (value: string) => boolean> = {
  number: (value) => NUMBER_PATTERN.test(value),
  email: (value) => EMAIL_PATTERN.test(value),
  phoneNumber: (value) => PHONE_PATTERN.test(value),
  boolean: (value) => value === 'true' || value === 'false',
  date: (value) => isParseableDate(value, DATE_PATTERN),
  datetime: (value) => isParseableDate(value, DATETIME_PATTERN),
};

function isValidatedType(type: string): type is ValidatedFieldType {
  return type in CHECKS;
}

/**
 * Client-side format check for a custom-field value, keyed by the catalog's `type`. Returns the
 * failing type (used as an i18n key suffix) or `null` when the value is acceptable. An empty value
 * is always valid — saving it clears the field.
 */
export function validateCustomFieldValue(type: string, value: string): ValidatedFieldType | null {
  const trimmed = value.trim();
  if (!trimmed || !isValidatedType(type)) return null;
  return CHECKS[type](trimmed) ? null : type;
}
