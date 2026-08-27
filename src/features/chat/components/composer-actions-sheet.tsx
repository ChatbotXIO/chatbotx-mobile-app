import type BottomSheet from '@gorhom/bottom-sheet';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ListItem } from '@/components/ui/list-item';
import { Sheet, SheetHeader } from '@/components/ui/sheet';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/theme/use-theme';

interface ComposerActionsSheetProps {
  onClose: () => void;
  onCamera: () => void;
  onPhotoLibrary: () => void;
  onDocument: () => void;
  onSendFlow: () => void;
  onSavedReplies: () => void;
  /** Omitted entirely (not just disabled) when the sequences feature isn't available yet — see
   * the TODO in composer.tsx for why this is optional rather than always-present-but-gated. */
  onSendSequence?: () => void;
}

/** "[+]" composer action sheet: camera, photo library (multi-select), document, send flow, send
 * sequence (feature-gated — see composer.tsx), saved replies. */
export const ComposerActionsSheet = forwardRef<BottomSheet, ComposerActionsSheetProps>(
  function ComposerActionsSheet(
    { onClose, onCamera, onPhotoLibrary, onDocument, onSendFlow, onSavedReplies, onSendSequence },
    ref,
  ) {
    const { t } = useTranslation();
    const { colors } = useTheme();

    return (
      <Sheet ref={ref} snapPoints={['50%']} onDismiss={onClose}>
        <SheetHeader title={t('chat.attach')} onClose={onClose} />
        <ListItem
          title={t('chat.camera')}
          leading={<Icon name="camera" size={22} color={colors.textSecondary} />}
          onPress={onCamera}
        />
        <ListItem
          title={t('chat.photoLibrary')}
          leading={<Icon name="image" size={22} color={colors.textSecondary} />}
          onPress={onPhotoLibrary}
        />
        <ListItem
          title={t('chat.document')}
          leading={<Icon name="document-attach" size={22} color={colors.textSecondary} />}
          onPress={onDocument}
        />
        <ListItem
          title={t('chat.sendFlow')}
          leading={<Icon name="git-branch" size={22} color={colors.textSecondary} />}
          onPress={onSendFlow}
        />
        {onSendSequence ? (
          <ListItem
            title={t('chat.sendSequence')}
            leading={<Icon name="layers" size={22} color={colors.textSecondary} />}
            onPress={onSendSequence}
          />
        ) : null}
        <ListItem
          title={t('chat.savedReplies')}
          leading={<Icon name="flash" size={22} color={colors.textSecondary} />}
          onPress={onSavedReplies}
        />
      </Sheet>
    );
  },
);
