// representation.js — Assignment 6, Part C3/C4 and NOTES.md Q7.
//
// C3: "Honour Accept: return application/json by default, application/xml
// if asked; 406 if you can't produce it." The 406 half already lived in
// app.js from Assignment 5 (B1); this file adds the "if asked" half —
// an actual XML representation of an Order, chosen only when the client's
// Accept header asks for application/xml and does not also accept JSON.
//
// No XML library is added for this — CampusEats' Order representation is
// five flat fields (id, studentId, itemId, qty, status, createdAt), so a
// small hand-written serializer is both sufficient and easier to audit
// than pulling in a dependency for one request type.

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function orderToXml(orderJson) {
    const fields = Object.entries(orderJson)
        .map(([key, value]) => `  <${key}>${escapeXml(value)}</${key}>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<order>\n${fields}\n</order>\n`;
}

/**
 * True only for a client that asked for XML and did not also accept JSON
 * (an Accept of "application/json", or the wildcard that matches anything,
 * anywhere in the header means JSON — the documented default — still
 * wins, per C3's "return application/json by default").
 */
function wantsXmlOnly(req) {
    const accept = req.headers.accept || '';
    return accept.includes('application/xml') && !accept.includes('application/json') && !accept.includes('*/*');
}

/**
 * Sends a single Order resource honouring content negotiation (C3), and
 * sets Content-Type with a charset on either branch (C4 — "Set
 * Content-Type (+ charset=utf-8) on every response").
 */
function sendOrder(req, res, status, orderJson) {
    res.setHeader('Vary', 'Accept');
    if (wantsXmlOnly(req)) {
        return res.status(status).type('application/xml; charset=utf-8').send(orderToXml(orderJson));
    }
    // Express's res.json() already sets Content-Type: application/json;
    // charset=utf-8 — satisfies C4 without anything extra.
    return res.status(status).json(orderJson);
}

module.exports = { sendOrder, orderToXml, wantsXmlOnly };
