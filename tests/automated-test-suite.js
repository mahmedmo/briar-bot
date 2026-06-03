#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Import bot components
const {
    loadGameData,
    analyzeHeroData,
    generateReportImage,
    heroData,
    artifactData
} = require('../src/briar-bot.js');
const { findBestCharacterMatch, getCharacterSuggestions } = require('../src/character-search.js');
const CacheManager = require('../src/cache-manager');

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

class AutomatedTestSuite {
    constructor() {
        this.cacheManager = new CacheManager({
            cacheDir: path.join(__dirname, '..', 'cache'),
            ttl: 30 * 24 * 60 * 60 * 1000,
            maxCacheSize: 500
        });
        
        this.results = {
            searchTests: { passed: 0, failed: 0, total: 0 },
            workflowTests: { passed: 0, failed: 0, total: 0 },
            cacheTests: { passed: 0, failed: 0, total: 0 },
            overall: { passed: 0, failed: 0, total: 0 }
        };
        
        this.testStartTime = Date.now();
    }

    async initialize() {
        console.log(colorize('🧪 Briar Bot Automated Test Suite', 'bold'));
        console.log(colorize('='*50, 'cyan'));
        console.log('');
        
        try {
            console.log(colorize('Initializing test environment...', 'yellow'));
            await loadGameData();
            
            console.log(colorize(' Environment ready', 'green'));
            console.log(`    Heroes loaded: ${Object.keys(heroData).length}`);
            console.log(`   🎭 Artifacts loaded: ${Object.keys(artifactData).length}`);
            
            const cacheStats = this.cacheManager.getCacheStats();
            console.log(`    Cached images: ${cacheStats.totalImages}`);
            console.log('');
            
            return true;
        } catch (error) {
            console.log(colorize(`Initialization failed: ${error.message}`, 'red'));
            return false;
        }
    }

    async runSearchTests() {
        console.log(colorize('🔍 Running Character Search Tests...', 'bold'));
        console.log('');
        
        const searchTests = [
            // Exact matches
            { input: 'Arbiter Vildred', expected: 'Arbiter Vildred', type: 'exact' },
            { input: 'Violet', expected: 'Violet', type: 'exact' },
            { input: 'Seaside Bellona', expected: 'Seaside Bellona', type: 'exact' },
            { input: 'Little Queen Charlotte', expected: 'Little Queen Charlotte', type: 'exact' },
            
            // Community abbreviations
            { input: 'arby', expected: 'Arbiter Vildred', type: 'abbreviation' },
            { input: 'ssb', expected: 'Seaside Bellona', type: 'abbreviation' },
            { input: 'lqc', expected: 'Little Queen Charlotte', type: 'abbreviation' },
            { input: 'spoli', expected: 'Sea Phantom Politis', type: 'abbreviation' },
            
            // Discord formatting
            { input: 'arbiter+vildred', expected: 'Arbiter Vildred', type: 'discord_format' },
            { input: 'little+queen+charlotte', expected: 'Little Queen Charlotte', type: 'discord_format' },
            
            // Moonlight prefix
            { input: 'ml ken', expected: 'Martial Artist Ken', type: 'moonlight_prefix' },
            { input: 'ml violet', expected: 'Remnant Violet', type: 'moonlight_prefix' },
            { input: 'moonlight kise', expected: 'Judge Kise', type: 'moonlight_prefix' },
            
            // Fuzzy matching
            { input: 'arbter vildred', expected: 'Arbiter Vildred', type: 'fuzzy' },
            { input: 'seasid belona', expected: 'Seaside Bellona', type: 'fuzzy' },
            { input: 'violat', expected: 'Violet', type: 'fuzzy' },
            
            // Edge cases
            { input: 'violet', expected: 'Violet', type: 'edge_case' }, // Could match multiple
            { input: 'charlotte', expected: 'Charlotte', type: 'edge_case' }, // Could match multiple
            
            // Should fail
            { input: 'nonexistent hero xyz', expected: null, type: 'should_fail' },
            { input: '123456', expected: null, type: 'should_fail' },
            { input: '', expected: null, type: 'should_fail' }
        ];

        let passed = 0;
        let failed = 0;
        
        for (const test of searchTests) {
            const result = this.runSingleSearchTest(test);
            if (result.passed) {
                passed++;
                console.log(colorize(`   ${test.type}: "${test.input}" → ${test.expected || 'null'}`, 'green'));
            } else {
                failed++;
                console.log(colorize(`   ${test.type}: "${test.input}"`, 'red'));
                if (result.actual && test.expected) {
                    console.log(colorize(`     Expected: ${test.expected}`, 'dim'));
                    console.log(colorize(`     Actual: ${result.actual}`, 'dim'));
                } else if (result.actual && !test.expected) {
                    console.log(colorize(`     Expected: null, but got: ${result.actual}`, 'dim'));
                }
            }
        }
        
        this.results.searchTests = { passed, failed, total: passed + failed };
        
        console.log('');
        console.log(colorize('🔍 Search Test Results:', 'bold'));
        console.log(`   Passed: ${colorize(passed, 'green')}`);
        console.log(`   Failed: ${colorize(failed, 'red')}`);
        console.log(`   Success Rate: ${colorize(((passed / (passed + failed)) * 100).toFixed(1) + '%', 'cyan')}`);
        console.log('');
        
        return failed === 0;
    }

