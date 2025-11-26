# WhatsApp Session Manager with MongoDB

This project manages WhatsApp sessions using MongoDB instead of GitHub Gist.

## Features

- Custom session IDs starting with `AXIOM_`
- MongoDB storage for session credentials
- Base64 encoded credentials storage
- API endpoint to retrieve sessions from other projects

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure MongoDB:
   - Copy `.env.example` to `.env`
   - Update `MONGODB_URI` with your MongoDB connection string
   - For local MongoDB: `mongodb://localhost:27017`
   - For MongoDB Atlas: `mongodb+srv://username:password@cluster.mongodb.net/`

3. Start the server:
```bash
npm start
```

## API Endpoints

### Generate Session via QR Code
```
GET /qr
```
Displays QR code for WhatsApp pairing. Session ID will be sent to WhatsApp after successful connection.

### Generate Session via Pairing Code
```
GET /code?number=1234567890
```
Generates pairing code for phone number. Session ID will be sent to WhatsApp after successful pairing.

### Retrieve Session
```
GET /session/:sessionId
```
Retrieves session credentials by session ID.

**Response:**
```json
{
  "sessionId": "AXIOM_abc123xyz",
  "creds": "base64_encoded_credentials",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## Usage in Other Projects

To retrieve and use a session from another project:

```javascript
const axios = require('axios');

async function getSession(sessionId) {
  const response = await axios.get(`http://your-server:8000/session/${sessionId}`);
  const { creds } = response.data;
  
  // Decode base64 credentials
  const credsJson = Buffer.from(creds, 'base64').toString('utf8');
  const credsData = JSON.parse(credsJson);
  
  return credsData;
}
```

## Environment Variables

- `MONGODB_URI` - MongoDB connection string
- `DB_NAME` - Database name (default: whatsapp_sessions)
- `PORT` - Server port (default: 8000)

## Session ID Format

Session IDs are automatically generated with the format: `AXIOM_` followed by 10 random alphanumeric characters.

Example: `AXIOM_a1B2c3D4e5`
