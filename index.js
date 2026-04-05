import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SECRET = process.env.WEBHOOK_SECRET || "change_me";
const ALPACA_KEY = process.env.ALPACA_KEY || "";
const ALPACA_SECRET = process.env.ALPACA_SECRET || "";
const ALPACA_URL = "https://paper-api.alpaca.markets/v2/orders";

app.get("/", (_req, res) => {
  res.send("ok");
});

app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body;
    if (!msg || msg.secret !== SECRET) {
      return res.status(401).send("bad secret");
    }

    const broker = (msg.broker || "alpaca").toLowerCase();
    const side = msg.action?.toLowerCase();
    const qty = Number(msg.contracts ?? 0);
    const symbol = msg.symbol ?? "MNQ";

    // Log sanitized payload for debugging (no secrets)
    console.log(
      JSON.stringify({
        broker,
        action: side,
        qty,
        symbol,
        tif: msg.tif,
      })
    );

    if (!side || qty <= 0) {
      return res.status(400).send("bad payload");
    }

    if (broker !== "alpaca") {
      // Placeholder for future routing (e.g., futures). Currently only Alpaca is wired.
      return res
        .status(501)
        .json({ error: "broker not supported in this relay", broker });
    }

    // Allow time_in_force override; default to GTC for crypto (e.g., SOLUSD) and DAY for equities
    const inferredTif =
      msg.tif ||
      (symbol && symbol.toUpperCase().endsWith("USD") ? "gtc" : "day");

    const order = {
      symbol,
      qty,
      side,
      type: "market",
      time_in_force: inferredTif,
    };

    const r = await fetch(ALPACA_URL, {
      method: "POST",
      headers: {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(order),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(500).json({ error: data });
    }

    return res.json({ ok: true, order: data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
