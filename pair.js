const { saveSession } = require("./mongodb");
const { makeid, makeSessionId } = require('./id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const path = require('path');
const {
    default: WASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

const { readFile } = require("node:fs/promises");

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;
    let isPaired = false;
    let session = null;
    let retryCount = 0;
    const maxRetries = 3;

    // Cleanup function to remove listeners and files
    const cleanup = async () => {
        if (session) {
            try {
                session.ev.removeAllListeners();
                if (session.ws && session.ws.readyState === 1) {
                    await session.ws.close();
                }
            } catch (err) {
                console.log("Error during cleanup:", err.message);
            }
        }
        await removeFile(`./temp/${id}`);
    };

    // Set a timeout to prevent hanging requests
    const timeoutId = setTimeout(async () => {
        if (!res.headersSent && !isPaired) {
            await cleanup();
            res.status(408).json({ error: "Request timeout" });
        }
    }, 120000); // 2 minutes timeout

    async function getPaire() {
        if (retryCount >= maxRetries) {
            clearTimeout(timeoutId);
            if (!res.headersSent) {
                await cleanup();
                return res.status(503).json({ error: "Max retries exceeded" });
            }
            return;
        }

        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            session = WASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            // Handle pairing code request
            if (!session.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');

                if (!num || num.length < 10) {
                    clearTimeout(timeoutId);
                    await cleanup();
                    if (!res.headersSent) {
                        return res.status(400).json({ error: "Invalid phone number" });
                    }
                    return;
                }

                const code = await session.requestPairingCode(num);
                if (!res.headersSent) {
                    res.json({ code });
                }
            }

            // Handle credentials update
            const onCredsUpdate = () => {
                saveCreds();
            };

            // Handle connection updates
            const onConnectionUpdate = async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open" && !isPaired) {
                    isPaired = true;
                    clearTimeout(timeoutId);

                    // Immediately remove the listener to prevent multiple executions
                    session.ev.off("connection.update", onConnectionUpdate);

                    try {
                        await delay(5000); // Reduced delay

                        // Check if creds file exists before saving
                        const credsPath = path.join(__dirname, 'temp', id, 'creds.json');
                        if (!fs.existsSync(credsPath)) {
                            throw new Error("Credentials file not found");
                        }

                        // Read creds file and convert to base64
                        const credsData = await readFile(credsPath, 'utf8');
                        const credsBase64 = Buffer.from(credsData).toString('base64');

                        // Generate custom session ID
                        const sessionId = makeSessionId();

                        // Save to MongoDB
                        await saveSession(sessionId, credsBase64);

                        // Send session ID to user - use proper JID format
                        const userJid = session.user.id.includes('@') ? session.user.id : `${session.user.id.split(':')[0]}@s.whatsapp.net`;

                        // First send the session ID
                        const firstMsg = await session.sendMessage(userJid, { text: sessionId });
                        await delay(500);

                        // Then quote it with the rest of the message
                        await session.sendMessage(userJid, {
                            text: `Keep this session ID safe! You can use it to retrieve your session.\n\nThis session will expire in 24 hours.`,
                        }, { quoted: firstMsg });
                        // await delay(100);

                    } catch (uploadError) {
                        console.log("Upload error:", uploadError.message);
                    } finally {
                        await cleanup();
                    }

                } else if (
                    connection === "close" &&
                    lastDisconnect &&
                    lastDisconnect.error &&
                    lastDisconnect.error.output?.statusCode !== 401 &&
                    !isPaired
                ) {
                    retryCount++;
                    console.log(`Connection closed, retrying (${retryCount}/${maxRetries})...`);

                    // Remove current listeners before retry
                    session.ev.removeAllListeners();

                    await delay(5000); // Reduced retry delay
                    getPaire();

                } else if (connection === "close" && !isPaired) {
                    // Connection closed without retry conditions
                    clearTimeout(timeoutId);
                    await cleanup();
                    if (!res.headersSent) {
                        res.status(500).json({ error: "Connection failed" });
                    }
                }
            };

            // Add event listeners
            session.ev.on('creds.update', onCredsUpdate);
            session.ev.on("connection.update", onConnectionUpdate);

        } catch (err) {
            console.log("Service error:", err.message);
            retryCount++;

            if (retryCount >= maxRetries) {
                clearTimeout(timeoutId);
                await cleanup();
                if (!res.headersSent) {
                    res.status(503).json({ error: "Service Unavailable" });
                }
            } else {
                await delay(5000);
                getPaire();
            }
        }
    }

    // Handle request cancellation
    req.on('close', async () => {
        clearTimeout(timeoutId);
        await cleanup();
    });

    // Start pairing process
    getPaire();
});

module.exports = router;
