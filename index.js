const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const pingHandler = require("./api/ping");
const dnsHandler = require("./api/dns");
const portsHandler = require("./api/ports");

app.get("/api/ping", pingHandler);
app.get("/api/dns", dnsHandler);
app.get("/api/ports", portsHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DANI SCAN running at http://127.0.0.1:${PORT}`);
});
