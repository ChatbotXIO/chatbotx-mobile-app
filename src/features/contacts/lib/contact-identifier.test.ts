import { toContactIdentifier } from './contact-identifier';

describe('toContactIdentifier', () => {
  it('prefixes a database id with "id:"', () => {
    expect(toContactIdentifier('123')).toBe('id:123');
  });
});
