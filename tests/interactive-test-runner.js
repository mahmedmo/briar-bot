#!/usr/bin/env node

const readline = require('readline');
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

class TestRunner {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.cacheManager = new CacheManager({
            cacheDir: path.join(__dirname, '..', 'cache'),
            ttl: 30 * 24 * 60 * 60 * 1000,
            maxCacheSize: 500
        });
        
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0
        };
        
        this.predefinedTests = [
            // Exact matches
            { input: 'Arbiter Vildred', expected: 'Arbiter Vildred', type: 'exact' },
            { input: 'Violet', expected: 'Violet', type: 'exact' },
            { input: 'Seaside Bellona', expected: 'Seaside Bellona', type: 'exact' },
            
            // Community abbreviations
            { input: 'arby', expected: 'Arbiter Vildred', type: 'abbreviation' },
            { input: 'ssb', expected: 'Seaside Bellona', type: 'abbreviation' },
            { input: 'lqc', expected: 'Little Queen Charlotte', type: 'abbreviation' },
            
            // Discord formatting (+ signs)
            { input: 'arbiter+vildred', expected: 'Arbiter Vildred', type: 'discord_format' },
            { input: 'seaside+bellona', expected: 'Seaside Bellona', type: 'discord_format' },
            
            // Moonlight prefix
            { input: 'ml ken', expected: 'Martial Artist Ken', type: 'moonlight_prefix' },
            { input: 'ml violet', expected: 'Remnant Violet', type: 'moonlight_prefix' },
            
            // Fuzzy matching
            { input: 'arbter vildred', expected: 'Arbiter Vildred', type: 'fuzzy' },
            { input: 'violat', expected: 'Violet', type: 'fuzzy' },
            
            // Should fail
            { input: 'nonexistent hero xyz', expected: null, type: 'should_fail' }
        ];
    }

    async initialize() {
        console.log(colorize('\n🧪 Briar Bot Interactive Test Runner', 'bold'));
        console.log(colorize('='*50, 'cyan') + '\n');
        
        console.log(colorize('Initializing test environment...', 'yellow'));
        
        try {
            await loadGameData();
            console.log(colorize('Game data loaded successfully', 'green'));
            console.log(`   Heroes: ${Object.keys(heroData).length}`);
            console.log(`   🎭 Artifacts: ${Object.keys(artifactData).length}`);
            
            const cacheStats = this.cacheManager.getCacheStats();
            console.log(`   Cached images: ${cacheStats.totalImages} (${cacheStats.totalSizeMB} MB)`);
            
        } catch (error) {
            console.log(colorize(` Failed to initialize: ${error.message}`, 'red'));
            process.exit(1);
        }
        
        console.log('');
    }

    async runPredefinedTests() {
        console.log(colorize('🔄 Running predefined test suite...', 'bold'));
        console.log('');
        
        let passed = 0;
        let failed = 0;
        
        for (const test of this.predefinedTests) {
            const result = await this.runSingleSearchTest(test);
            if (result) {
                passed++;
                console.log(colorize(`PASS: ${test.input}`, 'green'));
            } else {
                failed++;
                console.log(colorize(`FAIL: ${test.input}`, 'red'));
            }
        }
        
        console.log('');
        console.log(colorize('Predefined Test Results:', 'bold'));
        console.log(`   Passed: ${colorize(passed, 'green')}`);
        console.log(`   Failed: ${colorize(failed, 'red')}`);
        console.log(`   Success Rate: ${colorize(((passed / (passed + failed)) * 100).toFixed(1) + '%', 'cyan')}`);
        console.log('');
        
        this.testResults.passed += passed;
        this.testResults.failed += failed;
        this.testResults.total += passed + failed;
    }

    async runSingleSearchTest(test) {
        try {
            const result = findBestCharacterMatch(test.input);
            
            if (test.expected === null) {
                // Should fail - expect no result
                return result === null;
            } else {
                // Should succeed - expect specific result
                return result && result.character === test.expected;
            }
        } catch (error) {
            console.error(colorize(`   Error in test ${test.input}: ${error.message}`, 'red'));
            return false;
        }
    }

    async runFullWorkflowTest(heroName) {
        console.log(colorize(`\n🔍 Full Workflow Test: ${heroName}`, 'bold'));
        console.log(colorize('-'.repeat(40), 'dim'));
        
        const startTime = Date.now();
        let testPassed = true;
        const results = {};
        
        try {
            // Step 1: Character Search
            console.log('1. Character search...');
            const searchResult = findBestCharacterMatch(heroName);
            
            if (!searchResult) {
                console.log(colorize('    No character match found', 'red'));
                
                // Show suggestions
                const suggestions = getCharacterSuggestions(heroName, 3);
                if (suggestions.length > 0) {
                    console.log(colorize(`   Suggestions: ${suggestions.join(', ')}`, 'yellow'));
                }
                
                return false;
            }
            
            const actualHeroName = searchResult.character;
            const confidence = (searchResult.confidence * 100).toFixed(1);
            
            console.log(colorize(`   Found: ${actualHeroName} (${confidence}% confidence)`, 'green'));
            results.character = actualHeroName;
            results.confidence = confidence;
            results.matchType = searchResult.matchType;
            
            // Step 2: Check Cache
            console.log('2. Checking cache...');
            const isCached = this.cacheManager.isCached(actualHeroName);
            
            if (isCached) {
                console.log(colorize('   ⚡ Cache hit! Image available', 'green'));
                const cachedImage = this.cacheManager.getCachedHeroImage(actualHeroName);
                
                if (cachedImage) {
                    results.cacheHit = true;
                    results.imageSize = (cachedImage.length / 1024).toFixed(1) + ' KB';
                    
                    // Save test output
                    await this.saveTestOutput(actualHeroName, cachedImage);
                    
                    const endTime = Date.now();
                    results.duration = endTime - startTime;
                    
                    this.displayTestResults(results);
                    return true;
                }
            } else {
                console.log(colorize('   📭 Not cached, will generate new image', 'yellow'));
                results.cacheHit = false;
            }
            
            // Step 3: Data Analysis
            console.log('3. Analyzing hero data...');
            const heroAnalysis = await analyzeHeroData(actualHeroName);
            
            if (!heroAnalysis) {
                console.log(colorize('    Failed to fetch hero analysis data', 'red'));
                const endTime = Date.now();
                results.duration = endTime - startTime;
                this.displayTestResults(results);
                return false;
            } else {
                console.log(colorize(`   Analysis complete: ${heroAnalysis.totalBuilds} builds`, 'green'));
                results.totalBuilds = heroAnalysis.totalBuilds;
                results.topSets = heroAnalysis.topSets.length;
                results.topArtifacts = heroAnalysis.topArtifacts.length;
            }
            
            // Step 4: Image Generation
            console.log('4. Generating image...');
            const screenshot = await generateReportImage(heroAnalysis);
            
            if (!screenshot) {
                console.log(colorize('    Failed to generate image', 'red'));
                testPassed = false;
            } else {
                console.log(colorize(`   Image generated: ${(screenshot.length / 1024).toFixed(1)} KB`, 'green'));
                results.imageSize = (screenshot.length / 1024).toFixed(1) + ' KB';
                
                // Step 5: Cache Image
                console.log('5. Caching image...');
                const cached = await this.cacheManager.cacheHeroImage(actualHeroName, screenshot, heroAnalysis);
                
                if (cached) {
                    console.log(colorize('   Image cached successfully', 'green'));
                    results.cached = true;
                } else {
                    console.log(colorize('   Failed to cache image', 'yellow'));
                    results.cached = false;
                }
                
                // Save test output
                await this.saveTestOutput(actualHeroName, screenshot);
            }
            
            const endTime = Date.now();
            results.duration = endTime - startTime;
            
            this.displayTestResults(results);
            return testPassed;
            
        } catch (error) {
            console.log(colorize(`   💥 Test failed with error: ${error.message}`, 'red'));
            return false;
        }
    }

    displayTestResults(results) {
        console.log(colorize('\nTest Results:', 'bold'));
        console.log(`   Character: ${colorize(results.character, 'white')}`);
        console.log(`   🎲 Confidence: ${colorize(results.confidence + '%', 'cyan')}`);
        console.log(`   🔍 Match Type: ${colorize(results.matchType, 'magenta')}`);
        
        if (results.totalBuilds) {
            console.log(`    Builds: ${colorize(results.totalBuilds, 'yellow')}`);
        }
        
        if (results.imageSize) {
            console.log(`    Image Size: ${colorize(results.imageSize, 'green')}`);
        }
        
        if (results.cacheHit !== undefined) {
            const cacheStatus = results.cacheHit ? 
                colorize('HIT', 'green') : 
                colorize('MISS', 'yellow');
            console.log(`    Cache: ${cacheStatus}`);
        }
        
        if (results.duration) {
            console.log(`    Duration: ${colorize(results.duration + 'ms', 'cyan')}`);
        }
        
        console.log('');
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
            console.log(colorize(`    Test output saved: ${filename}`, 'dim'));
        } catch (error) {
            console.error(colorize(`   WARNING: Failed to save test output: ${error.message}`, 'yellow'));
        }
    }

    async showMenu() {
        console.log(colorize('Test Options:', 'bold'));
        console.log('  1. Run predefined test suite');
        console.log('  2. Test specific hero (full workflow)');
        console.log('  3. Test character search only');
        console.log('  4. Show cache statistics');
        console.log('  5. Cache management');
        console.log('  6. Exit');
        console.log('');
        
        return new Promise((resolve) => {
            this.rl.question(colorize('Select option (1-6): ', 'cyan'), resolve);
        });
    }

    async testSpecificHero() {
        return new Promise((resolve) => {
            this.rl.question(colorize('Enter hero name to test: ', 'cyan'), resolve);
        });
    }

    async testCharacterSearch() {
        return new Promise((resolve) => {
            this.rl.question(colorize('Enter search term: ', 'cyan'), (input) => {
                console.log('');
                const result = findBestCharacterMatch(input);
                
                if (result) {
                    console.log(colorize(' Match Found:', 'green'));
                    console.log(`   Character: ${colorize(result.character, 'white')}`);
                    console.log(`   Confidence: ${colorize((result.confidence * 100).toFixed(1) + '%', 'cyan')}`);
                    console.log(`   Match Type: ${colorize(result.matchType, 'magenta')}`);
                } else {
                    console.log(colorize(' No match found', 'red'));
                    
                    const suggestions = getCharacterSuggestions(input, 5);
                    if (suggestions.length > 0) {
                        console.log(colorize(' Suggestions:', 'yellow'));
                        suggestions.forEach((suggestion, index) => {
                            console.log(`   ${index + 1}. ${suggestion}`);
                        });
                    }
                }
                
                console.log('');
                resolve();
            });
        });
    }

    showCacheStats() {
        console.log(colorize('\n Cache Statistics:', 'bold'));
        
        const stats = this.cacheManager.getCacheStats();
        console.log(`    Total Images: ${colorize(stats.totalImages, 'green')}`);
        console.log(`    Valid Images: ${colorize(stats.validImages, 'green')}`);
        console.log(`    Total Size: ${colorize(stats.totalSizeMB + ' MB', 'yellow')}`);
        console.log(`    Success Rate: ${colorize(stats.successRate + '%', 'cyan')}`);
        console.log(`   Cache Hits: ${colorize(stats.cacheHitsSinceStart, 'magenta')}`);
        
        console.log('');
    }

    async cacheManagement() {
        console.log(colorize('\n Cache Management:', 'bold'));
        console.log('  1. Clean expired entries');
        console.log('  2. Reset entire cache');
        console.log('  3. List cached heroes');
        console.log('  4. Back to main menu');
        console.log('');
        
        return new Promise((resolve) => {
            this.rl.question(colorize('Select option (1-4): ', 'cyan'), async (choice) => {
                switch (choice) {
                    case '1':
                        const cleaned = this.cacheManager.cleanupExpiredEntries();
                        console.log(colorize(`🧹 Cleaned ${cleaned} expired entries`, 'green'));
                        break;
                    case '2':
                        console.log(colorize('WARNING: This will delete ALL cached images!', 'red'));
                        const confirm = await new Promise(r => 
                            this.rl.question('Type "confirm" to proceed: ', r)
                        );
                        if (confirm.toLowerCase() === 'confirm') {
                            const reset = this.cacheManager.resetCache();
                            if (reset) {
                                console.log(colorize(' Cache reset successfully', 'green'));
                            } else {
                                console.log(colorize(' Failed to reset cache', 'red'));
                            }
                        } else {
                            console.log(colorize(' Cache reset cancelled', 'yellow'));
                        }
                        break;
                    case '3':
                        const metadata = this.cacheManager.getMetadata();
                        const heroEntries = Object.entries(metadata.heroes).slice(0, 20);
                        
                        console.log(colorize('\n Cached Heroes (showing first 20):', 'bold'));
                        heroEntries.forEach(([hero, data]) => {
                            const lastUpdated = new Date(data.lastUpdated).toLocaleDateString();
                            const size = data.fileSizeBytes ? (data.fileSizeBytes / 1024).toFixed(1) + ' KB' : 'Unknown';
                            console.log(`   • ${hero} - ${size}, ${lastUpdated}`);
                        });
                        
                        if (Object.keys(metadata.heroes).length > 20) {
                            const remaining = Object.keys(metadata.heroes).length - 20;
                            console.log(colorize(`   ... and ${remaining} more`, 'dim'));
                        }
                        break;
                }
                
                console.log('');
                resolve();
            });
        });
    }

    async run() {
        await this.initialize();
        
        while (true) {
            const choice = await this.showMenu();
            
            switch (choice) {
                case '1':
                    await this.runPredefinedTests();
                    break;
                    
                case '2':
                    const heroName = await this.testSpecificHero();
                    if (heroName.trim()) {
                        await this.runFullWorkflowTest(heroName.trim());
                    }
                    break;
                    
                case '3':
                    await this.testCharacterSearch();
                    break;
                    
                case '4':
                    this.showCacheStats();
                    break;
                    
                case '5':
                    await this.cacheManagement();
                    break;
                    
                case '6':
                    console.log(colorize('👋 Goodbye!', 'green'));
                    this.rl.close();
                    return;
                    
                default:
                    console.log(colorize(' Invalid option, please try again', 'red'));
                    console.log('');
            }
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(colorize('\n👋 Test runner interrupted. Goodbye!', 'yellow'));
    process.exit(0);
});

// Run the interactive test runner
if (require.main === module) {
    const runner = new TestRunner();
    runner.run().catch(error => {
        console.error(colorize(`💥 Fatal error: ${error.message}`, 'red'));
        process.exit(1);
    });
}

module.exports = TestRunner;