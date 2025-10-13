import express from "express";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// --- Simple file store (replace with a DB in prod)
const DATA_FILE = path.resolve("./donations.json");
function readTotal() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const { total = 0 } = JSON.parse(raw);
    return Number(total) || 0;
  } catch {
    return 0;
  }
}
function writeTotal(total) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ total }), "utf8");
}

// Ensure file exists
if (!fs.existsSync(DATA_FILE)) writeTotal(0);

// PayPal will POST form-encoded IPN to this route
app.use("/api/paypal/ipn", express.urlencoded({ extended: false }));

app.post("/api/paypal/ipn", async (req, res) => {
  // Step 1: Validate with PayPal (IPN protocol)
  const params = new URLSearchParams({ cmd: "_notify-validate" });
  for (const [k, v] of Object.entries(req.body)) params.append(k, v);

  // Use live endpoint; for Sandbox use ipnpb.sandbox.paypal.com
  const verifyRes = await fetch("https://ipnpb.paypal.com/cgi-bin/webscr", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  const verifyText = await verifyRes.text();

  // Step 2: Only accept VERIFIED + Completed
  if (verifyText === "VERIFIED" && req.body.payment_status === "Completed") {
    // Currency check recommended
    if (req.body.mc_currency !== "USD") {
      return res.status(200).end(); // ignore different currencies
    }

    const gross = Number(req.body.mc_gross || 0);
    if (!Number.isFinite(gross) || gross <= 0) {
      return res.status(200).end();
    }

    // Optional: dedupe by txn_id
    // For a file-store, simplest is to keep a small set in memory or a log.
    // Here we just add; in production, log txn_id and skip if seen.
    const current = readTotal();
    writeTotal(current + gross);
  }

  // Always respond 200 OK to PayPal
  res.status(200).end();
});

// Public endpoint your front-end will call
app.get("/api/donations/total", (req, res) => {
  res.json({ raised: readTotal() });
});

app.listen(PORT, () => {
  console.log(`Donations server on :${PORT}`);
});

// 2) Configure PayPal IPN
// 	1.	Log in to PayPal Business.
// 	2.	Settings → Website payments → Instant payment notifications (IPN) → Choose IPN settings.
// 	3.	Set Notification URL to your deployed endpoint, e.g.
// https://your-app.onrender.com/api/paypal/ipn
// 	4.	Receive IPN messages: Enabled → Save.
// 	5.	In your donate form, keep: