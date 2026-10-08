const Order = require('./models');

const _orders = new Map();
const _byKey = new Map();
let _nextId = 1;

function create(studentId, itemId, qty, paymentMethodId, status, key = null) {
    const o = new Order(_nextId, studentId, itemId, qty, paymentMethodId, status, key);
    _orders.set(o.id, o);
    if (key) _byKey.set(key, o.id);
    _nextId++;
    return o;
}

function find(oid) { return _orders.get(oid) || null; }
function findByKey(key) {
    const id = _byKey.get(key);
    return id ? _orders.get(id) : null;
}
function findByStudent(studentId) {
    return Array.from(_orders.values()).filter(o => o.studentId === studentId);
}

// A2: DELETE must actually delete — returning 204 while the order still
// exists would be a status that lies about the result. Also drops any
// Idempotency-Key that pointed at the order so no key dangles.
function remove(oid) {
    if (!_orders.has(oid)) return false;
    _orders.delete(oid);
    for (const [key, id] of _byKey) if (id === oid) _byKey.delete(key);
    return true;
}

function findAll() {
    return Array.from(_orders.values());
}

// For tests
function _reset() { _orders.clear(); _byKey.clear(); _nextId = 1; }

module.exports = { create, find, findByKey, findByStudent, findAll, remove, _reset, _nextId };