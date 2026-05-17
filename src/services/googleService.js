import fs from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';
import { log } from '../utils/logger.js';

/**
 * googleService.js
 * Handles Google Calendar and Tasks Integration
 */

const SCOPES = [
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/gmail.readonly'
];

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

export const googleService = {
    /**
     * Get OAuth2 Client
     */
    getAuthClient: async () => {
        try {
            const content = await fs.readFile(CREDENTIALS_PATH);
            const keys = JSON.parse(content);
            const key = keys.installed || keys.web;
            const client = new google.auth.OAuth2(key.client_id, key.client_secret, key.redirect_uris[0]);
            
            try {
                const token = await fs.readFile(TOKEN_PATH);
                client.setCredentials(JSON.parse(token));
            } catch (e) {
                // Token not found, return client without credentials
                return { client, hasToken: false };
            }
            
            return { client, hasToken: true };
        } catch (err) {
            log.error('Google Credentials Error:', err.message);
            return { client: null, hasToken: false, error: 'credentials.json tidak ditemukan.' };
        }
    },

    /**
     * Generate Authorization URL
     */
    getAuthUrl: async () => {
        const { client, error } = await googleService.getAuthClient();
        if (error) throw new Error(error);
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'select_account'
        });
    },

    /**
     * Exchange code for token and save it
     */
    saveToken: async (code) => {
        const { client } = await googleService.getAuthClient();
        const { tokens } = await client.getToken(code);
        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
        return true;
    },

    // --- GOOGLE TASKS ---
    
    /**
     * List all tasks from default list
     */
    listTasks: async () => {
        const { client, hasToken } = await googleService.getAuthClient();
        if (!hasToken) return null;
        
        const service = google.tasks({ version: 'v1', auth: client });
        const res = await service.tasks.list({
            tasklist: '@default',
            showCompleted: false,
            maxResults: 10
        });
        return res.data.items || [];
    },

    /**
     * Add new task
     */
    addTask: async (title, notes = '') => {
        const { client, hasToken } = await googleService.getAuthClient();
        if (!hasToken) throw new Error('Bot belum terhubung ke Google. Gunakan !google login');
        
        const service = google.tasks({ version: 'v1', auth: client });
        await service.tasks.insert({
            tasklist: '@default',
            requestBody: { title, notes }
        });
        return true;
    },

    /**
     * Delete a task
     */
    deleteTask: async (taskId) => {
        const { client, hasToken } = await googleService.getAuthClient();
        if (!hasToken) throw new Error('Bot belum terhubung ke Google.');
        
        const service = google.tasks({ version: 'v1', auth: client });
        await service.tasks.delete({
            tasklist: '@default',
            task: taskId
        });
        return true;
    },

    // --- GOOGLE CALENDAR ---

    /**
     * List events for today
     */
    listEventsToday: async () => {
        const { client, hasToken } = await googleService.getAuthClient();
        if (!hasToken) return null;

        const calendar = google.calendar({ version: 'v3', auth: client });
        const start = new Date();
        start.setHours(0,0,0,0);
        const end = new Date();
        end.setHours(23,59,59,999);

        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        return res.data.items || [];
    },

    /**
     * Add new event
     */
    addEvent: async (summary, startTime, durationMinutes = 60) => {
        const { client, hasToken } = await googleService.getAuthClient();
        if (!hasToken) throw new Error('Bot belum terhubung ke Google. Gunakan !google login');

        const calendar = google.calendar({ version: 'v3', auth: client });
        const start = new Date(startTime);
        const end = new Date(start.getTime() + durationMinutes * 60000);

        await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary,
                start: { dateTime: start.toISOString() },
                end: { dateTime: end.toISOString() }
            }
        });
        return true;
    },

    // --- GMAIL ---

    /**
     * List latest unread emails
     */
    listEmails: async (maxResults = 5) => {
        const { client, hasToken } = await googleService.getAuthClient();
        if (!hasToken) return null;

        const gmail = google.gmail({ version: 'v1', auth: client });
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread',
            maxResults
        });

        if (!res.data.messages) return [];

        const messages = await Promise.all(res.data.messages.map(async (msg) => {
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id
            });
            
            const headers = detail.data.payload.headers;
            const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const from = headers.find(h => h.name === 'From')?.value || '(Unknown Sender)';
            const date = headers.find(h => h.name === 'Date')?.value || '';
            const snippet = detail.data.snippet || '';

            return {
                id: msg.id,
                threadId: msg.threadId,
                from,
                subject,
                date,
                snippet
            };
        }));

        return messages;
    }
};
