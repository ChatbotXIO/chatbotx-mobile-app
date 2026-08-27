import type BottomSheet from '@gorhom/bottom-sheet';
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, Surface } from '@/components/ui/surface';
import { Chip } from '@/components/ui/chip';
import { ConnectionBanner, type ConnectionState } from '@/components/ui/connection-banner';
import { CountPill } from '@/components/ui/count-pill';
import { DateSeparator } from '@/components/ui/date-separator';
import { Divider } from '@/components/ui/divider';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { IconButton } from '@/components/ui/icon-button';
import { ListFooterSpinner } from '@/components/ui/list-footer-spinner';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SearchBar } from '@/components/ui/search-bar';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Sheet, SheetHeader } from '@/components/ui/sheet';
import { Skeleton, SkeletonRow } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useToast } from '@/components/ui/toast';
import { useSettingsStore } from '@/stores/use-settings-store';
import { useTheme } from '@/theme/use-theme';

/**
 * Visual smoke-test surface for every Phase 2 UI primitive, in various states, with a light/dark
 * toggle. Not a polished screen — the "storybook-lite" the plan asks for. Dev-build only: renders
 * a redirect in production builds instead of registering a no-op empty screen, so the route
 * still resolves (typed-routes stays happy) but is inert outside `__DEV__`.
 */
export default function GalleryScreen() {
  if (!__DEV__) {
    return <Redirect href="/(app)/(tabs)/conversations" />;
  }

  return <GalleryContent />;
}

