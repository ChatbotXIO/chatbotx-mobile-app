import dayjs from 'dayjs';

import { setDayjsLocale } from '@/i18n/dayjs-locales';

afterEach(() => {
  dayjs.locale('en');
});

describe('setDayjsLocale', () => {
  it('maps pt-BR to the pt-br dayjs locale', () => {
    setDayjsLocale('pt-BR');
    expect(dayjs.locale()).toBe('pt-br');
  });

  it('maps pt-PT to the pt dayjs locale (dayjs has no distinct pt-pt)', () => {
    setDayjsLocale('pt-PT');
    expect(dayjs.locale()).toBe('pt');
  });

  it('maps zh-CN and zh-TW to their lowercase dayjs equivalents', () => {
    setDayjsLocale('zh-CN');
    expect(dayjs.locale()).toBe('zh-cn');
    setDayjsLocale('zh-TW');
    expect(dayjs.locale()).toBe('zh-tw');
  });

  it('maps a simple language like vi to its identity lowercase locale', () => {
    setDayjsLocale('vi');
    expect(dayjs.locale()).toBe('vi');
  });
});
