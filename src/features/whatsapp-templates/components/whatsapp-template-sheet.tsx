import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  BottomSheetFlatList,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { RefObject } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { ListItem } from '@/components/ui/list-item';
import { SheetHeader, SheetModal } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { describeApiError } from '@/lib/describe-api-error';
import { useTheme } from '@/theme/use-theme';

import {
  isSendable,
  type WhatsappTemplate,
  useApprovedWhatsappTemplates,
  useSendWhatsappTemplate,
  useWhatsappTemplateDetail,
} from '../api/use-whatsapp-templates';

interface WhatsappTemplateSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  workspaceId: string;
  conversationId: string;
  inboxId: string | undefined;
}

/** Window-closed WhatsApp path: pick an approved template, fill its variables, send. */
export function WhatsappTemplateSheet({
  sheetRef,
  workspaceId,
  conversationId,
  inboxId,
}: WhatsappTemplateSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const showToast = useToast();
  const [selected, setSelected] = useState<WhatsappTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const templates = useApprovedWhatsappTemplates(workspaceId, inboxId);
  const detail = useWhatsappTemplateDetail(workspaceId, selected?.id ?? null);
  const send = useSendWhatsappTemplate(workspaceId, conversationId);

  const parameters = detail.data?.parameters ?? [];
  const missingRequired = parameters.some(
    (parameter) => parameter.required && !(values[parameter.key] ?? '').trim(),
  );
  const sendable = isSendable(parameters);

  function reset() {
    setSelected(null);
    setValues({});
  }

  function handleSend() {
    if (!selected) return;
    send.mutate(
      { templateId: selected.id, templateParams: values, inboxId },
      {
        onSuccess: () => {
          showToast({ message: t('chat.templateSent'), tone: 'success' });
          sheetRef.current?.dismiss();
        },
        onError: (error) => showToast({ message: describeApiError(error, t), tone: 'danger' }),
      },
    );
  }

  return (
    <SheetModal ref={sheetRef} snapPoints={['70%', '90%']} scrollable onDismiss={reset}>
      <SheetHeader
        title={selected ? selected.name : t('chat.whatsappTemplates')}
        onClose={() => sheetRef.current?.dismiss()}
      />
      {selected ? (
        <BottomSheetScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          keyboardShouldPersistTaps="handled"
        >
          {detail.isLoading ? <Skeleton height={48} /> : null}
          {detail.error ? <ErrorBanner message={describeApiError(detail.error, t)} /> : null}
          {!sendable ? (
            <ErrorBanner message={t('chat.templateUnsupported')} tone="warning" />
          ) : null}
          {parameters.map((parameter) => (
            <View key={parameter.key} style={{ gap: spacing.xxs }}>
              <Text variant="caption" color="secondary">
                {parameter.placeholder ?? parameter.key}
              </Text>
              <BottomSheetTextInput
                value={values[parameter.key] ?? ''}
                onChangeText={(text) => setValues((prev) => ({ ...prev, [parameter.key]: text }))}
                placeholder={parameter.key}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                style={{
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  borderRadius: 8,
                  padding: 12,
                  color: colors.textPrimary,
                }}
              />
            </View>
          ))}
          <Button
            label={t('chat.send')}
            icon="send-horizontal"
            disabled={detail.isLoading || !sendable || missingRequired}
            loading={send.isPending}
            onPress={handleSend}
          />
          <Button label={t('common.cancel')} variant="ghost" onPress={reset} />
        </BottomSheetScrollView>
      ) : (
        <BottomSheetFlatList
          data={templates.data ?? []}
          keyExtractor={(template: WhatsappTemplate) => template.id}
          ListEmptyComponent={
            templates.error ? (
              <ErrorBanner message={describeApiError(templates.error, t)} />
            ) : !templates.isLoading ? (
              <EmptyState icon="message-square-text" title={t('chat.noWhatsappTemplates')} />
            ) : undefined
          }
          renderItem={({ item }: { item: WhatsappTemplate }) => (
            <ListItem
              title={item.name}
              subtitle={item.language}
              showChevron
              onPress={() => setSelected(item)}
            />
          )}
        />
      )}
    </SheetModal>
  );
}
