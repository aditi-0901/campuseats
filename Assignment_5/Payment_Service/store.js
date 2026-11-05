const Payment = require('./models');

const _payments = new Map();
const _byKey = new Map();
let _nextId = 1;

function create(orderId, cardToken, amount, currency = "INR", status = "captured", key = null) {
    const p = new Payment(_nextId, orderId, cardToken, amount, currency, status, key);
    _payments.set(p.id, p);
    if (key) _byKey.set(key, p.id);
    _nextId++;
    return p;
}

function find(pid) { return _payments.get(pid) || null; }

function findByKey(key) {
    const id = _byKey.get(key);
    return id ? _payments.get(id) : null;
}

function findByOrderId(orderId) {
    return Array.from(_payments.values()).filter(p => p.orderId === orderId);
}

function findAll() {
    return Array.from(_payments.values());
}

// For tests
function _reset() { _payments.clear(); _byKey.clear(); _nextId = 1; }

module.exports = { create, find, findByKey, findByOrderId, findAll, _reset, get _nextId() { return _nextId; } };
