const RATING_CLASSES = [
  'tag--niedrig',
  'tag--mittel',
  'tag--hoch',
  'tag--gut',
  'tag--sehr-gut',
] as const;

type RatingClassName = (typeof RATING_CLASSES)[number] | 'tag--range' | '';

export function getRatingClassName(value: string): RatingClassName {
  const normalized = value.trim().toLowerCase();
  const ratingClass = `tag--${normalized}` as (typeof RATING_CLASSES)[number];
  if (RATING_CLASSES.includes(ratingClass)) {
    return ratingClass;
  }
  if (/^\d+(?:[.,]\d+)?(?:\s*[-/]\s*\d+(?:[.,]\d+)?)?$/.test(normalized)) {
    return 'tag--range';
  }
  return '';
}
