// Example: How to retrieve and use sessions from another project

const axios = require('axios');
const fs = require('fs').promises;

const SERVER_URL = 'http://localhost:8000'; // Change to your server URL

/**
 * Retrieve session from MongoDB by session ID
 * @param {string} sessionId - The AXIOM_ prefixed session ID
 * @returns {object} Decoded credentials object
 */
async function getSessionById(sessionId) {
    try {
        const response = await axios.get(`${SERVER_URL}/session/${sessionId}`);
        const { creds, createdAt } = response.data;

        // Decode base64 credentials
        const credsJson = Buffer.from(creds, 'base64').toString('utf8');
        const credsData = JSON.parse(credsJson);

        console.log(`Session retrieved: ${sessionId}`);
        console.log(`Created at: ${createdAt}`);

        return credsData;
    } catch (error) {
        if (error.response?.status === 404) {
            console.error('Session not found');
        } else {
            console.error('Error retrieving session:', error.message);
        }
        throw error;
    }
}

/**
 * Save retrieved credentials to a file for use with Baileys
 * @param {string} sessionId - The AXIOM_ prefixed session ID
 * @param {string} outputPath - Path to save the creds.json file
 */
async function saveSessionToFile(sessionId, outputPath = './creds.json') {
    try {
        const credsData = await getSessionById(sessionId);
        await fs.writeFile(outputPath, JSON.stringify(credsData, null, 2));
        console.log(`Credentials saved to: ${outputPath}`);
        return credsData;
    } catch (error) {
        console.error('Failed to save session:', error.message);
        throw error;
    }
}

// Example usage
async function main() {
    const sessionId = 'AXIOM_KZNFhocZNH'; // Replace with actual session ID

    try {
        // Method 1: Get credentials object
        const creds = await getSessionById(sessionId);
        console.log('Credentials retrieved successfully');

        // Method 2: Save to file
        await saveSessionToFile(sessionId, './my-session-creds.json');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Uncomment to run the example
main();

// module.exports = {
//     getSessionById,
//     saveSessionToFile
// };
