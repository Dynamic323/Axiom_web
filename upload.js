const fs = require('fs').promises;
const axios = require('axios');
require('dotenv').config();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

async function upload(FILE_NAME,FILE_PATH) {
  try {
    const content = await fs.readFile(FILE_PATH, 'utf8');

    const response = await axios.post(
      'https://api.github.com/gists',
      {
        description: 'Uploaded via Node.js with async/await',
        public: false,
        files: {
          [FILE_NAME]: { content }
        }
      },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'User-Agent': 'Node.js'
        }
      }
    );

    return response.data.html_url;
  } catch (error) {
    console.error('Failed to upload gist:', error.response?.data || error.message);
  }
}

module.exports = { upload };
