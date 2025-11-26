const { saveSession } = require("./mongodb");
const { makeid, makeSessionId } = require('./id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
let router = express.Router()
const pino = require("pino");
const {
	default: WASocket,
	useMultiFileAuthState,
	jidNormalizedUser,
	Browsers,
	delay,
	fetchLatestBaileysVersion,
	makeInMemoryStore,
} = require("baileys");

function removeFile(FilePath) {
	if (!fs.existsSync(FilePath)) return false;
	fs.rmSync(FilePath, {
		recursive: true,
		force: true
	})
};



const {
	readFile
} = require("node:fs/promises")
router.get('/', async (req, res) => {
	const id = makeid();
	async function Getqr() {
		const {
			state,
			saveCreds
		} = await useMultiFileAuthState('./temp/' + id)
		try {
			let session = WASocket({
				auth: state,
				printQRInTerminal: false,
				logger: pino({
					level: "silent"
				}),
				browser: Browsers.macOS("Safari"),
			});

			session.ev.on('creds.update', saveCreds)
			session.ev.on("connection.update", async (s) => {
				const {
					connection,
					lastDisconnect,
					qr
				} = s;
				if (qr) await res.end(await QRCode.toBuffer(qr));
				if (connection == "open") {

					await delay(10000);

					// Read creds file and convert to base64
					const credsPath = __dirname + `/temp/${id}/creds.json`;
					const credsData = await readFile(credsPath, 'utf8');
					const credsBase64 = Buffer.from(credsData).toString('base64');

					// Generate custom session ID
					const sessionId = makeSessionId();

					// Save to MongoDB
					await saveSession(sessionId, credsBase64);

					// Send session ID to user - use jidNormalizedUser to format the JID correctly
					const userJid = jidNormalizedUser(session.user.id);

					// First send the session ID
					const firstMsg = await session.sendMessage(userJid, { text: sessionId });
					await delay(500);

					await session.sendMessage(userJid, {
						text: `Keep this session ID safe! You can use it to retrieve your session.\n\nThis session will expire in 24 hours.`,
					}, { quoted: firstMsg });

					await delay(100);
					await session.ws.close();
					return await removeFile("temp/" + id);
				} else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
					await delay(10000);
					Getqr();
				}
			});
		} catch (err) {
			if (!res.headersSent) {
				await res.json({
					code: "Service Unavailable"
				});
			}
			console.log(err);
			await removeFile("temp/" + id);
		}
	}
	return await Getqr()
	//return //'qr.png', { root: "./" });
});
module.exports = router
