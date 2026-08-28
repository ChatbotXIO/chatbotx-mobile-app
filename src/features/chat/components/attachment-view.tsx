import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/surface';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Message } from '@/features/chat/api/use-messages-infinite';
import { useChatStore } from '@/features/chat/stores/use-chat-store';
import { useTheme } from '@/theme/use-theme';

interface AttachmentViewProps {
  attachments: Message['attachments'];
  outbound: boolean;
  /** clientId of the parent message, for looking up in-flight upload progress. Undefined for a
   * confirmed (non-optimistic) message, which never has progress to show. */
  clientId?: string;
}

const MAX_WIDTH = 240;
const FALLBACK_ASPECT_RATIO = 4 / 3;

function aspectRatioFor(attachment: Message['attachments'][number]): number {
  if (attachment.width && attachment.height && attachment.height > 0) {
    return attachment.width / attachment.height;
  }
  return FALLBACK_ASPECT_RATIO;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function fileIcon(fileType: string): 'videocam' | 'musical-notes' | 'image' | 'document' {
  switch (fileType) {
    case 'video':
      return 'videocam';
    case 'audio':
      return 'musical-notes';
    case 'gif':
      return 'image';
    default:
      return 'document';
  }
}

function UploadProgressOverlay({ ratio }: { ratio: number }) {
  const { colors } = useTheme();
  const percent = Math.round(ratio * 100);

  return (
    <View style={[styles.progressOverlay, { backgroundColor: colors.scrim }]} pointerEvents="none">
      <Text variant="caption" color="inverse" style={styles.progressLabel}>
        {`${percent}%`}
      </Text>
    </View>
  );
}

function ImageAttachment({
  attachment,
  width,
  progress,
}: {
  attachment: Message['attachments'][number];
  width: number;
  progress: number | undefined;
}) {
  const { radius } = useTheme();
  const ratio = aspectRatioFor(attachment);
  const height = width / ratio;

  return (
    <Pressable
      onPress={() =>
        attachment.url &&
        router.push({ pathname: '/image-viewer', params: { url: attachment.url } })
      }
      style={styles.imageWrap}
    >
      <Image
        source={{ uri: attachment.url ?? undefined }}
        style={{ width, height, borderRadius: radius.md }}
        contentFit="cover"
      />
      {typeof progress === 'number' && progress < 1 ? (
        <UploadProgressOverlay ratio={progress} />
      ) : null}
    </Pressable>
  );
}

/** Renders a message's attachments: a single full-width image, a 2-column grid for multiple
 * images, and non-image files as a `Card` row (icon tile + name + size). In-flight upload
 * progress (keyed by the parent message's clientId) overlays image attachments as a percentage —
 * file-row attachments don't have room for a ring/bar, so progress is implicit there via the
 * optimistic pending state on the bubble itself. */
export function AttachmentView({ attachments, outbound, clientId }: AttachmentViewProps) {
  const { colors, spacing } = useTheme();
  const progress = useChatStore((state) =>
    clientId ? state.uploadProgressByClientId[clientId] : undefined,
  );

  const images = attachments.filter(
    (attachment) => attachment.fileType === 'image' && attachment.url,
  );
  const files = attachments.filter(
    (attachment) => !(attachment.fileType === 'image' && attachment.url),
  );

  const isGrid = images.length > 1;
  const imageWidth = isGrid ? (MAX_WIDTH - spacing.xs) / 2 : MAX_WIDTH;

  return (
    <View style={{ gap: spacing.xs }}>
      {images.length > 0 ? (
        <View style={[isGrid ? styles.grid : undefined, isGrid ? { gap: spacing.xs } : undefined]}>
          {images.map((attachment) => (
            <ImageAttachment
              key={attachment.id}
              attachment={attachment}
              width={imageWidth}
              progress={progress}
            />
          ))}
        </View>
      ) : null}

      {files.map((attachment) => {
        const textColor = outbound ? colors.bubbleOutText : colors.bubbleInText;
        return (
          <Card
            key={attachment.id}
            radius="sm"
            padding="xs"
            style={[styles.fileRow, { gap: spacing.xs }]}
          >
            <View style={[styles.fileIconTile, { backgroundColor: colors.surface0 }]}>
              <Icon name={fileIcon(attachment.fileType)} size={20} color={textColor} />
            </View>
            <View style={styles.fileMeta}>
              <Text variant="caption" numberOfLines={1} style={{ color: textColor }}>
                {attachment.name ?? attachment.fileType}
              </Text>
              {attachment.size ? (
                <Text variant="micro" style={{ color: textColor, opacity: 0.7 }}>
                  {formatBytes(attachment.size)}
                </Text>
              ) : null}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  imageWrap: {
    position: 'relative',
  },
  progressOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  progressLabel: {
    fontWeight: '700',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconTile: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileMeta: {
    flex: 1,
    gap: 2,
  },
});
