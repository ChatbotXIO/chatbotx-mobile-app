import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribeNoop = () => () => undefined;

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * useSyncExternalStore's getServerSnapshot returns a fixed value during SSR/hydration, then the
 * client snapshot takes over post-hydration without triggering the cascading-render pattern that
 * an effect-based setState would.
 */
function useHasHydrated() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export function useColorScheme() {
  const hasHydrated = useHasHydrated();
  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
