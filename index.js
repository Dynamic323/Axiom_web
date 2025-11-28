const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const https = require("https");
const { connectDB } = require("./mongodb");

const app = express();
const __path = process.cwd();
const PORT = process.env.PORT || 8000;

// Add keep-alive ping
const keepAlive = () => {
  const url = "https://axiom-angm.onrender.com"; // Replace with your Render app URL
  setInterval(() => {
    https
      .get(url, (res) => {
        console.log("Keep-alive ping sent");
      })
      .on("error", (err) => {
        console.error("Keep-alive error:", err.message);
      });
  }, 14 * 60 * 1000); // Ping every 14 minutes
};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__path, "public")));

app.get("/pair", (req, res) => {
  res.sendFile(path.join(__path, "/public/pair.html"));
});

app.get("/qr", (req, res) => {
  res.sendFile(path.join(__path, "/public/qr.html"));
});

let qrCode = require("./qr");
app.use("/qr-code", qrCode);

let pair = require("./pair");
app.use("/code", pair);

// Session retrieval endpoint
const { getSession, cleanupExpiredSessions } = require("./mongodb");
app.get("/session/:sessionId", async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found or expired" });
    }

    res.json({
      sessionId: session.sessionId,
      creds: session.creds,
      createdAt: session.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve session" });
  }
});

// Run cleanup every 6 hours
setInterval(async () => {
  try {
    await cleanupExpiredSessions();
  } catch (error) {
    console.error("Scheduled cleanup failed:", error.message);
  }
}, 6 * 60 * 60 * 1000); // 6 hours

app.get("/", (req, res) => {
  res.sendFile(path.join(__path, "/public/index.html"));
});

app.listen(PORT, async () => {
  console.log("Server running on http://localhost:" + PORT);

  // Connect to MongoDB on startup
  try {
    await connectDB();
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
    console.error("Please check your MONGODB_URI in .env file");
  }

  keepAlive(); // Start the keep-alive pings
});

module.exports = app;
