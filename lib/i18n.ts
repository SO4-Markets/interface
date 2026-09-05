export const i18nConfig = {
  defaultLocale: 'en',
  locales: ['en', 'test-loc'], // 'test-loc' functions as our throwaway proof mechanical locale requested in the spec
};

export function getLocaleFromPath(pathname: string): { locale: string; cleanPath: string } {
  const segments = pathname.split('/');
  const possibleLocale = segments[1];

  if (i18nConfig.locales.includes(possibleLocale) && possibleLocale !== i18nConfig.defaultLocale) {
    return {
      locale: possibleLocale,
      cleanPath: '/' + segments.slice(2).join('/'),
    };
  }

  return {
    locale: i18nConfig.defaultLocale,
    cleanPath: pathname,
  };
}
