// paymentsClient.js
const axios = require('axios');
const crypto = require('crypto'); // Replaced 'uuid' with Node's native crypto module

const PAYMENTS = process.env.PAYMENTS_URL || "http://127.0.0.1:8080";

class CardDeclined extends Error { constructor(msg) { super(msg); this.name = "CardDeclined"; } }
class PaymentsUnavailable extends Error { constructor(msg) { super(msg); this.name = "PaymentsUnavailable"; } }

async function _post(orderId, cardToken, amount, key) {
    try {
        const response = await axios.post(`${PAYMENTS}/payments`,
            { orderId, cardToken, amount, currency: "INR" },
            { headers: { "Idempotency-Key": key }, timeout: 2000 }
        );
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 422) {
            throw new CardDeclined(error.response.data.detail || "Card declined");
        }
        throw new PaymentsUnavailable(error.message);
    }
}

async function chargeWithRetry(orderId, cardToken, amount) {
    const key = crypto.randomUUID(); // Native Node.js UUID generation
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await _post(orderId, cardToken, amount, key);
        } catch (error) {
            if (error.name === 'CardDeclined') throw error;
            const waitTime = (Math.pow(2, attempt) + Math.random()) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    throw new PaymentsUnavailable("Gave up after 3 attempts");
}

module.exports = { chargeWithRetry, _post };