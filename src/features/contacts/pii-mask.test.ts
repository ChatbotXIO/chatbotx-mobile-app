import { maskEmail, maskPhone } from '@/features/contacts/pii-mask';

describe('maskEmail', () => {
  it('keeps the first 2 local-part chars and the full domain', () => {
    expect(maskEmail('johndoe@example.com')).toBe('jo*****@example.com');
  });

  it('returns *** when there is no domain', () => {
    expect(maskEmail('notanemail')).toBe('***');
  });

  it('pads short local parts to at least 3 asterisks', () => {
    expect(maskEmail('ab@example.com')).toBe('ab***@example.com');
  });
});

describe('maskPhone', () => {
  it('keeps only the last 2 digits visible', () => {
    expect(maskPhone('+15551234567')).toBe('**********67');
  });

  it('masks the whole string when there are 2 or fewer digits', () => {
    expect(maskPhone('12')).toBe('**');
  });

  it('strips non-digit characters before counting the last 2 visible digits', () => {
    expect(maskPhone('(555) 123-4567')).toBe('************67');
  });
});
