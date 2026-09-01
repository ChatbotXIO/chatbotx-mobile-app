import { Alert } from 'react-native';

interface ConfirmDestructiveOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
}

/** Shared `Alert.alert(title, message, [cancel, destructive-confirm])` shape used by every
 * destructive-action confirmation in the app (archive/unarchive, block/unblock, delete) — each
 * previously re-implemented the same two-button alert inline. */
export function confirmDestructive({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: ConfirmDestructiveOptions): void {
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
