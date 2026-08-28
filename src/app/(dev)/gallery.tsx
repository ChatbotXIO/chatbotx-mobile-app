import { Redirect } from 'expo-router';

/**
 * Dev-build-only "storybook-lite" route — see `src/dev/gallery-content.tsx` for the actual
 * screen. That module is `require()`d lazily, inside the `__DEV__` branch, rather than imported
 * statically at the top of this file: its 24 UI-primitive imports would otherwise ship in every
 * production bundle even though the screen itself redirects away immediately outside `__DEV__`.
 * The route file itself stays registered unconditionally so expo-router's typed routes keep
 * resolving `/gallery` in every build.
 */
export default function GalleryScreen() {
  if (!__DEV__) {
    return <Redirect href="/(app)/(tabs)/conversations" />;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentionally lazy, see above
  const { GalleryContent } = require('@/dev/gallery-content');
  return <GalleryContent />;
}
