import assert from 'node:assert/strict';
const canReserve = ({capacity, reserved, requested}) => Number.isInteger(requested) && requested > 0 && reserved + requested <= capacity;
assert.equal(canReserve({capacity:12,reserved:10,requested:2}), true);
assert.equal(canReserve({capacity:12,reserved:11,requested:2}), false);
assert.equal(canReserve({capacity:12,reserved:0,requested:0}), false);
console.log('Booking capacity validation passed.');
