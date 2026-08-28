import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { i18next } from '@/i18n';
import { useChatStore } from '@/features/chat/stores/use-chat-store';

/** Shape of the push `data` payload possibly carrying a `conversationId` — mirrors
 * `NotificationTapData` in notification-tap.ts (kept as a separate minimal type here since this
 * module only reads the one field it needs). */
interface NotificationConversationData {
  conversationId?: string;
}

// Foreground behavior: show banner + play sound even while the app is open, matching what the
// OS would do if the app were backgrounded — the app has no in-app "toast" for incoming messages.
// EXCEPTION: suppress the banner/list/sound entirely when the notification is about the
// conversation the user is already looking at — `useChatStore.getState()` (not a hook: this
// handler runs outside React, invoked directly by expo-notifications) reads `activeConversationId`,
// set by the chat screen's own `useFocusEffect` (see `(app)/conversations/[conversationId]/index.tsx`).
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as NotificationConversationData;
    const activeConversationId = useChatStore.getState().activeConversationId;
    const isForActiveConversation =
      Boolean(data?.conversationId) && data.conversationId === activeConversationId;

    if (isForActiveConversation) {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

const ANDROID_DEFAULT_CHANNEL_ID = 'default';

/** Android requires a notification channel to exist before any notification can display on it —
 * call once at startup. No-op on iOS/web. */
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL_ID, {
    name: i18next.t('notifications.androidChannelName'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export type PushTokenResult =
  { status: 'granted'; token: string } | { status: 'denied' | 'unsupported' };

/**
 * Requests notification permission (if not already granted) and returns an Expo push token.
 * `unsupported` covers both simulators/emulators (`Device.isDevice` is false — remote push
 * doesn't work there) and web. Requires `Constants.expoConfig.extra.eas.projectId`, which only
 * exists after `eas init` has run.
 */
export async function getPushTokenAsync(): Promise<PushTokenResult> {
  if (!Device.isDevice) {
    return { status: 'unsupported' };
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    return { status: 'denied' };
  }

  await ensureAndroidNotificationChannel();

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    throw new Error(
      'Missing extra.eas.projectId in app config — run `eas init` before requesting a push token.',
    );
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { status: 'granted', token };
}
