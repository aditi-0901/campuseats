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

// For tests
function _reset() { _orders.clear(); _byKey.clear(); _nextId = 1; }

module.exports = { create, find, findByKey, findByStudent, _reset, _nextId };