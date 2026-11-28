import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surface';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { confirmDestructive } from '@/lib/confirm-destructive';
import { describeApiError } from '@/lib/describe-api-error';
import { useTheme } from '@/theme/use-theme';

import {
  type AppointmentItem,
  type AppointmentTab,
  useContactAppointments,
} from '../api/use-contact-appointments';
import { useCancelAppointment } from '../api/use-cancel-appointment';
import { formatSlotDateTime } from '../lib/group-slots';
import { CreateAppointmentSheet } from './create-appointment-sheet';

interface AppointmentsTabProps {
  workspaceId: string | null;
  contactId: string;
  conversationId: string | null;
}

function AppointmentCard({
  appointment,
  onCancel,
}: {
  appointment: AppointmentItem;
  onCancel: (appointment: AppointmentItem) => void;
}) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const cancelled = appointment.status === 'cancelled';

  return (
    <Card padding="md">
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {appointment.calendarName}
          </Text>
          <Badge tone={cancelled ? 'danger' : 'success'}>
            {cancelled ? t('appointments.statusCancelled') : t('appointments.statusScheduled')}
          </Badge>
        </View>
        <Text variant="body" color="secondary">
          {formatSlotDateTime(appointment.startAt, appointment.inviteeTimezone, i18n.language)}
        </Text>
        <Text variant="caption" color="secondary">
          {appointment.inviteeTimezone}
        </Text>
        {appointment.cancellable ? (
          <Button
            label={t('appointments.cancel')}
            variant="danger"
            size="sm"
            onPress={() => onCancel(appointment)}
          />
        ) : null}
      </View>
    </Card>
  );
}

/** Contact-panel tab: upcoming/past appointments for the contact, cancel, and native booking. */
export function AppointmentsTab({ workspaceId, contactId, conversationId }: AppointmentsTabProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const showToast = useToast();
  const [tab, setTab] = useState<AppointmentTab>('next');
  const createSheetRef = useRef<BottomSheetModal>(null);

  const { data, isLoading, error, refetch } = useContactAppointments(workspaceId, contactId, tab);
  const cancel = useCancelAppointment(workspaceId ?? '');

  function handleCancel(appointment: AppointmentItem) {
    confirmDestructive({
      title: t('appointments.cancel'),
      message: t('appointments.cancelConfirm', { name: appointment.calendarName }),
      confirmLabel: t('appointments.cancel'),
      cancelLabel: t('common.cancel'),
      onConfirm: () =>
        cancel.mutate(appointment.id, {
          onSuccess: () => showToast({ message: t('appointments.cancelled'), tone: 'success' }),
          onError: (mutationError) =>
            showToast({ message: describeApiError(mutationError, t), tone: 'danger' }),
        }),
    });
  }

  return (
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      <Button
        label={t('appointments.newAppointment')}
        variant="tonal"
        icon="circle-plus"
        disabled={!workspaceId}
        onPress={() => createSheetRef.current?.present()}
      />
      <SegmentedTabs<AppointmentTab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'next', label: t('appointments.tabUpcoming') },
          { value: 'past', label: t('appointments.tabPast') },
        ]}
      />
      {isLoading ? <Skeleton height={96} /> : null}
      {error ? (
        <ErrorBanner
          message={describeApiError(error, t)}
          actionLabel={t('common.retry')}
          onAction={() => void refetch()}
        />
      ) : null}
      {!isLoading && !error && (data?.length ?? 0) === 0 ? (
        <EmptyState icon="clock" title={t('appointments.empty')} />
      ) : null}
      {(data ?? []).map((appointment) => (
        <AppointmentCard key={appointment.id} appointment={appointment} onCancel={handleCancel} />
      ))}
      {workspaceId ? (
        <CreateAppointmentSheet
          sheetRef={createSheetRef}
          workspaceId={workspaceId}
          contactId={contactId}
          conversationId={conversationId}
        />
      ) : null}
    </View>
  );
}
