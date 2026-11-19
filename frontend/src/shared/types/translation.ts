export type TranslationTargetLanguage = 'en' | 'de';

export function isTranslationTargetLanguage(
  value: unknown,
): value is TranslationTargetLanguage {
  return value === 'en' || value === 'de';
}