function GalleryContent() {
  const { colors, spacing } = useTheme();
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);
  const showToast = useToast();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'unread' | 'bot'>('all');
  const [chipSelected, setChipSelected] = useState(true);
  const [toggleValue, setToggleValue] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>('offline');
  const sheetRef = useRef<BottomSheet>(null);
  // Lazy-init so `Date.now()` runs once (at first render) instead of being called fresh on every
  // render, which the react-compiler lint rule flags as an impure render-time call.
  const [{ todayIso, yesterdayIso }] = useState(() => {
    const now = Date.now();
    return {
      todayIso: new Date(now).toISOString(),
      yesterdayIso: new Date(now - 86400000).toISOString(),
    };
  });

  function toggleScheme() {
    setThemePreference(themePreference === 'dark' ? 'light' : 'dark');
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
        <ScreenHeader
          title="UI Gallery"
          subtitle="Dev-only primitive smoke test"
          trailing={
            <IconButton
              accessibilityLabel="Toggle color scheme"
              icon={themePreference === 'dark' ? 'sunny-outline' : 'moon-outline'}
              variant="tonal"
              onPress={toggleScheme}
            />
          }
        />

        <Section title="Text">
          <Text variant="display">Display</Text>
          <Text variant="heading">Heading</Text>
          <Text variant="title">Title</Text>
          <Text variant="subtitle">Subtitle</Text>
          <Text variant="body">Body text</Text>
          <Text variant="bodyStrong">Body strong</Text>
          <Text variant="callout">Callout</Text>
          <Text variant="caption" color="secondary">
            Caption secondary
          </Text>
          <Text variant="label">Label</Text>
          <Text variant="micro" numeric>
            123,456
          </Text>
        </Section>

        <Section title="Buttons">
          <View style={styles.row}>
            <Button label="Primary" onPress={() => {}} />
            <Button label="Tonal" variant="tonal" onPress={() => {}} />
            <Button label="Secondary" variant="secondary" onPress={() => {}} />
          </View>
          <View style={styles.row}>
            <Button label="Danger" variant="danger" onPress={() => {}} />
            <Button label="Ghost" variant="ghost" onPress={() => {}} />
            <Button label="Icon" icon="send" onPress={() => {}} />
          </View>
          <View style={styles.row}>
            <Button label="Small" size="sm" onPress={() => {}} />
            <Button label="Loading" loading onPress={() => {}} />
            <Button label="Disabled" disabled onPress={() => {}} />
          </View>
        </Section>

        <Section title="IconButton">
          <View style={styles.row}>
            <IconButton
              accessibilityLabel="Ghost"
              icon="heart-outline"
              variant="ghost"
              onPress={() => {}}
            />
            <IconButton
              accessibilityLabel="Tonal"
              icon="heart-outline"
              variant="tonal"
              onPress={() => {}}
            />
            <IconButton
              accessibilityLabel="Filled"
              icon="heart-outline"
              variant="filled"
              onPress={() => {}}
            />
            <IconButton
              accessibilityLabel="Outline"
              icon="heart-outline"
              variant="outline"
              onPress={() => {}}
            />
            <IconButton
              accessibilityLabel="Badged"
              icon="notifications-outline"
              badgeCount={5}
              onPress={() => {}}
            />
            <IconButton accessibilityLabel="Loading" icon="send" loading onPress={() => {}} />
          </View>
        </Section>

        <Section title="Avatar">
          <View style={styles.row}>
            <Avatar name="Ada Lovelace" size={40} />
            <Avatar name="Grace Hopper" size={52} ring="online" />
            <Avatar name="Bot Assistant" size={52} ring="bot" />
            <Avatar name="Margaret Hamilton" size={52} badge={<Badge tone="success" count={3} />} />
          </View>
        </Section>

        <Section title="Chip">
          <View style={styles.row}>
            <Chip label="All" selected={tab === 'all'} onPress={() => setTab('all')} />
            <Chip label="Unread" selected={tab === 'unread'} onPress={() => setTab('unread')} />
            <Chip
              label="Bot"
              tone="custom"
              color={colors.bubbleBotAccent}
              selected={chipSelected}
              onPress={() => setChipSelected((prev) => !prev)}
            />
            <Chip label="VIP" onRemove={() => {}} />
          </View>
        </Section>

        <Section title="Badge / CountPill">
          <View style={styles.row}>
            <Badge tone="brand">New</Badge>
            <Badge tone="danger" count={12} />
            <CountPill count={4} />
            <CountPill count={230} tone="danger" />
          </View>
        </Section>

        <Section title="Surface / Card">
          <Surface level={1} radius="md" padding="md" bordered>
            <Text variant="body">Surface level 1</Text>
          </Surface>
          <Card padding="md" elevation={2}>
            <Text variant="body">Card (level 1, bordered, elevation 2)</Text>
          </Card>
        </Section>

        <Section title="SearchBar / SegmentedTabs">
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search…" />
          <SegmentedTabs
            options={[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
              { value: 'bot', label: 'Bot' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </Section>

        <Section title="ListItem">
          <Card padding="xxs">
            <ListItem
              title="Standard row"
              subtitle="With a subtitle"
              showChevron
              onPress={() => {}}
            />
            <Divider inset />
            <ListItem title="Row with value" value="Enabled" onPress={() => {}} />
            <Divider inset />
            <ListItem title="Destructive row" destructive onPress={() => {}} />
            <Divider inset />
            <ListItem title="Disabled row" disabled onPress={() => {}} />
          </Card>
        </Section>

        <Section title="ToggleRow">
          <Card padding="xxs">
            <ToggleRow
              label="Push notifications"
              description="Get notified about new messages"
              value={toggleValue}
              onValueChange={setToggleValue}
            />
          </Card>
        </Section>

        <Section title="ErrorBanner">
          <ErrorBanner
            tone="danger"
            message="Failed to send message."
            actionLabel="Retry"
            onAction={() => {}}
          />
          <ErrorBanner tone="warning" message="This workspace is near its plan limit." />
          <ErrorBanner tone="info" message="You're viewing a read-only flow." />
        </Section>

        <Section title="EmptyState">
          <View style={{ height: 220 }}>
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="No conversations"
              description="New conversations will show up here."
              action={{ label: 'Clear filters', onPress: () => {} }}
            />
          </View>
        </Section>

        <Section title="Skeleton">
          <SkeletonRow.Conversation />
          <SkeletonRow.Contact />
          <SkeletonRow.Message align="start" />
          <SkeletonRow.Message align="end" />
          <Skeleton width="80%" height={14} />
        </Section>

        <Section title="ListFooterSpinner">
          <Card padding="xxs">
            <ListFooterSpinner visible />
          </Card>
        </Section>

        <Section title="DateSeparator">
          <DateSeparator date={todayIso} />
          <DateSeparator date={yesterdayIso} />
        </Section>

        <Section title="ConnectionBanner">
          <ConnectionBanner state={connectionState} />
          <View style={styles.row}>
            {(['online', 'connecting', 'reconnecting', 'offline'] as ConnectionState[]).map(
              (state) => (
                <Button
                  key={state}
                  label={state}
                  size="sm"
                  variant="secondary"
                  onPress={() => setConnectionState(state)}
                />
              ),
            )}
          </View>
        </Section>

        <Section title="Toast">
          <Button
            label="Show toast"
            variant="tonal"
            onPress={() =>
              showToast({
                message: 'Message sent',
                tone: 'success',
                action: { label: 'Undo', onPress: () => {} },
              })
            }
          />
        </Section>

        <Section title="Sheet">
          <Button
            label="Open sheet"
            variant="secondary"
            onPress={() => sheetRef.current?.expand()}
          />
        </Section>

        <Section title="Fake conversation row">
          <Card padding="md">
            <View style={[styles.row, { alignItems: 'flex-start', gap: spacing.sm }]}>
              <Avatar name="Jane Doe" size={52} ring="online" />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    Jane Doe
                  </Text>
                  <Text variant="micro" color="tertiary" numeric>
                    2m
                  </Text>
                </View>
                <Text variant="callout" color="secondary" numberOfLines={1}>
                  Thanks for the quick reply! Let me check with the team.
                </Text>
                <View style={styles.row}>
                  <Chip
                    label="Bot handling"
                    size="sm"
                    tone="custom"
                    color={colors.bubbleBotAccent}
                  />
                  <CountPill count={2} />
                </View>
              </View>
            </View>
          </Card>
        </Section>

        <Section title="Fake message bubble group">
          <View style={{ gap: 4 }}>
            <View style={[styles.row, { justifyContent: 'flex-start' }]}>
              <View
                style={{
                  backgroundColor: colors.bubbleIn,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  maxWidth: '75%',
                }}
              >
                <Text variant="body" style={{ color: colors.bubbleInText }}>
                  Hey, is my order still on track?
                </Text>
              </View>
            </View>
            <View style={[styles.row, { justifyContent: 'flex-end' }]}>
              <View
                style={{
                  backgroundColor: colors.bubbleOut,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  maxWidth: '75%',
                }}
              >
                <Text variant="body" style={{ color: colors.bubbleOutText }}>
                  Yes! It shipped this morning.
                </Text>
              </View>
            </View>
            <View style={[styles.row, { justifyContent: 'flex-start' }]}>
              <View
                style={{
                  backgroundColor: colors.bubbleBot,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  maxWidth: '75%',
                }}
              >
                <Text variant="body" style={{ color: colors.bubbleBotText }}>
                  Automated: your tracking link has been sent by email.
                </Text>
              </View>
            </View>
          </View>
        </Section>
      </ScrollView>

      <Sheet ref={sheetRef} snapPoints={['40%']}>
        <SheetHeader title="Example sheet" onClose={() => sheetRef.current?.close()} />
        <View style={{ padding: spacing.md }}>
          <Text variant="body" color="secondary">
            This is a Sheet body, rendered via BottomSheetView.
          </Text>
        </View>
      </Sheet>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" color="tertiary">
        {title}
      </Text>
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
});
