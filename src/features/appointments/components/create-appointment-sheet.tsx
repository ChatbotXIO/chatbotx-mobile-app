import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { RefObject } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { SectionHeader } from '@/components/ui/section-header';
import { SheetHeader, SheetModal } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { describeApiError } from '@/lib/describe-api-error';
import { useTheme } from '@/theme/use-theme';

import { useAppointmentCalendars } from '../api/use-appointment-calendars';
import { useBookAppointment } from '../api/use-book-appointment';
import { useCalendarAvailability } from '../api/use-calendar-availability';
import {
  formatSlotDateTime,
  formatSlotTime,
  groupSlotsByDay,
  isValidTimeZone,
  type Slot,
} from '../lib/group-slots';

interface CreateAppointmentSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  workspaceId: string;
  contactId: string;
  /** Without a conversation the booking is created silently — the customer isn't notified. */
  conversationId: string | null;
}

function deviceTimeZone(): string | null {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && isValidTimeZone(zone) ? zone : null;
}

/** Native booking flow: calendar → timezone → day → time → confirm. */
export function CreateAppointmentSheet({
  sheetRef,
  workspaceId,
  contactId,
  conversationId,
}: CreateAppointmentSheetProps) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const showToast = useToast();

  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [timezoneChoice, setTimezoneChoice] = useState<'calendar' | 'device'>('calendar');
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);

  const calendars = useAppointmentCalendars(workspaceId);
  const { calendar, slots } = useCalendarAvailability(workspaceId, calendarId, contactId);
  const book = useBookAppointment(workspaceId);

  const device = deviceTimeZone();
  const calendarZone = calendar?.timezone ?? 'UTC';
  const zone = timezoneChoice === 'device' && device ? device : calendarZone;

  const days = useMemo(() => groupSlotsByDay(slots.data ?? [], zone), [slots.data, zone]);
  const selectedDay = days.find((day) => day.dateKey === dateKey) ?? null;

  function reset() {
    setCalendarId(null);
    setTimezoneChoice('calendar');
    setDateKey(null);
    setSlot(null);
  }

  function selectCalendar(id: string) {
    setCalendarId(id);
    setDateKey(null);
    setSlot(null);
  }

  function selectTimezone(choice: 'calendar' | 'device') {
    setTimezoneChoice(choice);
    // Day boundaries move with the timezone, so the chosen day/time no longer applies.
    setDateKey(null);
    setSlot(null);
  }

  function handleBook() {
    if (!calendarId || !slot) return;
    book.mutate(
      {
        calendarId,
        contactId,
        conversationId,
        startAt: slot.startAt,
        inviteeTimezone: zone,
      },
      {
        onSuccess: () => {
          showToast({ message: t('appointments.booked'), tone: 'success' });
          sheetRef.current?.dismiss();
        },
        onError: () => {
          // Slot taken / availability changed / contact double-booked: the list on screen is stale.
          setSlot(null);
          showToast({ message: t('appointments.slotUnavailable'), tone: 'danger' });
          void slots.refetch();
        },
      },
    );
  }

  const activeCalendars = (calendars.data ?? []).filter((item) => item.active);

  return (
    <SheetModal ref={sheetRef} snapPoints={['85%']} scrollable onDismiss={reset}>
      <SheetHeader
        title={t('appointments.newAppointment')}
        onClose={() => sheetRef.current?.dismiss()}
      />
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {!conversationId ? (
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
            <ErrorBanner message={t('appointments.noConversationNotice')} tone="warning" />
          </View>
        ) : null}

        <SectionHeader title={t('appointments.stepCalendar')} />
        {calendars.error ? (
          <ErrorBanner
            message={describeApiError(calendars.error, t)}
            actionLabel={t('common.retry')}
            onAction={() => void calendars.refetch()}
          />
        ) : activeCalendars.length === 0 && !calendars.isLoading ? (
          <EmptyState icon="clock" title={t('appointments.noCalendars')} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={rowStyle(spacing)}
          >
            {activeCalendars.map((item) => (
              <Chip
                key={item.id}
                label={item.name}
                selected={item.id === calendarId}
                onPress={() => selectCalendar(item.id)}
              />
            ))}
          </ScrollView>
        )}

        {calendarId ? (
          <>
            <SectionHeader title={t('appointments.stepTimezone')} />
            <View style={rowStyle(spacing)}>
              <Chip
                label={t('appointments.calendarTimezone', { zone: calendarZone })}
                selected={timezoneChoice === 'calendar'}
                onPress={() => selectTimezone('calendar')}
              />
              {device && device !== calendarZone ? (
                <Chip
                  label={t('appointments.deviceTimezone', { zone: device })}
                  selected={timezoneChoice === 'device'}
                  onPress={() => selectTimezone('device')}
                />
              ) : null}
            </View>

            <SectionHeader title={t('appointments.stepDay')} />
            {slots.isLoading || slots.isFetching ? (
              <View style={{ paddingHorizontal: spacing.md }}>
                <Skeleton height={36} />
              </View>
            ) : slots.error ? (
              <ErrorBanner
                message={describeApiError(slots.error, t)}
                actionLabel={t('common.retry')}
                onAction={() => void slots.refetch()}
              />
            ) : days.length === 0 ? (
              <EmptyState icon="clock" title={t('appointments.noSlots')} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={rowStyle(spacing)}
              >
                {days.map((day) => (
                  <Chip
                    key={day.dateKey}
                    label={formatDayLabel(day.dateKey, i18n.language)}
                    selected={day.dateKey === dateKey}
                    onPress={() => {
                      setDateKey(day.dateKey);
                      setSlot(null);
                    }}
                  />
                ))}
              </ScrollView>
            )}

            {selectedDay ? (
              <>
                <SectionHeader title={t('appointments.stepTime')} />
                <View style={[rowStyle(spacing), { flexWrap: 'wrap' }]}>
                  {selectedDay.slots.map((item) => (
                    <Chip
                      key={item.startAt}
                      label={formatSlotTime(item.startAt, zone, i18n.language)}
                      selected={slot?.startAt === item.startAt}
                      onPress={() => setSlot(item)}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}

        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          {slot ? (
            <Text variant="bodyStrong">
              {t('appointments.selectedSlot', {
                time: formatSlotDateTime(slot.startAt, zone, i18n.language),
              })}
            </Text>
          ) : null}
          <Button
            label={t('appointments.create')}
            disabled={!slot}
            loading={book.isPending}
            onPress={handleBook}
          />
        </View>
      </BottomSheetScrollView>
    </SheetModal>
  );
}

function rowStyle(spacing: { md: number; xs: number }) {
  return { flexDirection: 'row' as const, gap: spacing.xs, paddingHorizontal: spacing.md };
}

/** `YYYY-MM-DD` → localized weekday + day, built from the key's own calendar date (UTC noon keeps
 * it from drifting across a day boundary in the viewer's zone). */
function formatDayLabel(dateKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dateKey}T12:00:00Z`));
}
