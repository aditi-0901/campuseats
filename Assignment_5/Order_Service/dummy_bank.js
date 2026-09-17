const express = require('express');
const app = express();

app.use(express.json());

app.post('/payments', (req, res) => {
    if (req.body.cardToken === "tok_declined") {
        return res.status(422).json({
            detail: "Card declined"
        });
    }

    return res.status(201).json({
        status: "captured"
    });
});

app.listen(8080, () => console.log("Dummy bank listening on 8080..."));