import { getRatingClassName } from '../../../utils/ratingClassName';
import styles from './RatingTag.module.css';

export interface RatingTagProps {
  value?: string | null;
}

export default function RatingTag({ value }: RatingTagProps) {
  if (!value) {
    return null;
  }

  const variantClass = getRatingClassName(value);

  return (
    <span
      className={[styles.tag, variantClass ? styles[variantClass] : '']
        .filter(Boolean)
        .join(' ')}
    >
      {value}
    </span>
  );
}