    runSingleSearchTest(test) {
        try {
            const result = findBestCharacterMatch(test.input);
            
            if (test.expected === null) {
                return { passed: result === null, actual: result ? result.character : null };
            } else {
                const passed = result && result.character === test.expected;
                return { passed, actual: result ? result.character : null };
            }
        } catch (error) {
            console.error(colorize(`     Error: ${error.message}`, 'dim'));
            return { passed: false, actual: 'ERROR' };
        }
    }

    async runWorkflowTests() {
        console.log(colorize('🔄 Running Full Workflow Tests...', 'bold'));
        console.log('');
        
        const workflowTests = [
            'Violet', // Should be fast (basic hero)
            'Arbiter Vildred', // Popular ML hero
            'Seaside Bellona' // Popular limited hero
        ];

        let passed = 0;
        let failed = 0;
        
        for (const heroName of workflowTests) {
            console.log(colorize(`  Testing: ${heroName}`, 'cyan'));
            
            const testResult = await this.runSingleWorkflowTest(heroName);
            if (testResult.passed) {
                passed++;
                console.log(colorize(`   ${heroName}: ${testResult.duration}ms, ${testResult.imageSize}`, 'green'));
            } else {
                failed++;
                console.log(colorize(`   ${heroName}: ${testResult.error}`, 'red'));
            }
            
            console.log('');
        }
        
        this.results.workflowTests = { passed, failed, total: passed + failed };
        
        console.log(colorize('🔄 Workflow Test Results:', 'bold'));
        console.log(`   Passed: ${colorize(passed, 'green')}`);
        console.log(`   Failed: ${colorize(failed, 'red')}`);
        console.log(`   Success Rate: ${colorize(((passed / (passed + failed)) * 100).toFixed(1) + '%', 'cyan')}`);
        console.log('');
        
        return failed === 0;
    }

