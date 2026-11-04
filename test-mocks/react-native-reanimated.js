const { Image, ScrollView, Text, View } = require('react-native');

const identity = (value) => value;
const makeSharedValue = (value) => ({ value });
const isSharedValue = (value) =>
  typeof value === 'object' && value !== null && Object.hasOwn(value, 'value');
const animation = {
  delay: () => animation,
  duration: () => animation,
  springify: () => animation,
};

const Animated = {
  Image,
  ScrollView,
  Text,
  View,
  addWhitelistedUIProps: () => {},
  createAnimatedComponent: identity,
};

module.exports = {
  ...Animated,
  cancelAnimation: () => {},
  default: Animated,
  isSharedValue,
  makeMutable: makeSharedValue,
  Easing: {
    ease: identity,
    in: identity,
    inOut: identity,
    linear: identity,
    out: identity,
    quad: identity,
  },
  FadeIn: animation,
  FadeInDown: animation,
  FadeInUp: animation,
  FadeOut: animation,
  FadeOutDown: animation,
  ReduceMotion: { System: 'system' },
  FadeOutUp: animation,
  interpolate: identity,
  measure: () => null,
  runOnJS: identity,
  runOnUI: identity,
  useAnimatedProps: (updater) => updater(),
  useAnimatedRef: () => ({ current: null }),
  useAnimatedStyle: (updater) => updater(),
  useDerivedValue: (updater) => makeSharedValue(updater()),
  useReducedMotion: () => false,
  useSharedValue: makeSharedValue,
  withDelay: (_delay, value) => value,
  withRepeat: (value) => value,
  withSequence: (...values) => values.at(-1),
  withTiming: (value, _config, callback) => {
    callback?.(true);
    return value;
  },
  withSpring: (value) => value,
};
