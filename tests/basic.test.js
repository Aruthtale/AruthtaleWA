import { memoryService } from '../src/services/memory.js';
import { aiRouter } from '../src/ai/router.js';
import { log } from '../src/utils/logger.js';

async function runTests() {
    log.info('Starting Basic System Tests...');

    try {
        // Test 1: Memory Formatting
        log.info('Test 1: Testing Memory History Formatting...');
        const history = await memoryService.getHistory('test_user', 'hello', 5, 'openai');
        if (Array.isArray(history)) {
            log.success('Memory history formatting OK');
        } else {
            throw new Error('Memory history formatting failed');
        }

        // Test 2: AI Routing (Dry Run/Mock check)
        log.info('Test 2: Testing AI Router Config...');
        // We won't actually call the API here to save tokens/costs during test
        // but we check if the task mapping works
        const result = await aiRouter.route('halo', { task: 'GENERAL', dryRun: true });
        if (result) log.success('AI Router basic flow OK');

        log.success('All basic tests passed!');
    } catch (error) {
        log.error('Test Failed:', error.message);
        process.exit(1);
    }
}

runTests();