    async runSingleWorkflowTest(heroName) {
        const startTime = Date.now();
        
        try {
            // Character search
            const searchResult = findBestCharacterMatch(heroName);
            if (!searchResult) {
                return { passed: false, error: 'Character search failed' };
            }
            
            const actualHeroName = searchResult.character;
            
            // Check cache
            let imageBuffer = this.cacheManager.getCachedHeroImage(actualHeroName);
            let fromCache = !!imageBuffer;
            
            if (!imageBuffer) {
                // Analyze hero data
                const heroAnalysis = await analyzeHeroData(actualHeroName);
                if (!heroAnalysis) {
                    return { passed: false, error: 'Hero analysis failed' };
                }
                
                // Generate image
                imageBuffer = await generateReportImage(heroAnalysis);
                if (!imageBuffer) {
                    return { passed: false, error: 'Image generation failed' };
                }
                
                // Cache image
                await this.cacheManager.cacheHeroImage(actualHeroName, imageBuffer, heroAnalysis);
            }
            
            // Save test output
            await this.saveTestOutput(actualHeroName, imageBuffer);
            
            const duration = Date.now() - startTime;
            const imageSize = (imageBuffer.length / 1024).toFixed(1) + ' KB';
            
            return {
                passed: true,
                duration,
                imageSize,
                fromCache
            };
            
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async runCacheTests() {
        console.log(colorize(' Running Cache Tests...', 'bold'));
        console.log('');
        
        let passed = 0;
        let failed = 0;
        
        // Test 1: Cache statistics
        console.log('  Testing cache statistics...');
        try {
            const stats = this.cacheManager.getCacheStats();
            if (typeof stats.totalImages === 'number' && 
                typeof stats.validImages === 'number' && 
                typeof stats.totalSizeMB === 'string') {
                passed++;
                console.log(colorize('   Cache statistics working', 'green'));
            } else {
                failed++;
                console.log(colorize('   Cache statistics invalid format', 'red'));
            }
        } catch (error) {
            failed++;
            console.log(colorize(`   Cache statistics error: ${error.message}`, 'red'));
        }
        
        // Test 2: Cache validation
        console.log('  Testing cache validation...');
        try {
            this.cacheManager.validateCacheIntegrity();
            passed++;
            console.log(colorize('   Cache validation working', 'green'));
        } catch (error) {
            failed++;
            console.log(colorize(`   Cache validation error: ${error.message}`, 'red'));
        }
        
        // Test 3: Cache cleanup
        console.log('  Testing cache cleanup...');
        try {
            const cleanedCount = this.cacheManager.cleanupExpiredEntries();
            passed++;
            console.log(colorize(`   Cache cleanup working (${cleanedCount} expired entries)`, 'green'));
        } catch (error) {
            failed++;
            console.log(colorize(`    Cache cleanup error: ${error.message}`, 'red'));
        }
        
        this.results.cacheTests = { passed, failed, total: passed + failed };
        
        console.log('');
        console.log(colorize(' Cache Test Results:', 'bold'));
        console.log(`   Passed: ${colorize(passed, 'green')}`);
        console.log(`   Failed: ${colorize(failed, 'red')}`);
        console.log(`   Success Rate: ${colorize(((passed / (passed + failed)) * 100).toFixed(1) + '%', 'cyan')}`);
        console.log('');
        
        return failed === 0;
    }

    async saveTestOutput(heroName, imageBuffer) {
        try {
            const outputDir = path.join(__dirname, 'output');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const filename = `test_${heroName.replace(/\s+/g, '_').toLowerCase()}.png`;
            const filepath = path.join(outputDir, filename);
            
            fs.writeFileSync(filepath, imageBuffer);
        } catch (error) {
            console.warn(colorize(`    WARNING: Failed to save test output: ${error.message}`, 'dim'));
        }
    }

    generateReport() {
        const totalDuration = Date.now() - this.testStartTime;
        
        // Calculate overall results
        this.results.overall.passed = 
            this.results.searchTests.passed + 
            this.results.workflowTests.passed + 
            this.results.cacheTests.passed;
            
        this.results.overall.failed = 
            this.results.searchTests.failed + 
            this.results.workflowTests.failed + 
            this.results.cacheTests.failed;
            
        this.results.overall.total = this.results.overall.passed + this.results.overall.failed;
        
        console.log(colorize(' FINAL TEST REPORT', 'bold'));
        console.log(colorize('='*50, 'cyan'));
        console.log('');
        
        // Test category results
        const categories = [
            { name: 'Character Search', results: this.results.searchTests },
            { name: 'Full Workflow', results: this.results.workflowTests },
            { name: 'Cache Management', results: this.results.cacheTests }
        ];
        
        categories.forEach(category => {
            const { passed, failed, total } = category.results;
            const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
            const status = failed === 0 ? colorize('PASS', 'green') : colorize('FAIL', 'red');
            
            console.log(`${category.name}: ${status} (${passed}/${total}, ${successRate}%)`);
        });
        
        console.log('');
        
        // Overall results
        const overallSuccess = ((this.results.overall.passed / this.results.overall.total) * 100).toFixed(1);
        const overallStatus = this.results.overall.failed === 0 ? 
            colorize(' ALL TESTS PASSED', 'green') : 
            colorize(' SOME TESTS FAILED', 'red');
        
        console.log(colorize('Overall Results:', 'bold'));
        console.log(`  Status: ${overallStatus}`);
        console.log(`  Passed: ${colorize(this.results.overall.passed, 'green')}`);
        console.log(`  Failed: ${colorize(this.results.overall.failed, 'red')}`);
        console.log(`  Success Rate: ${colorize(overallSuccess + '%', 'cyan')}`);
        console.log(`  Duration: ${colorize((totalDuration / 1000).toFixed(1) + 's', 'yellow')}`);
        
        console.log('');
        
        // Environment info
        const cacheStats = this.cacheManager.getCacheStats();
        console.log(colorize('Environment Info:', 'bold'));
        console.log(`  Heroes Available: ${colorize(Object.keys(heroData).length, 'white')}`);
        console.log(`  Artifacts Available: ${colorize(Object.keys(artifactData).length, 'white')}`);
        console.log(`  Cached Images: ${colorize(cacheStats.totalImages, 'white')}`);
        console.log(`  Cache Size: ${colorize(cacheStats.totalSizeMB + ' MB', 'white')}`);
        
        return this.results.overall.failed === 0;
    }

    async run() {
        const initialized = await this.initialize();
        if (!initialized) {
            process.exit(1);
        }
        
        // Run all test suites
        await this.runSearchTests();
        await this.runWorkflowTests();
        await this.runCacheTests();
        
        // Generate final report
        const success = this.generateReport();
        
        // Exit with appropriate code
        process.exit(success ? 0 : 1);
    }
}

// Handle command line execution
if (require.main === module) {
    const testSuite = new AutomatedTestSuite();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log(colorize('\nWARNING: Test suite interrupted', 'yellow'));
        process.exit(1);
    });
    
    testSuite.run().catch(error => {
        console.error(colorize(`💥 Test suite crashed: ${error.message}`, 'red'));
        process.exit(1);
    });
}

module.exports = AutomatedTestSuite;