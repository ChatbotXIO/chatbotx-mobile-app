const schedule = (callback, ...args) => callback?.(...args);

module.exports = {
  createWorkletRuntime: () => ({}),
  isWorkletRuntime: () => false,
  runOnJS: schedule,
  runOnRuntime: schedule,
  runOnUI: schedule,
  scheduleOnRN: schedule,
  scheduleOnUI: schedule,
};
