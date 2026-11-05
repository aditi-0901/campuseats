class Payment {
    constructor(id, orderId, cardToken, amount, currency, status, idempotencyKey = null) {
        this.id = id;
        this.orderId = orderId;
        this.cardToken = cardToken;
        this.amount = amount;
        this.currency = currency || "INR";
        this.status = status;
        this.idempotencyKey = idempotencyKey;
        this.createdAt = new Date().toISOString();
    }

    asJson() {
        return {
            id: this.id,
            orderId: this.orderId,
            cardToken: this.cardToken,
            amount: this.amount,
            currency: this.currency,
            status: this.status,
            createdAt: this.createdAt
        };
    }
}

module.exports = Payment;
