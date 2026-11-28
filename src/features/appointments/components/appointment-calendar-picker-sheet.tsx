import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as WebBrowser from 'expo-web-browser';
import type { RefObject } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { SheetHeader, SheetModal } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { describeApiError } from '@/lib/describe-api-error';
import { useTheme } from '@/theme/use-theme';

import {
  type AppointmentCalendar,
  useAppointmentCalendars,
} from '../api/use-appointment-calendars';
import { useCreateBookingLink } from '../api/use-create-booking-link';

interface AppointmentCalendarPickerSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  workspaceId: string;
  conversationId: string;
}

/** Pick a calendar, then either send its booking link to the customer or open the link
 * in-app to book on their behalf. */
export function AppointmentCalendarPickerSheet({
  sheetRef,
  workspaceId,
  conversationId,
}: AppointmentCalendarPickerSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const showToast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: calendars, isLoading, error, refetch } = useAppointmentCalendars(workspaceId);
  const createLink = useCreateBookingLink(workspaceId, conversationId);

  function run(send: boolean) {
    if (!selectedId) return;
    createLink.mutate(
      { calendarId: selectedId, send },
      {
        onSuccess: (result) => {
          if (send) {
            showToast({ message: t('appointments.linkSent'), tone: 'success' });
            setSelectedId(null);
            sheetRef.current?.dismiss();
            return;
          }
          void WebBrowser.openBrowserAsync(result.url);
        },
        onError: (mutationError) => {
          showToast({ message: describeApiError(mutationError, t), tone: 'danger' });
        },
      },
    );
  }

  return (
    <SheetModal ref={sheetRef} snapPoints={['60%', '90%']} onDismiss={() => setSelectedId(null)}>
      <SheetHeader
        title={t('appointments.bookAppointment')}
        onClose={() => sheetRef.current?.dismiss()}
      />
      {error ? (
        <ErrorBanner
          message={describeApiError(error, t)}
          actionLabel={t('common.retry')}
          onAction={() => void refetch()}
        />
      ) : null}
      <BottomSheetFlatList
        data={calendars ?? []}
        keyExtractor={(calendar: AppointmentCalendar) => calendar.id}
        ListEmptyComponent={
          !isLoading && !error ? (
            <EmptyState icon="clock" title={t('appointments.noCalendars')} />
          ) : undefined
        }
        renderItem={({ item }: { item: AppointmentCalendar }) => (
          <ListItem
            title={item.name}
            subtitle={t('appointments.durationMinutes', { minutes: item.durationMinutes })}
            disabled={!item.active}
            onPress={() => setSelectedId(item.id)}
            leading={
              <Icon
                name={selectedId === item.id ? 'circle-check' : 'circle'}
                size={22}
                color={selectedId === item.id ? colors.brand : colors.textSecondary}
              />
            }
            trailing={
              !item.active ? <Badge tone="warning">{t('appointments.inactive')}</Badge> : undefined
            }
          />
        )}
      />
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <Button
          label={t('appointments.sendLink')}
          icon="send-horizontal"
          disabled={!selectedId}
          loading={createLink.isPending && createLink.variables?.send === true}
          onPress={() => run(true)}
        />
        <Button
          label={t('appointments.openLink')}
          variant="secondary"
          icon="globe"
          disabled={!selectedId}
          loading={createLink.isPending && createLink.variables?.send === false}
          onPress={() => run(false)}
        />
      </View>
    </SheetModal>
  );
}
