import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  AttachmentTooLargeError,
  MAX_FILE_SIZE_BYTES,
  useSendMessage,
} from '@/features/chat/api/use-send-message';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useTheme } from '@/theme/use-theme';

/** Root-level route (outside the (app) group, per the plan's route tree) with a fullScreenModal
 * presentation declared on its Stack.Screen in src/app/_layout.tsx. Captures a photo and sends it
 * directly as an attachment message on the given conversation, rather than returning to the
 * composer for a second step. */
export default function CameraScreen() {
  const { t } = useTranslation();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendMessage = useSendMessage(workspaceId ?? '', conversationId ?? '');

  if (!permission) {
    return <Screen />;
  }

  if (!permission.granted) {
    return (
      <Screen padded style={styles.centered}>
        <Text variant="body" style={styles.centered}>
          {t('chat.grantCameraPermission')}
        </Text>
        <Button label={t('chat.grantPermission')} onPress={requestPermission} />
      </Screen>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current || !workspaceId || !conversationId) return;
    setIsCapturing(true);
    setError(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) return;

      // SDK 57 replaced the legacy `getInfoAsync` API with a class-based `File` — `new
      // File(uri).size` is the current way to stat a local file (see
      // https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/). Guard BEFORE attempting to send,
      // per the plan — previously this screen relied entirely on the backend's own size rejection
      // with no client-side check at all.
      const fileSize = new File(photo.uri).size;
      if (typeof fileSize === 'number' && fileSize > MAX_FILE_SIZE_BYTES) {
        setError(t('chat.attachmentTooLarge', { fileName: 'photo.jpg' }));
        return;
      }

      await sendMessage.mutateAsync({
        workspaceId,
        conversationId,
        attachments: [
          { uri: photo.uri, mimeType: 'image/jpeg', fileName: `photo-${Date.now()}.jpg` },
        ],
      });
      router.back();
    } catch (err) {
      setError(err instanceof AttachmentTooLargeError ? err.message : t('chat.failedToSendPhoto'));
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={[styles.controls, { padding: spacing.lg }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Icon name="close" size={28} color={colors.textInverse} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chat.camera')}
          onPress={handleCapture}
          disabled={isCapturing}
          style={[styles.captureButton, { borderColor: colors.textInverse }]}
        />
      </View>
      {error ? (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: colors.danger, top: insets.top + spacing.lg },
          ]}
        >
          <Text style={{ color: colors.textInverse }}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    padding: 8,
  },
  captureButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    backgroundColor: '#ffffff',
    alignSelf: 'center',
    marginHorizontal: 'auto',
  },
  errorBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
