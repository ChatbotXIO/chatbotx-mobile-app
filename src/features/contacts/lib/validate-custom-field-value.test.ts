import { validateCustomFieldValue } from './validate-custom-field-value';

describe('validateCustomFieldValue', () => {
  it('accepts any text for text-like types', () => {
    expect(validateCustomFieldValue('shortText', 'Dfgdfg df')).toBeNull();
    expect(validateCustomFieldValue('longText', 'anything')).toBeNull();
    expect(validateCustomFieldValue('unknownType', 'anything')).toBeNull();
  });

  it('accepts an empty value for every type (it clears the field)', () => {
    for (const type of ['number', 'email', 'phoneNumber', 'date', 'datetime', 'boolean']) {
      expect(validateCustomFieldValue(type, '')).toBeNull();
    }
  });

  it('rejects non-numeric values for number fields', () => {
    expect(validateCustomFieldValue('number', 'abc')).toBe('number');
    expect(validateCustomFieldValue('number', '12abc')).toBe('number');
    expect(validateCustomFieldValue('number', '42')).toBeNull();
    expect(validateCustomFieldValue('number', '-3.5')).toBeNull();
  });

  it('validates email shape', () => {
    expect(validateCustomFieldValue('email', 'not-an-email')).toBe('email');
    expect(validateCustomFieldValue('email', 'a@b.co')).toBeNull();
  });

  it('validates phone numbers', () => {
    expect(validateCustomFieldValue('phoneNumber', 'call me')).toBe('phoneNumber');
    expect(validateCustomFieldValue('phoneNumber', '+84 912 345 678')).toBeNull();
  });

  it('validates boolean literals', () => {
    expect(validateCustomFieldValue('boolean', 'maybe')).toBe('boolean');
    expect(validateCustomFieldValue('boolean', 'true')).toBeNull();
    expect(validateCustomFieldValue('boolean', 'false')).toBeNull();
  });

  it('validates date and datetime values', () => {
    expect(validateCustomFieldValue('date', 'yesterday')).toBe('date');
    expect(validateCustomFieldValue('date', '2026-11-07')).toBeNull();
    expect(validateCustomFieldValue('datetime', '2026-11-07T10:30')).toBeNull();
    expect(validateCustomFieldValue('datetime', 'soon')).toBe('datetime');
  });
});
