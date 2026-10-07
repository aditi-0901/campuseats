// errors.js
//
// Assignment 6, Part B (carried forward because Part C's 422 depends on it
// directly — see NOTES.md "Note on scope"):
//   - B1: every failure goes through problem(), and every failure now sets
//     Content-Type: application/problem+json (not plain application/json).
//   - B2: the type catalogue below is CampusEats' own — it keeps the four
//     generic strings that genuinely describe something this service does
//     (payment-declined, order-not-found, illegal-transition,
//     rate-limit-exceeded) and adds the ones CampusEats' actual Order
//     model needs (validation-failed, malformed-json, ...). "empty-cart"
//     and "item-unavailable" from the assignment's own example list are
//     deliberately NOT here — see NOTES.md Q2 for why.

const TITLES = {
    "malformed-json": "Malformed JSON body",
    "validation-failed": "Request failed validation",
    "invalid-query": "Invalid query parameters",
    "payment-declined": "Payment declined",
    "order-not-found": "Order not found",
    "illegal-transition": "Illegal order state transition",
    "payments-unavailable": "Payments service unreachable",
    "precondition-failed": "Order was modified since you last read it",
    "not-acceptable": "Not acceptable",
    "unauthorized": "Unauthorized",
    "rate-limit-exceeded": "Too many requests",
    "internal-error": "Internal error",
};

/**
 * The one error shape every endpoint uses (B1/B2 from Assignment 5,
 * unchanged in spirit; Assignment 6 only changes two things about it:
 * the Content-Type below, and that `errors`, when present, is now a list
 * of {field, reason} objects rather than [field, reason] tuples — C2/B3).
 */
function problem(res, statusCode, code, detail = "", errors = null) {
    // Error bodies are one-off outcomes of a specific request, never a
    // reusable resource representation — never let a cache replay one.
    res.setHeader('Cache-Control', 'no-store');
    const body = {
        type: `/errors/${code}`,
        title: TITLES[code] || code,
        status: statusCode,
        detail,
    };
    if (errors) body.errors = errors;

    res.status(statusCode);
    res.type('application/problem+json');
    return res.send(JSON.stringify(body));
}

module.exports = { problem, TITLES };
