const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kingjoahua47_db_user:EMkQbfERX10l91FI@cluster0.d8ufh2w.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = process.env.DB_NAME || 'whatsapp_sessions';
const COLLECTION_NAME = 'sessions';

let client = null;
let db = null;

async function connectDB() {
    if (db) return db;

    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('Connected to MongoDB');

        // Create TTL index for automatic expiration after 24 hours
        const collection = db.collection(COLLECTION_NAME);
        await collection.createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: 86400 } // 24 hours = 86400 seconds
        );
        console.log('TTL index created for 24-hour session expiration');

        return db;
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        throw error;
    }
}

async function saveSession(sessionId, credsBase64) {
    try {
        const database = await connectDB();
        const collection = database.collection(COLLECTION_NAME);

        const session = {
            sessionId: sessionId,
            creds: credsBase64,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await collection.updateOne(
            { sessionId: sessionId },
            { $set: session },
            { upsert: true }
        );

        console.log(`Session saved: ${sessionId}`);
        return sessionId;
    } catch (error) {
        console.error('Error saving session:', error.message);
        throw error;
    }
}

async function getSession(sessionId) {
    try {
        const database = await connectDB();
        const collection = database.collection(COLLECTION_NAME);

        const session = await collection.findOne({ sessionId: sessionId });
        return session;
    } catch (error) {
        console.error('Error retrieving session:', error.message);
        throw error;
    }
}

async function deleteSession(sessionId) {
    try {
        const database = await connectDB();
        const collection = database.collection(COLLECTION_NAME);

        await collection.deleteOne({ sessionId: sessionId });
        console.log(`Session deleted: ${sessionId}`);
    } catch (error) {
        console.error('Error deleting session:', error.message);
        throw error;
    }
}

async function cleanupExpiredSessions() {
    try {
        const database = await connectDB();
        const collection = database.collection(COLLECTION_NAME);

        // Delete sessions older than 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = await collection.deleteMany({
            createdAt: { $lt: twentyFourHoursAgo }
        });

        if (result.deletedCount > 0) {
            console.log(`Cleaned up ${result.deletedCount} expired sessions`);
        }
        return result.deletedCount;
    } catch (error) {
        console.error('Error cleaning up expired sessions:', error.message);
        throw error;
    }
}

async function closeConnection() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log('MongoDB connection closed');
    }
}

module.exports = {
    connectDB,
    saveSession,
    getSession,
    deleteSession,
    cleanupExpiredSessions,
    closeConnection
};
