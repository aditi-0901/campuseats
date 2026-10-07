// validation.js — Assignment 6, Part C (C1/C2).
//
// C1: "Describe the body" as a JSON Schema or explicit checks. CampusEats'
// actual POST /orders body is a single line item per order — studentId,
// itemId, qty, paymentMethodId — not a multi-line cart with an address
// (the assignment's own example: "items non-empty; each qty an integer
// >= 1; address required"). That cart/address shape does not exist
// anywhere in this project (see openapi.yaml / models.js), so rather than
// inventing one, the checks below are written for the fields CampusEats
// really has, with each one commented against the assignment's own example
// so the mapping is explicit instead of assumed:
//   - "items non-empty"      -> itemId must be present (one line item/order)
//   - "qty integer >= 1"     -> qty, same requirement, verbatim
//   - "address required"     -> paymentMethodId required (CampusEats'
//                                 POST /orders has no delivery address
//                                 field in any prior assignment; the one
//                                 required, non-derivable identifier this
//                                 request actually carries is the payment
//                                 method, so that is what is validated)
//
// C2: "Validate, then act. ... collect all errors, not just the first."
// validateOrderRequest() always runs every check and returns every
// failure in one pass — it never short-circuits on the first bad field —
// so a single response can report two (or more) bad fields at once (see
// NOTES.md Q4).

/**
 * JSON-Schema-equivalent description of the POST /orders body, written out
 * as explicit checks (the assignment offers either form; explicit checks
 * are easier to unit-test against this project's existing dataclass-style
 * models and match how Assignment 4/5 already validate request bodies).
 *
 * Returns an array of {field, reason} objects — empty when the body is
 * valid. Never stops at the first failure (C2).
 */
function validateOrderRequest(body) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return [{ field: "(body)", reason: "request body must be a JSON object" }];
    }

    const errors = [];

    if (!Number.isInteger(body.studentId)) {
        errors.push({ field: "studentId", reason: "required integer" });
    }
    if (!Number.isInteger(body.itemId)) {
        // Stands in for the assignment's "items non-empty": CampusEats
        // orders are one line item each, so "non-empty" here means "an
        // item was actually named".
        errors.push({ field: "itemId", reason: "required integer" });
    }
    if (!Number.isInteger(body.qty) || body.qty < 1) {
        errors.push({ field: "qty", reason: "required integer, minimum 1" });
    }
    if (typeof body.paymentMethodId !== 'string' || !body.paymentMethodId.trim()) {
        errors.push({ field: "paymentMethodId", reason: "required non-empty string" });
    }

    return errors;
}

/**
 * GET /orders query-string checks. Kept separate from body validation —
 * the failure here is "the request can't be parsed as a valid search",
 * not "the request's content violates a business rule" — but the same
 * collect-everything discipline from C2 applies: every bad parameter is
 * reported together, not just the first one found.
 */
function validateListQuery(query) {
    const errors = [];

    const student = query.student !== undefined ? Number(query.student) : null;
    if (query.student !== undefined && !Number.isInteger(student)) {
        errors.push({ field: "student", reason: "must be an integer" });
    }

    const page = query.page !== undefined ? Number(query.page) : 1;
    if (!Number.isInteger(page) || page < 1) {
        errors.push({ field: "page", reason: "must be an integer >= 1" });
    }

    const limit = query.limit !== undefined ? Number(query.limit) : 10;
    if (!Number.isInteger(limit) || limit < 1) {
        errors.push({ field: "limit", reason: "must be an integer >= 1" });
    }

    const sort = query.sort || 'createdAt';
    if (!['createdAt', 'id'].includes(sort)) {
        errors.push({ field: "sort", reason: "must be 'createdAt' or 'id'" });
    }

    const order = query.order || 'asc';
    if (!['asc', 'desc'].includes(order)) {
        errors.push({ field: "order", reason: "must be 'asc' or 'desc'" });
    }

    return { errors, parsed: { student, page, limit, sort, order } };
}

module.exports = { validateOrderRequest, validateListQuery };
