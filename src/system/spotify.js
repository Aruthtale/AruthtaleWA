import SpotifyWebApi from 'spotify-web-api-node';
import fs from 'fs';
import path from 'path';
import { settings } from '../config/settings.js';
import { log } from '../utils/logger.js';

const TOKEN_PATH = path.resolve('session_v2/spotify_tokens.json');

class SpotifyService {
    constructor() {
        this.spotifyApi = new SpotifyWebApi({
            clientId: settings.spotifyClientId,
            clientSecret: settings.spotifyClientSecret,
            redirectUri: 'http://127.0.0.1:8888/callback'
        });

        this.isInitialized = false;
        this.loadTokens();

        // 🔄 Silent Re-auth: Refresh token proactively every 50 minutes
        setInterval(() => {
            if (this.isInitialized && this.spotifyApi.getRefreshToken()) {
                this.refreshAccessToken().catch(() => {});
            }
        }, 50 * 60 * 1000);
    }

    loadTokens() {
        if (fs.existsSync(TOKEN_PATH)) {
            try {
                const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
                this.spotifyApi.setAccessToken(tokens.accessToken);
                this.spotifyApi.setRefreshToken(tokens.refreshToken);
                this.isInitialized = true;
                log.system('Spotify tokens loaded successfully.');
            } catch (error) {
                log.error('Failed to load Spotify tokens:', error.message);
            }
        }
    }

    saveTokens(accessToken, refreshToken) {
        const tokens = { accessToken, refreshToken };
        if (!fs.existsSync(path.dirname(TOKEN_PATH))) {
            fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
        }
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        this.isInitialized = true;
    }

    async refreshAccessToken() {
        try {
            const data = await this.spotifyApi.refreshAccessToken();
            const accessToken = data.body['access_token'];
            this.spotifyApi.setAccessToken(accessToken);
            
            // Update saved tokens (keep the same refresh token)
            const currentTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
            this.saveTokens(accessToken, currentTokens.refreshToken);
            
            log.system('Spotify access token refreshed.');
            return accessToken;
        } catch (error) {
            log.error('Could not refresh Spotify token:', error.message);
            throw error;
        }
    }

    getAuthUrl() {
        const scopes = [
            'user-read-playback-state',
            'user-modify-playback-state',
            'user-read-currently-playing',
            'playlist-read-private',
            'playlist-read-collaborative',
            'user-read-recently-played'
        ];
        return this.spotifyApi.createAuthorizeURL(scopes);
    }

    async setTokensFromCode(code) {
        const data = await this.spotifyApi.authorizationCodeGrant(code);
        const accessToken = data.body['access_token'];
        const refreshToken = data.body['refresh_token'];
        
        this.spotifyApi.setAccessToken(accessToken);
        this.spotifyApi.setRefreshToken(refreshToken);
        this.saveTokens(accessToken, refreshToken);
        
        return { accessToken, refreshToken };
    }

    // --- Wrapper Methods with Auto-Refresh ---
    async execute(method, ...args) {
        if (!this.isInitialized) throw new Error('Spotify API belum login. Gunakan !spotify login');

        try {
            const result = await this.spotifyApi[method](...args);
            return result.body;
        } catch (error) {
            if (error.statusCode === 401) {
                log.ai('Spotify token expired, refreshing...');
                try {
                    await this.refreshAccessToken();
                    const result = await this.spotifyApi[method](...args);
                    return result.body;
                } catch (refreshError) {
                    throw refreshError;
                }
            }
            throw error;
        }
    }

    async play(options = {}) {
        // options can be { context_uri: 'spotify:playlist:xxx' } or { uris: ['spotify:track:xxx'] }
        return await this.execute('play', options);
    }

    async pause() {
        return await this.execute('pause');
    }

    async skipToNext() {
        return await this.execute('skipToNext');
    }

    async skipToPrevious() {
        return await this.execute('skipToPrevious');
    }

    async getMyCurrentPlaybackState() {
        return await this.execute('getMyCurrentPlaybackState');
    }

    async getRecentlyPlayedTracks(limit = 1) {
        return await this.execute('getMyRecentlyPlayedTracks', { limit });
    }

    async searchTracks(query, limit = 5) {
        return await this.execute('searchTracks', query, { limit });
    }

    async getUserPlaylists(limit = 10) {
        return await this.execute('getUserPlaylists', { limit });
    }

    async addToMySavedTracks(trackIds) {
        // trackIds is an array of Spotify track IDs
        return await this.execute('addToMySavedTracks', trackIds);
    }
}

export const spotifyService = new SpotifyService();
