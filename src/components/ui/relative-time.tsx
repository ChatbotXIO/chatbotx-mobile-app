import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { Text } from './text';

dayjs.extend(relativeTime);

interface RelativeTimeProps {
  date: string | Date;
  variant?: 'caption' | 'body';
}

export function RelativeTime({ date, variant = 'caption' }: RelativeTimeProps) {
  return (
    <Text variant={variant} color="secondary">
      {dayjs(date).fromNow()}
    </Text>
  );
}
