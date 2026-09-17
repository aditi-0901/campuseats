const express = require('express');
const app = express();
app.post('/payments', (req, res) => res.status(201).json({ status: "captured" }));
app.listen(8080, () => console.log("Dummy bank listening on 8080..."));