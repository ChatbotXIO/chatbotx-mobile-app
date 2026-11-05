const { forwardRef, useImperativeHandle } = require('react');

module.exports = forwardRef(function ReanimatedSwipeable({ children }, ref) {
  useImperativeHandle(ref, () => ({ close: () => {}, openLeft: () => {}, openRight: () => {} }));
  return children;
});
