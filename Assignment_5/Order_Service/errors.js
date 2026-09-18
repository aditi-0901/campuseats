const TITLES = {
    "invalid-request": "Invalid request",
    "payment-declined": "Payment declined",
    "order-not-found": "Order not found",
    "state-conflict": "Cannot cancel order",
    "payments-unavailable": "Payments service unreachable",
    "precondition-failed": "Order was modified since you last read it",
    "not-acceptable": "Not acceptable",
    "unauthorized": "Unauthorized",
    "rate-limit-exceeded": "Too many requests"
};

function problem(res, statusCode, code, detail = "", errors = null) {
    // B6/Q6: error bodies are one-off results, not reusable resource
    // representations, so they must never be replayed from a cache.
    res.setHeader('Cache-Control', 'no-store');
    const body = { type: `/errors/${code}`, title: TITLES[code], status: statusCode, detail: detail };
    if (errors) body.errors = errors;
    return res.status(statusCode).json(body);
}

module.exports = { problem };