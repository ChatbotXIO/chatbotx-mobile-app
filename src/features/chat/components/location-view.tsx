import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Message } from '@/features/chat/api/use-messages-infinite';
import { useTheme } from '@/theme/use-theme';

interface LocationViewProps {
  contentAttributes: Message['contentAttributes'];
  outbound: boolean;
}

/** `contentAttributes` is typed as a loose JSON-value union in the generated schema (no dedicated
 * location shape) — this narrows defensively rather than assuming `{ lat, lng }` exist. Renders a
 * static "location shared" indicator with coordinates when parseable, since embedding a map view
 * is out of scope for this phase. */
function parseLatLng(
  contentAttributes: Message['contentAttributes'],
): { lat: number; lng: number } | null {
  if (
    !contentAttributes ||
    typeof contentAttributes !== 'object' ||
    Array.isArray(contentAttributes)
  ) {
    return null;
  }
  const record = contentAttributes as Record<string, unknown>;
  const lat = record.lat ?? record.latitude;
  const lng = record.lng ?? record.longitude;
  if (typeof lat === 'number' && typeof lng === 'number') {
    return { lat, lng };
  }
  return null;
}

export function LocationView({ contentAttributes, outbound }: LocationViewProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const coords = parseLatLng(contentAttributes);
  const textColor = outbound ? colors.bubbleOutText : colors.bubbleInText;

  return (
    <View style={[styles.row, { gap: spacing.xs }]}>
      <Icon name="map-pin" size={18} color={textColor} />
      <Text variant="caption" style={{ color: textColor }}>
        {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : t('chat.locationShared')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
