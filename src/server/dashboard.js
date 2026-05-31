import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from '../utils/logger.js';
import { db } from '../services/firebaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// API Endpoint for metrics
app.get('/api/metrics', async (req, res) => {
    try {
        const snapshot = await db.collection('ai_metrics')
            .orderBy('created_at', 'desc')
            .limit(1000)
            .get();
            
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Simple aggregate logic
        const summary = {
            total_requests: data.length,
            providers: {},
            tiers: {},
            avg_latency: 0,
            success_rate: 0
        };
        
        let totalLatency = 0;
        let successCount = 0;
        
        data.forEach(row => {
            if (row.provider) {
                summary.providers[row.provider] = (summary.providers[row.provider] || 0) + 1;
            }
            if (row.tier) {
                summary.tiers[row.tier] = (summary.tiers[row.tier] || 0) + 1;
            }
            if (row.status === 'success') successCount++;
            if (row.latency) totalLatency += row.latency;
        });
        
        if (data.length > 0) {
            summary.avg_latency = Math.round(totalLatency / data.length);
            summary.success_rate = Math.round((successCount / data.length) * 100);
        }
        
        res.json({
            summary,
            recent: data.slice(0, 50) // Return top 50 for the chart/logs
        });
    } catch (err) {
        log.error('Metrics API Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export const dashboardService = {
    init: () => {
        const PORT = process.env.PORT || 8899;
        app.listen(PORT, () => {
            log.system(`📊 Analytics Dashboard running on http://localhost:${PORT}`);
        });
    }
};
