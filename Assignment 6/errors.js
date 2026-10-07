// errors.js — Assignment 6, Part B.
//
//   - B1: EVERY failure goes through problem() — including the ones Express
//     would otherwise answer itself (unknown route, wrong method, body too
//     large, unexpected exception; see the tail of app.js). One shape:
//     type / title / status / detail [/ errors], served as
//     application/problem+json.
//   - B2: the type catalogue below is CampusEats' own. It keeps the strings
//     from the assignment's example list that describe something this
//     service really does (payment-declined, order-not-found,
//     illegal-transition) and adds the ones CampusEats' Order model needs.
//     "empty-cart" and "item-unavailable" are deliberately NOT here —
//     see NOTES.md B2.

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
    "route-not-found": "No such endpoint",
    "method-not-allowed": "Method not allowed",
    "payload-too-large": "Request body too large",
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
