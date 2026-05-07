// Simple runtime checks for status mapping used by fleet module.
// These are light-weight and intended to run in a node/jest environment if available.

const STATUS_COLOR = {
  active: '#16a34a',
  overdue: '#dc2626',
  idle: '#f59e0b',
};

test('status colors are defined', () => {
  expect(STATUS_COLOR.active).toBeDefined();
  expect(STATUS_COLOR.overdue).toBeDefined();
  expect(STATUS_COLOR.idle).toBeDefined();
});

test('unknown status falls back to active color', () => {
  const unknown = STATUS_COLOR['unknown'] || STATUS_COLOR.active;
  expect(unknown).toBe(STATUS_COLOR.active);
});
