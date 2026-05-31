import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { log } from '../utils/logger.js';

// Load Service Account
const serviceAccountPath = path.resolve('config/credentials/service-account.json');
let serviceAccount;

try {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
    log.error('Failed to load Firebase Service Account:', error.message);
    throw new Error('Firebase Service Account is missing or invalid.');
}

// Initialize Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

export const db = admin.firestore();
export const firebaseAdmin = admin;

/**
 * Helper to mirror Supabase .from('table').insert([{...}])
 */
export const insert = async (collectionName, data) => {
    try {
        const collection = db.collection(collectionName);
        if (Array.isArray(data)) {
            const batch = db.batch();
            data.forEach(item => {
                const docRef = collection.doc();
                batch.set(docRef, { ...item, created_at: admin.firestore.FieldValue.serverTimestamp() });
            });
            await batch.commit();
        } else {
            await collection.add({ ...data, created_at: admin.firestore.FieldValue.serverTimestamp() });
        }
        return { error: null };
    } catch (error) {
        log.error(`Firestore Insert Error [${collectionName}]:`, error.message);
        return { error };
    }
};

/**
 * Helper to mirror Supabase .from('table').select('*').eq('col', 'val')
 */
export const select = async (collectionName, filters = []) => {
    try {
        let query = db.collection(collectionName);
        filters.forEach(f => {
            // f = { col, op, val }
            query = query.where(f.col, f.op || '==', f.val);
        });
        const snapshot = await query.get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { data, error: null };
    } catch (error) {
        log.error(`Firestore Select Error [${collectionName}]:`, error.message);
        return { data: null, error };
    }
};

export default {
    db,
    firebaseAdmin,
    insert,
    select
};
