const TITLES = {
    "invalid-request": "Invalid request",
    "payment-declined": "Payment declined",
    "payment-not-found": "Payment not found",
    "state-conflict": "Cannot refund payment",
    "payments-unavailable": "Payments service unreachable",
    "precondition-failed": "Payment was modified since you last read it",
    "not-acceptable": "Not acceptable",
    "unauthorized": "Unauthorized",
    "rate-limit-exceeded": "Too many requests"
};

function problem(res, statusCode, code, detail = "", errors = null) {
    // B6/Q6: error bodies are one-off results, not reusable resource
    // representations, so they must never be replayed from a cache.
    res.setHeader('Cache-Control', 'no-store');
    const body = { type: `/errors/${code}`, title: TITLES[code] || "Error", status: statusCode, detail: detail };
    if (errors) body.errors = errors;
    return res.status(statusCode).json(body);
}

module.exports = { problem };
