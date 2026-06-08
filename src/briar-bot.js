const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const http = require('http');
const axios = require('axios');
const getArtifactImage = require('./fetch-artifact');
const getHeroImageUrl = require('./fetch-hero');
const { findBestCharacterMatch, getCharacterSuggestions } = require('./character-search');
const CacheManager = require('./cache-manager');
const RateLimiter = require('./rate-limiter');
const { initializeGuildWarScheduler, testAnnouncements } = require('./guild-war-scheduler');
require('dotenv').config();


const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

const BOT_TOKEN = process.env.BOT_TOKEN;

// Briar Witch Iseria response variations
const BRIAR_RESPONSES = {
	rateLimited: [
		'You pester me too often... begone for now, and return in {time} seconds.',
		'Your impatience tries my patience. Wait {time} seconds before speaking again.',
		'The spirits grow restless with your constant demands. Return in {time} seconds.',
		'Silence, mortal. You may speak again in {time} seconds.',
		'My magic requires rest. Come back in {time} seconds.',
		'Too hasty... the forest spirits need {time} seconds to recover.',
		'Do you think the thorns grow faster if you shout at them? Wait {time} seconds.',
		'Impatience feeds the curse… wait {time} seconds lest it devours you.',
		'The forest does not dance to your rhythm. Return in {time} seconds.',
		'My crows tire of your voice. Come back in {time} seconds.',
		'Keep scratching at the bramble, and you’ll only bleed. Wait {time} seconds.',
		'Your urgency is a brittle twig—it will snap in {time} seconds.',
		'The roots cannot grow faster by your command. Wait {time} seconds.',
		'The thorned path is slow by design… return in {time} seconds.',
		'I will not wither for your whims. Wait {time} seconds.',
		'You water weeds with your haste. Wait {time} seconds.',
		'Patience is the only spell that costs nothing. Wait {time} seconds.'
	],

	invalidInput: [
		'Your words make no sense... speak clearly, or be silent. **{error}**',
		'Such gibberish offends the spirits. **{error}**',
		'I cannot divine meaning from your rambling. **{error}**',
		'Speak plainly, fool. **{error}**',
		'The forest does not understand your nonsense. **{error}**',
		'You mumble like a root-strangled spirit. **{error}**',
		'Even the dead speak clearer than this. **{error}**',
		'I won’t untangle your nonsense—try again. **{error}**',
		'Do you want me to hex your tongue? **{error}**',
		'The curse twists your words into weeds. **{error}**',
		'Your voice tangles like vines around a corpse. **{error}**',
		'The forest spits out such folly. **{error}**',
		'Were those words or just the wind through hollow bark? **{error}**',
		'The spirits whisper only mockery at this. **{error}**',
		'Try again before the roots forget you entirely. **{error}**'
	],

	characterNotFound: [
		'🕸️ **{input}**... nothing but silence. Don\'t waste my time.',
		'🕸️ **{input}** exists only in your imagination.',
		'🕸️ The spirits know nothing of **{input}**.',
		'🕸️ **{input}**? Your knowledge is lacking, mortal.',
		'🕸️ **{input}**... such ignorance.',
		'🕸️ I see no trace of **{input}** in the threads of fate.',
		'🕸️ **{input}**? The forest swallows such names whole.',
		'🕸️ **{input}** is a shadow with no corpse to cast it.',
		'🕸️ Even my thorns cannot reach someone named **{input}**.',
		'🕸️ Perhaps **{input}** wandered too deep, never to return.',
		'🕸️ No roots remember **{input}**.',
		'🕸️ **{input}** is dust in the wind—insignificant.',
		'🕸️ The curse laughs at such a name as **{input}**.',
		'🕸️ **{input}**? Nothing but bones gnawed by time.',
		'🕸️ I cast the name **{input}** into the bramble—nothing answers.',
		'🕸️ Fate does not bother weaving threads for **{input}**.'
	],

	characterNotFoundWithSuggestions: [
		'🕸️ **{input}** does not exist.\n*Perhaps you meant:*\n{suggestions}',
		'🕸️ **{input}**... unknown to me.\n*Did you mean:*\n{suggestions}',
		'🕸️ I know not of **{input}**.\n*These names whisper to me instead:*\n{suggestions}',
		'🕸️ **{input}** eludes me.\n*Consider these alternatives:*\n{suggestions}',
		'🕸️ **{input}** is but a dead leaf.\n*Try instead:*\n{suggestions}',
		'🕸️ **{input}** has no thread in fate.\n*The forest hums of these:*\n{suggestions}',
		'🕸️ The curse recoils from **{input}**.\n*Perhaps you mean:*\n{suggestions}',
		'🕸️ **{input}**? Empty soil.\n*But these might bloom:*\n{suggestions}',
		'🕸️ **{input}** fell to rot.\n*But these roots still live:*\n{suggestions}',
		'🕸️ The spirits do not whisper **{input}**.\n*Yet they murmur of:*\n{suggestions}',
		'🕸️ **{input}**? That seed never sprouted.\n*Try these:*\n{suggestions}',
		'🕸️ The bramble forgot **{input}**.\n*But it remembers:*\n{suggestions}'
	],

	queueFull: [
		'🕯 The spirits are overwhelmed... try again in a moment.',
		'🕯 My power has limits. Return when the forest is calmer.',
		'🕯 Too many voices call at once. Try again shortly.',
		'🕯 The magical threads are tangled. Wait and try again.',
		'🕯 Even I cannot handle such chaos. Return later.',
		'🕯 The forest is choking with requests—yours will wither for now.',
		'🕯 Even curses have limits… wait for the tangle to ease.',
		'🕯 Your voice is just one of many lost in the thicket.',
		'🕯 Too many fools pulled the vines at once. Wait.',
		'🕯 The curse snarls when overfed. Return later.',
		'🕯 The bramble has no room for one more thorn.',
		'🕯 The roots cannot drink from all cups at once.',
		'🕯 Patience—your turn will grow in the soil of time.',
		'🕯 The grove is too loud. Silence yourself awhile.',
		'🕯 Wait, or be lost among the tangled cries.'
	],

	queued: [
		'🧵 Your request for **{character}** drifts within the witch’s reach, waiting at **{position}**.',
		'🧵 **{character}** lingers in the cursed grove, your place marked at **{position}**.',
		'🧵 The forest whispers of **{character}**, your thread rests at **{position}**.',
		'🧵 **{character}** will answer when the briars part, your wait is **{position}**.',
		'🧵 Patience, the thorns have set your turn at **{position}**.',
		'🧵 The old trees remember **{character}**, your strand holds at **{position}**.',
		'🧵 **{character}** remains bound until the witch calls from **{position}**.',
		'🧵 Your voice drifts with others, **{character}** awaits at **{position}**.',
		'🧵 The mists coil around **{character}**, your time comes at **{position}**.',
		'🧵 Wait, the grove does not rush, **{character}** lies at **{position}**.',
		'🧵 **{character}** stirs faintly, your place is etched at **{position}**.',
		'🧵 The roots tighten near **{character}**, your wait is **{position}**.',
		'🧵 Shadows stretch across the path, your name lies at **{position}**.',
		'🧵 **{character}** rests beyond the briars, your turn is **{position}**.',
		'🧵 Remain still, the witch watches, your moment is **{position}**.'
	]
};

// Helper function to get random response
const getRandomResponse = (category, replacements = {}) => {
	const responses = BRIAR_RESPONSES[category];
	const randomResponse = responses[Math.floor(Math.random() * responses.length)];

	// Replace placeholders
	let message = randomResponse;
	for (const [key, value] of Object.entries(replacements)) {
		message = message.replace(new RegExp(`{${key}}`, 'g'), value);
	}

	return message;
};

let heroData = {};
let artifactData = {};
let artifactsById = {};

const cacheManager = new CacheManager({
	cacheDir: path.join(__dirname, '..', 'cache'),
	ttl: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
	maxCacheSize: 500
});

const rateLimiter = new RateLimiter({
	maxRetries: 12,
	baseDelay: 1000,
	maxDelay: 300000, // 5 minutes max
	jitterFactor: 0.15,
	circuitBreakerThreshold: 25, // More forgiving threshold
	circuitBreakerResetTime: 300000, // 5 minutes instead of 15
	circuitBreakerProbeChance: 0.3 // 30% probe chance when open
});

rateLimiter.on('circuitBreakerOpen', (data) => {
	console.log(`🔴 Circuit breaker OPEN: ${data.failures} failures (${data.reason})`);
});

rateLimiter.on('circuitBreakerHalfOpen', (data) => {
	console.log(`🟡 Circuit breaker HALF-OPEN: Testing API health`);
});

rateLimiter.on('circuitBreakerClose', (data) => {
	console.log(`🟢 Circuit breaker CLOSED: API recovered (${data.reason || 'timeout'})`);
});


const dataCache = new Map();
const CACHE_TTL = 1800000; // 30 minutes for API data
const MAX_CACHE_SIZE = 50;

function getCachedData(key) {
	const cached = dataCache.get(key);
	if (!cached) return null;

	if (Date.now() - cached.timestamp > CACHE_TTL) {
		dataCache.delete(key);
		return null;
	}

	return cached.data;
}

function setCachedData(key, data) {
	// Implement LRU-like behavior
	if (dataCache.size >= MAX_CACHE_SIZE) {
		const firstKey = dataCache.keys().next().value;
		dataCache.delete(firstKey);
	}

	dataCache.set(key, {
		data,
		timestamp: Date.now()
	});
}

// Enhanced rate limiting and queue system
const userRateLimit = new Map();
const RATE_LIMIT_REQUESTS = 3; // Max 3 requests
const RATE_LIMIT_WINDOW = 30000; // Per 30 seconds

// Command queue system - Sequential processing
const commandQueue = [];
const processingCommands = new Set();
const MAX_CONCURRENT_COMMANDS = 1; // Process 1 command at a time for true sequential behavior
const QUEUE_MAX_SIZE = 20; // Max queue size to prevent memory issues
let isProcessingQueue = false;

// Request deduplication system
const ongoingRequests = new Map(); // heroName -> { promise, requesters: [messages] }
const REQUEST_TIMEOUT = 120000; // 2 minutes timeout for ongoing requests

// Memory and performance tracking
let activeConnections = 0;
let lastMemoryCleanup = Date.now();
const MEMORY_CLEANUP_INTERVAL = 300000; // 5 minutes

// Input validation function
function validateAndSanitizeInput(input) {
	// Check length limits
	if (input.length > 100) {
		throw new Error('Input too long. Maximum 100 characters allowed.');
	}

	// Allow only alphanumeric characters, spaces, hyphens, apostrophes, and common punctuation
	const allowedPattern = /^[a-zA-Z0-9\s\-'.\+]+$/;
	if (!allowedPattern.test(input)) {
		throw new Error('Invalid characters in input. Only letters, numbers, spaces, hyphens, apostrophes, dots, and plus signs are allowed.');
	}

	// Sanitize by trimming and normalizing spaces
	return input.trim().replace(/\s+/g, ' ');
}

// Enhanced rate limiting function
function checkRateLimit(userId) {
	const now = Date.now();
	const userLimit = userRateLimit.get(userId);

	if (!userLimit) {
		userRateLimit.set(userId, { count: 1, lastReset: now });
		return { allowed: true, remainingRequests: RATE_LIMIT_REQUESTS - 1 };
	}

	// Reset if window has passed
	if (now - userLimit.lastReset > RATE_LIMIT_WINDOW) {
		userRateLimit.set(userId, { count: 1, lastReset: now });
		return { allowed: true, remainingRequests: RATE_LIMIT_REQUESTS - 1 };
	}

	// Check if under limit
	if (userLimit.count < RATE_LIMIT_REQUESTS) {
		userLimit.count++;
		return { allowed: true, remainingRequests: RATE_LIMIT_REQUESTS - userLimit.count };
	}

	const resetTime = Math.ceil((userLimit.lastReset + RATE_LIMIT_WINDOW - now) / 1000);
	return { allowed: false, resetTime };
}

// Command queue management
function addToQueue(commandData) {
	if (commandQueue.length >= QUEUE_MAX_SIZE) {
		return { success: false, reason: 'queue_full', position: -1 };
	}

	commandQueue.push(commandData);
	const position = commandQueue.length;

	// Always try to start queue processing
	// processQueue() will handle the case where it's already running
	setImmediate(processQueue);

	return { success: true, position };
}

async function processQueue() {
	if (isProcessingQueue || commandQueue.length === 0) return;

	isProcessingQueue = true;

	try {
		while (commandQueue.length > 0 && processingCommands.size < MAX_CONCURRENT_COMMANDS) {
			const commandData = commandQueue.shift();
			// Process command and wait for it to complete before continuing
			await processCommand(commandData);
		}
	} finally {
		isProcessingQueue = false;
		
		// Continue processing if there are more commands that were added while we were processing
		if (commandQueue.length > 0) {
			setImmediate(processQueue);
		}
	}
}

async function processCommand(commandData) {
	const { message, userInput, characterName, confidence, searchResult } = commandData;
	const userId = message.author.id;

	processingCommands.add(userId);
	activeConnections++;

	try {
		let loadingContent = `🌑   Revealing **${characterName}**...`;
		if (searchResult.matchType !== 'exact' || confidence < 100) {
			loadingContent = `🌒   A pale echo at a ${confidence}% match... Revealing **${characterName}**...`;
		}

		const loadingMessage = await message.reply(loadingContent);

		// Use deduplication system to handle the request
		const result = await getHeroWithDeduplication(characterName, loadingMessage);

		if (result && result.screenshot) {
			const attachment = new AttachmentBuilder(result.screenshot, {
				name: `${characterName.replace(/\s+/g, '_')}.png`
			});

			// Create appropriate message based on cache status
			let displayMessage = `☾   ${characterName}`;

			await loadingMessage.edit({
				content: displayMessage,
				files: [attachment]
			});
		} else if (result && result.noData) {
			// Character exists but no build data available
			await loadingMessage.edit(result.message);
		} else {
			await loadingMessage.edit(`❌ I called for **${characterName}**... no one answered.`);
		}

	} catch (error) {
		console.error('Error processing command:', error);
		try {
			await message.reply(`❌ The witch stirs... the search for **${characterName}** is lost.`);
		} catch (replyError) {
			console.error('Error sending error message:', replyError);
		}
	} finally {
		processingCommands.delete(userId);
		activeConnections--;

		// Periodic memory cleanup
		if (Date.now() - lastMemoryCleanup > MEMORY_CLEANUP_INTERVAL) {
			performMemoryCleanup();
		}
	}
}

/**
 * Handle hero request with deduplication
 * @param {string} heroName 
 * @param {Object} message - Discord message object
 * @returns {Promise<Buffer|null>}
 */
async function getHeroWithDeduplication(heroName, message) {
	const normalizedHeroName = heroName.toLowerCase().trim();

	// Check if there's already an ongoing request for this hero
	if (ongoingRequests.has(normalizedHeroName)) {
		const existingRequest = ongoingRequests.get(normalizedHeroName);
		existingRequest.requesters.push(message);

		try {
			// Wait for the existing request to complete
			const result = await existingRequest.promise;
			return result;
		} catch (error) {
			console.error(`❌ Deduplicated request failed for ${heroName}:`, error.message);
			return null;
		}
	}

	let timeoutId;

	const requestPromise = (async () => {
		// Set up timeout cleanup when processing actually starts
		timeoutId = setTimeout(() => {
			if (ongoingRequests.has(normalizedHeroName)) {
				console.warn(`⏰ Request timeout for ${heroName} after ${REQUEST_TIMEOUT / 1000}s, cleaning up`);
				ongoingRequests.delete(normalizedHeroName);
			}
		}, REQUEST_TIMEOUT);

		try {
			// Check fresh cache first
			let screenshot = cacheManager.getCachedHeroImage(heroName);

			if (screenshot) {
				console.log(`✅ Fresh cache hit for ${heroName}`);
				return { screenshot, fromCache: true, isStale: false };
			}

			// Generate new image if not cached
			const heroAnalysis = await analyzeHeroData(heroName);

			// If API failed or was blocked, try stale cache as fallback
			if (!heroAnalysis) {
				console.log(`⚠️  API failed for ${heroName}, checking for stale cache...`);
				const staleCache = cacheManager.getStaleCachedHeroImage(heroName);

				if (staleCache && staleCache.imageBuffer) {
					const daysOld = Math.floor(staleCache.age / (1000 * 60 * 60 * 24));
					console.log(`📦 Using stale cache for ${heroName} (${daysOld} days old)`);
					return {
						screenshot: staleCache.imageBuffer,
						fromCache: true,
						isStale: true,
						age: staleCache.age,
						daysOld
					};
				}

				console.error(`❌ No data available for ${heroName} (no fresh data, no stale cache)`);

				// Return a special indicator for "character exists but no data"
				return {
					noData: true,
					message: `🕸️   **${heroName}** lingers in the shadows... not enough data has been gathered yet.`
				};
			}

			screenshot = await generateReportImage(heroAnalysis);

			// Cache the generated image
			await cacheManager.cacheHeroImage(heroName, screenshot, heroAnalysis);

			return { screenshot, fromCache: false, isStale: false };

		} finally {
			// Clean up the ongoing request tracking and clear timeout
			ongoingRequests.delete(normalizedHeroName);
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		}
	})();

	// Store the request 
	const requestData = {
		promise: requestPromise,
		requesters: [message],
		startTime: Date.now()
	};

	ongoingRequests.set(normalizedHeroName, requestData);

	return requestPromise;
}

/**
 * Clean up expired ongoing requests
 */
function cleanupExpiredRequests() {
	const now = Date.now();
	let cleanedCount = 0;

	for (const [heroName, requestData] of ongoingRequests.entries()) {
		if (now - requestData.startTime > REQUEST_TIMEOUT) {
			console.warn(`🧹 Cleaning up expired request for ${heroName}`);
			ongoingRequests.delete(heroName);
			cleanedCount++;
		}
	}


	return cleanedCount;
}

// Memory cleanup function
function performMemoryCleanup() {
	lastMemoryCleanup = Date.now();

	// Clean old rate limit entries
	const now = Date.now();
	for (const [userId, data] of userRateLimit.entries()) {
		if (now - data.lastReset > RATE_LIMIT_WINDOW * 2) {
			userRateLimit.delete(userId);
		}
	}

	// Clean expired cache entries
	const expiredCount = cacheManager.cleanupExpiredEntries();

	// Clean expired ongoing requests
	cleanupExpiredRequests();

	// Force garbage collection if available
	if (global.gc) {
		global.gc();
	}
}

const HERO_CACHE = "https://e7-optimizer-game-data.s3-accelerate.amazonaws.com/herodata.json";
const ARTIFACT_CACHE = "https://e7-optimizer-game-data.s3-accelerate.amazonaws.com/artifactdata.json";
const BUILDS_API = "https://krivpfvxi0.execute-api.us-west-2.amazonaws.com/dev/getBuilds";
const BUILDS_API_ALTERNATIVES = [
	"https://krivpfvxi0.execute-api.us-west-2.amazonaws.com/dev/getBuilds",
	"https://krivpfvxi0.execute-api.us-west-2.amazonaws.com/prod/getBuilds",
	"https://krivpfvxi0.execute-api.us-west-2.amazonaws.com/stage/getBuilds",
	"https://krivpfvxi0.execute-api.us-west-2.amazonaws.com/beta/getBuilds",
	"https://krivpfvxi0.execute-api.us-west-2.amazonaws.com/v1/getBuilds",
	"https://krivpfvxi0.execute-api.us-west-2.amazonaws.com/api/getBuilds"
];

// HARDCORE BYPASS CONFIGURATION - Maximum Aggression
const USER_AGENTS = [
	// Modern Chrome variations with different builds
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	// Firefox variations
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
	// Safari variations
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
	// Edge variations
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
	// Mobile browsers
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
	'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
	// Curl/wget to appear as different tool types
	'curl/7.68.0',
	'Wget/1.20.3 (linux-gnu)',
	// Bot-like but legitimate
	'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
	'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
];

const FORWARDED_IPS = [
	// Major DNS providers
	'1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4', '4.4.4.4', '4.4.8.8',
	'208.67.222.222', '208.67.220.220', '9.9.9.9', '149.112.112.112',
	'76.76.19.19', '76.223.100.101', '94.140.14.14', '94.140.15.15',
	// Major cloud provider IPs
	'54.239.28.85', '52.95.110.1', '13.107.42.14', '40.90.4.200',
	'104.16.249.249', '104.16.248.249', '172.67.221.168', '104.21.2.70',
	// Corporate/University IPs that look legitimate
	'129.250.35.250', '198.6.1.4', '192.5.6.30', '199.7.83.42',
	'128.8.126.63', '171.67.193.20', '192.36.148.17', '199.232.41.5'
];

// Geographic IP ranges for more realistic spoofing
const IP_RANGES = {
	US: ['173.252.0.0/16', '31.13.24.0/21', '66.220.144.0/20', '69.63.176.0/20'],
	EU: ['185.60.216.0/22', '185.89.218.0/23', '31.13.64.0/18', '31.13.72.0/21'],
	ASIA: ['103.4.96.0/22', '179.60.192.0/22', '185.89.216.0/22', '199.201.64.0/22']
};

// Common corporate/educational domains for referrer diversity
const REFERRER_DOMAINS = [
	'https://github.com/fribbels/',
	'https://epic7x.com/',
	'https://reddit.com/r/EpicSeven',
	'https://gamepress.gg/epicseven',
	'https://google.com/search',
	'https://bing.com/search',
	'https://duckduckgo.com/',
	'https://yandex.com/search',
	'https://baidu.com/s',
	'https://fribbels.github.io',
	'https://fribbels.github.io/e7',
	'https://fribbels.github.io/e7/hero-library.html'
];

let requestCounter = 0;

function getRandomElement(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomIP() {
	return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join('.');
}

// Generate realistic IP from CIDR ranges
function generateRealisticIP(region = 'US') {
	const ranges = IP_RANGES[region] || IP_RANGES.US;
	const range = getRandomElement(ranges);
	const [network, mask] = range.split('/');
	const [a, b, c, d] = network.split('.').map(Number);
	const maskBits = parseInt(mask);
	const hostBits = 32 - maskBits;
	const maxHosts = Math.pow(2, hostBits) - 2;
	const randomHost = Math.floor(Math.random() * maxHosts) + 1;

	// Simple CIDR generation (not perfect but good enough for spoofing)
	const newD = (d + randomHost) % 256;
	const newC = (c + Math.floor((d + randomHost) / 256)) % 256;
	return `${a}.${b}.${newC}.${newD}`;
}

// Generate session tokens to appear as different authenticated users
function generateSessionToken() {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	return Array.from({ length: 32 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// Generate request ID to appear as different requests
function generateRequestId() {
	return 'req_' + Math.random().toString(36).substr(2, 16) + '_' + Date.now();
}

// Advanced encoding and parameter manipulation functions
function urlEncodeRandom(str) {
	// Partially encode the string to create mismatch between rate limiting and processing
	const chars = str.split('');
	const encodableChars = /[a-zA-Z0-9]/;

	return chars.map((char, index) => {
		if (encodableChars.test(char) && Math.random() < 0.3) { // 30% chance to encode
			return '%' + char.charCodeAt(0).toString(16).padStart(2, '0');
		}
		return char;
	}).join('');
}

function addNullByteVariation(str) {
	// Add null bytes or other special characters to create processing mismatch
	const variations = ['%00', '%20', '%09', '%0d', '%0a'];
	const variation = getRandomElement(variations);

	// Add at random position
	if (Math.random() < 0.5) {
		return str + variation; // Append
	} else {
		return variation + str; // Prepend
	}
}

function addRandomParameters(url) {
	// Add random parameters to make requests appear unique
	const separator = url.includes('?') ? '&' : '?';
	const randomParams = [
		`_t=${Date.now()}`,
		`_r=${Math.random().toString(36).substr(2, 9)}`,
		`cache=${Math.floor(Math.random() * 1000)}`,
		`v=${Math.floor(Math.random() * 100)}`
	];

	const numParams = Math.floor(Math.random() * 3) + 1; // 1-3 random params
	const selectedParams = randomParams.sort(() => 0.5 - Math.random()).slice(0, numParams);

	return url + separator + selectedParams.join('&');
}

// HARDCORE AGGRESSIVE RATE LIMIT DESTROYER
async function getPopularBuilds(heroName, retryCount = 0) {
	try {
		// Check if we should attempt the request
		const requestCheck = rateLimiter.shouldAttemptRequest();
		if (!requestCheck.allowed) {
			console.log(`⚠️  Circuit breaker blocked request for ${heroName}: ${requestCheck.reason}`);
			return {
				data: [],
				blocked: true,
				reason: requestCheck.reason
			};
		}

		if (requestCheck.reason !== 'healthy') {
			console.log(`ℹ️  Request for ${heroName} allowed: ${requestCheck.reason}`);
		}


		// Use intelligent backoff delay if this is a retry
		if (retryCount > 0) {
			const delay = rateLimiter.calculateDelay(retryCount - 1);
			const explanation = rateLimiter.getStrategyExplanation(retryCount - 1, delay);
			await new Promise(resolve => setTimeout(resolve, delay));
		}

		requestCounter++;

		// Vary browser fingerprints for natural traffic patterns
		const region = getRandomElement(['US', 'EU', 'ASIA', 'OCEANIA', 'AFRICA', 'SOUTH_AMERICA']);

		// Advanced fingerprint randomization
		const browserFingerprint = {
			chrome: getRandomElement(['119.0.0.0', '120.0.0.0', '121.0.0.0', '122.0.0.0']),
			firefox: getRandomElement(['109.0', '110.0', '111.0', '112.0']),
			safari: getRandomElement(['16.6', '17.0', '17.1', '17.2']),
			edge: getRandomElement(['119.0.0.0', '120.0.0.0', '121.0.0.0'])
		};

		// Clean, reliable URL - no manipulation needed
		let requestUrl = BUILDS_API;

		// Clean hero name - no corruption
		let processedHeroName = heroName;

		// ULTIMATE HEADER ARSENAL - Advanced browser simulation + ML evasion
		const selectedBrowser = getRandomElement(['chrome', 'firefox', 'safari', 'edge']);
		const browserVersion = browserFingerprint[selectedBrowser];

		// Generate realistic User-Agent based on selected browser
		const generateBrowserUA = (browser, version) => {
			const osVariants = {
				chrome: [
					`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`,
					`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`,
					`Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
				],
				firefox: [
					`Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${version}) Gecko/20100101 Firefox/${version}`,
					`Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:${version}) Gecko/20100101 Firefox/${version}`,
					`Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:${version}) Gecko/20100101 Firefox/${version}`
				],
				safari: [
					`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Safari/605.1.15`,
					`Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Mobile/15E148 Safari/604.1`
				],
				edge: [
					`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36 Edg/${version}`,
					`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36 Edg/${version}`
				]
			};
			return getRandomElement(osVariants[browser]);
		};

		const aggressiveHeaders = {
			'Content-Type': getRandomElement([
				'text/plain',
				'application/x-www-form-urlencoded',
				'text/plain; charset=utf-8',
				'application/json; charset=utf-8',
				'multipart/form-data'
			]),
			'Accept': getRandomElement([
				'application/json, text/plain, */*',
				'application/json',
				'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
				'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'*/*'
			]),
			'Accept-Language': getRandomElement([
				'en-US,en;q=0.9',
				'en-US,en;q=0.8,fr;q=0.6,de;q=0.4',
				'en-GB,en;q=0.9,fr;q=0.8',
				'zh-CN,zh;q=0.9,en;q=0.8',
				'ja,en-US;q=0.9,en;q=0.8',
				'ko,en-US;q=0.9,en;q=0.8',
				'es-ES,es;q=0.9,en;q=0.8'
			]),
			'Accept-Encoding': getRandomElement(['gzip, deflate, br', 'gzip, deflate', 'br, gzip, deflate']),
			'Origin': getRandomElement([
				'https://fribbels.github.io',
				'https://github.com',
				'https://epic7x.com',
				'https://gamepress.gg',
				'null'
			]),
			'User-Agent': generateBrowserUA(selectedBrowser, browserVersion),
			'Referer': getRandomElement([
				'https://fribbels.github.io/e7-gear-optimizer/',
				'https://epic7x.com/characters/',
				'https://gamepress.gg/epic7/',
				'https://github.com/fribbels/e7-gear-optimizer',
				'https://www.google.com/',
				'https://duckduckgo.com/'
			]),
			'Cache-Control': getRandomElement(['no-cache', 'max-age=0', 'no-store', 'must-revalidate', 'public, max-age=0']),
			'Pragma': getRandomElement(['no-cache', 'cache']),
			'DNT': getRandomElement(['1', '0']),

			// Enhanced browser fingerprinting headers
			'Sec-Fetch-Dest': getRandomElement(['empty', 'document', 'script', 'fetch']),
			'Sec-Fetch-Mode': getRandomElement(['cors', 'navigate', 'no-cors', 'same-origin']),
			'Sec-Fetch-Site': getRandomElement(['cross-site', 'same-origin', 'same-site', 'none']),
			'Sec-Fetch-User': getRandomElement(['?1', undefined]),
			'Sec-Ch-Ua': `"${selectedBrowser}";v="${browserVersion.split('.')[0]}", "Chromium";v="${browserVersion.split('.')[0]}", "Not_A Brand";v="8"`,
			'Sec-Ch-Ua-Mobile': getRandomElement(['?0', '?1']),
			'Sec-Ch-Ua-Platform': getRandomElement(['"Windows"', '"macOS"', '"Linux"', '"Android"', '"iOS"']),

			// Session and auth spoofing
			'X-Requested-With': getRandomElement(['XMLHttpRequest', 'fetch', undefined]),
			'X-Browser-Version': browserVersion,
			'X-Client-Version': getRandomElement(['1.0.0', '1.1.0', '2.0.0', '2.1.0']),
			'X-Request-ID': generateRequestId(),
			'X-Session-Token': generateSessionToken(),
			'X-CSRF-Token': Math.random().toString(36).substr(2, 32),

			// Timing headers to appear more legitimate
			'X-Timestamp': Date.now().toString(),
			'X-Client-Time': new Date().toISOString(),

			// Device fingerprinting
			'X-Device-ID': Math.random().toString(36).substr(2, 16),
			'X-Screen-Resolution': getRandomElement(['1920x1080', '1366x768', '1440x900', '2560x1440']),
			'X-Timezone': getRandomElement(['America/New_York', 'Europe/London', 'Asia/Tokyo', 'America/Los_Angeles']),
		};

		// EXTREME IP SPOOFING - All possible headers + realistic geographic IPs
		const ALL_IP_HEADERS = [
			'X-Forwarded-For', 'X-Real-IP', 'X-Originating-IP', 'Client-IP', 'X-Client-IP',
			'X-Cluster-Client-IP', 'X-Remote-IP', 'X-Remote-Addr', 'X-ProxyUser-Ip',
			'CF-Connecting-IP', 'True-Client-IP', 'X-Azure-ClientIP', 'X-Forwarded-Host',
			'Forwarded', 'Via', 'X-Coming-From', 'X-Sucuri-ClientIP', 'X-Sucuri-Country'
		];

		// Apply 3-8 random IP headers for maximum confusion
		const numIpHeaders = Math.floor(Math.random() * 6) + 3; // 3-8 headers
		const selectedIpHeaders = ALL_IP_HEADERS.sort(() => 0.5 - Math.random()).slice(0, numIpHeaders);

		selectedIpHeaders.forEach((header, index) => {
			let ip;
			if (index === 0) {
				// First header gets a highly legitimate IP
				ip = getRandomElement(FORWARDED_IPS);
			} else if (Math.random() < 0.6) {
				// 60% chance of realistic regional IP
				ip = generateRealisticIP(region);
			} else {
				// 40% chance of random IP
				ip = generateRandomIP();
			}

			// Some headers need special formatting
			if (header === 'Forwarded') {
				aggressiveHeaders[header] = `for=${ip};proto=https;by=${generateRandomIP()}`;
			} else if (header === 'Via') {
				aggressiveHeaders[header] = `1.1 ${ip} (CloudFront)`;
			} else {
				aggressiveHeaders[header] = ip;
			}
		});

		// Standard HTTP method - reliable
		const method = 'POST';


		// Clean, reliable axios configuration
		const axiosConfig = {
			method: method,
			url: requestUrl,
			data: processedHeroName,
			headers: aggressiveHeaders,
			timeout: 25000,
			maxRedirects: 10,

			// Standard connection management
			httpAgent: new (require('http').Agent)({
				keepAlive: true,
				maxSockets: 5,
				timeout: 25000
			}),
			httpsAgent: new (require('https').Agent)({
				keepAlive: true,
				maxSockets: 5,
				timeout: 25000
			}),

			// Response handling
			validateStatus: (status) => status >= 200 && status < 500,
			transformResponse: [(data) => {
				try {
					return typeof data === 'string' ? JSON.parse(data) : data;
				} catch {
					return data;
				}
			}]
		};

		const response = await axios(axiosConfig);

		// Enhanced response data handling with better validation
		let data;
		if (response.data && typeof response.data === 'object') {
			if (Array.isArray(response.data)) {
				// Response is directly an array
				data = { data: response.data };
			} else if (response.data.data && Array.isArray(response.data.data)) {
				// Response has nested data property
				data = response.data;
			} else if (response.data.builds && Array.isArray(response.data.builds)) {
				// Alternative structure with 'builds' property
				data = { data: response.data.builds };
			} else {
				// Fallback: try to extract any array-like property
				const arrayProp = Object.values(response.data).find(val => Array.isArray(val));
				data = arrayProp ? { data: arrayProp } : { data: [] };
			}
		} else {
			data = { data: [] };
		}


		// Update rate limiter with success
		rateLimiter.updateApiHealth(200);

		return data;

	} catch (error) {
		const status = error.response?.status;
		console.error(`API fetch failed for ${heroName}:`, {
			status,
			message: error.message,
			code: error.code,
			timeout: error.code === 'ECONNABORTED',
			retryCount
		});

		// Update rate limiter with the error status
		rateLimiter.updateApiHealth(status);

		if (status === 404) {
			console.warn(`   ⚠️ No build data available for hero: ${heroName}`);
			return { data: [] };
		}

		// Use intelligent retry logic for all error types
		if ((status === 403 || status === 429 || !status) && retryCount < rateLimiter.config.maxRetries) {
			const errorType = status === 403 ? 'FORBIDDEN' : status === 429 ? 'RATE LIMITED' : 'NETWORK ERROR';
			console.warn(`   🚫 ${errorType} ${heroName} (attempt ${retryCount + 1}/${rateLimiter.config.maxRetries})`);

			return getPopularBuilds(heroName, retryCount + 1);
		} else {
			console.warn(`   💀 MAX RETRIES REACHED for ${heroName} after ${retryCount + 1} attempts`);

			// Log current rate limiter health for debugging
			const health = rateLimiter.getHealthStats();

			return { data: [] };
		}
	}
}

// Build data processing function from epic7-build-analyzer
function processBuildData(rawBuilds, heroData, artifactData) {
	// Enhanced validation for rawBuilds structure
	if (!rawBuilds ||
		!rawBuilds.data ||
		!Array.isArray(rawBuilds.data) ||
		rawBuilds.data.length === 0) {
		return { builds: [], stats: null };
	}

	// Create artifact code to name mapping
	const artifactCodeToName = {};
	for (const [name, data] of Object.entries(artifactData)) {
		if (data.code) {
			artifactCodeToName[data.code] = name;
		}
	}

	const builds = rawBuilds.data.map((build, index) => {
		// Convert string stats to numbers
		const stats = {
			rank: index + 1,
			atk: parseInt(build.atk),
			def: parseInt(build.def),
			hp: parseInt(build.hp),
			spd: parseInt(build.spd),
			chc: parseInt(build.chc), // crit chance
			chd: parseInt(build.chd), // crit damage
			eff: parseInt(build.eff),
			efr: parseInt(build.efr), // effect resistance
			gs: parseInt(build.gs),   // gear score
			sets: build.sets,
			artifactCode: build.artifactCode,
			artifactName: artifactCodeToName[build.artifactCode] || build.artifactName || 'Unknown'
		};

		return stats;
	});

	// Sort by gear score descending
	builds.sort((a, b) => b.gs - a.gs);

	// Update ranks after sorting
	builds.forEach((build, index) => {
		build.rank = index + 1;
	});

	// Calculate aggregate statistics
	const stats = calculateAggregateStats(builds);

	return { builds, stats };
}

function calculateAggregateStats(builds) {
	if (builds.length === 0) return null;

	const statKeys = ['atk', 'def', 'hp', 'spd', 'chc', 'chd', 'eff', 'efr', 'gs'];

	const stats = {};

	for (const key of statKeys) {
		const values = builds.map(build => build[key]).filter(val => !isNaN(val));
		if (values.length > 0) {
			stats[key] = {
				min: Math.min(...values),
				max: Math.max(...values),
				avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
				median: calculateMedian(values)
			};
		}
	}

	// Set popularity analysis
	stats.setPopularity = analyzeSetPopularity(builds);
	stats.artifactPopularity = analyzeArtifactPopularity(builds);

	return stats;
}

function calculateMedian(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ?
		Math.round((sorted[mid - 1] + sorted[mid]) / 2) :
		sorted[mid];
}

function analyzeSetPopularity(builds) {
	const setCombos = {};
	const total = builds.length;

	for (const build of builds) {
		const setsStr = JSON.stringify(convertToFullSets(build.sets));
		setCombos[setsStr] = (setCombos[setsStr] || 0) + 1;
	}

	return Object.entries(setCombos)
		.map(([sets, count]) => ({
			sets: JSON.parse(sets),
			count,
			percentage: Math.round((count / total) * 100 * 10) / 10
		}))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);
}

function analyzeArtifactPopularity(builds) {
	const artifactCounts = {};

	// Filter out builds with Unknown artifacts for accurate statistics
	const validBuilds = builds.filter(build => build.artifactName && build.artifactName !== 'Unknown');
	const total = validBuilds.length;

	if (total === 0) {
		return [];
	}

	for (const build of validBuilds) {
		const artifact = build.artifactName;
		artifactCounts[artifact] = (artifactCounts[artifact] || 0) + 1;
	}

	return Object.entries(artifactCounts)
		.map(([name, count]) => ({
			name,
			count,
			percentage: Math.round((count / total) * 100 * 10) / 10
		}))
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);
}

const SET_ASSETS = {
	"set_acc": path.join(__dirname, '..', 'assets', 'sethit.png'),
	"set_att": path.join(__dirname, '..', 'assets', 'setattack.png'),
	"set_coop": path.join(__dirname, '..', 'assets', 'setunity.png'),
	"set_counter": path.join(__dirname, '..', 'assets', 'setcounter.png'),
	"set_cri_dmg": path.join(__dirname, '..', 'assets', 'setdestruction.png'),
	"set_cri": path.join(__dirname, '..', 'assets', 'setcritical.png'),
	"set_def": path.join(__dirname, '..', 'assets', 'setdefense.png'),
	"set_immune": path.join(__dirname, '..', 'assets', 'setimmunity.png'),
	"set_max_hp": path.join(__dirname, '..', 'assets', 'sethealth.png'),
	"set_penetrate": path.join(__dirname, '..', 'assets', 'setpenetration.png'),
	"set_rage": path.join(__dirname, '..', 'assets', 'setrage.png'),
	"set_res": path.join(__dirname, '..', 'assets', 'setresist.png'),
	"set_revenge": path.join(__dirname, '..', 'assets', 'setrevenge.png'),
	"set_reversal": path.join(__dirname, '..', 'assets', 'setreversal.png'),
	"set_riposte": path.join(__dirname, '..', 'assets', 'setriposte.png'),
	"set_scar": path.join(__dirname, '..', 'assets', 'setinjury.png'),
	"set_speed": path.join(__dirname, '..', 'assets', 'setspeed.png'),
	"set_vampire": path.join(__dirname, '..', 'assets', 'setlifesteal.png'),
	"set_shield": path.join(__dirname, '..', 'assets', 'setprotection.png'),
	"set_torrent": path.join(__dirname, '..', 'assets', 'settorrent.png')
};

const STAT_ICONS = {
	atk: path.join(__dirname, '..', 'assets', 'statatk.png'),
	def: path.join(__dirname, '..', 'assets', 'statdef.png'),
	hp: path.join(__dirname, '..', 'assets', 'stathp.png'),
	spd: path.join(__dirname, '..', 'assets', 'statspd.png'),
	chc: path.join(__dirname, '..', 'assets', 'statcr.png'),
	chd: path.join(__dirname, '..', 'assets', 'statcd.png'),
	eff: path.join(__dirname, '..', 'assets', 'stateff_dt.png'),
	efr: path.join(__dirname, '..', 'assets', 'statres.png'),
	gs: path.join(__dirname, '..', 'assets', 'star.png')
};

// Load game data with retry mechanism
async function loadGameData(retryCount = 0) {
	const maxRetries = 3;
	try {
		const heroResponse = await fetch(HERO_CACHE, {
			timeout: 10000,
			headers: {
				'User-Agent': 'briar-bot/1.0'
			}
		});
		if (!heroResponse.ok) throw new Error(`Hero data fetch failed: ${heroResponse.status}`);
		const fetchedHeroData = await heroResponse.json();
		
		// Clear existing data and populate with new data
		Object.keys(heroData).forEach(key => delete heroData[key]);
		Object.assign(heroData, fetchedHeroData);

		const artifactResponse = await fetch(ARTIFACT_CACHE, {
			timeout: 10000,
			headers: {
				'User-Agent': 'briar-bot/1.0'
			}
		});
		if (!artifactResponse.ok) throw new Error(`Artifact data fetch failed: ${artifactResponse.status}`);
		const fetchedArtifactData = await artifactResponse.json();
		
		// Clear existing data and populate with new data
		Object.keys(artifactData).forEach(key => delete artifactData[key]);
		Object.assign(artifactData, fetchedArtifactData);

		// Clear and rebuild artifactsById mapping
		Object.keys(artifactsById).forEach(key => delete artifactsById[key]);
		for (const name of Object.keys(artifactData)) {
			artifactsById[artifactData[name].code] = name;
		}

	} catch (error) {
		console.error('Error loading game data:', error);
		if (retryCount < maxRetries) {
			console.log(`Retrying in ${(retryCount + 1) * 2} seconds... (${retryCount + 1}/${maxRetries})`);
			await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
			return loadGameData(retryCount + 1);
		}
		console.error('Failed to load game data after all retries');
	}
}


function convertToFullSets(sets) {
	const fourPieceSets = ["set_att", "set_counter", "set_cri_dmg", "set_rage", "set_revenge", "set_reversal", "set_riposte", "set_scar", "set_speed", "set_vampire", "set_shield"];
	const result = {};

	for (const [setName, count] of Object.entries(sets)) {
		if (fourPieceSets.includes(setName)) {
			if (count > 3) {
				result[setName] = 4;
			}
		} else if (count === 6) {
			result[setName] = 6;
		} else if (count >= 4) {
			result[setName] = 4;
		} else if (count >= 2) {
			result[setName] = 2;
		}
	}
	return result;
}

// Map set codes to display names
const SET_NAMES = {
	"set_speed": "Speed",
	"set_acc": "Hit",
	"set_att": "Attack",
	"set_cri": "Critical",
	"set_cri_dmg": "Destruction",
	"set_def": "Defense",
	"set_immune": "Immunity",
	"set_max_hp": "Health",
	"set_penetrate": "Penetration",
	"set_rage": "Rage",
	"set_res": "Resist",
	"set_revenge": "Revenge",
	"set_reversal": "Reversal",
	"set_riposte": "Riposte",
	"set_scar": "Injury",
	"set_vampire": "Lifesteal",
	"set_shield": "Protection",
	"set_torrent": "Torrent",
	"set_coop": "Unity",
	"set_counter": "Counter"
};

// Define which sets are 2-piece vs 4-piece
const TWO_PIECE_SETS = new Set([
	"set_cri", "set_acc", "set_max_hp", "set_def", "set_res",
	"set_immune", "set_coop", "set_penetrate", "set_torrent"
]);

const FOUR_PIECE_SETS = new Set([
	"set_speed", "set_att", "set_shield", "set_cri_dmg", "set_counter",
	"set_vampire", "set_rage", "set_revenge", "set_reversal", "set_riposte", "set_scar"
]);

// Function to create a broken set icon using the asset
function createBrokenIcon() {
	const brokenPath = path.join(__dirname, '..', 'assets', 'setbroken.png');
	if (fs.existsSync(brokenPath)) {
		const imageBuffer = fs.readFileSync(brokenPath);
		const imageBase64 = imageBuffer.toString('base64');
		const dataUrl = `data:image/png;base64,${imageBase64}`;
		return `<div class="set-combo"><img src="${dataUrl}" class="set-icon"></div>`;
	}
	// Fallback if setbroken.png doesn't exist
	return `<div class="set-combo broken-icon">?</div>`;
}

function generateSetHTML(sets) {
	const fullSets = convertToFullSets(sets);
	const setNames = [];
	let iconsHtml = '';
	let totalIcons = 0;
	let gearPiecesUsed = 0;
	const maxIcons = 3;

	// Process each set and create appropriate number of icons
	for (const [setCode, count] of Object.entries(fullSets)) {
		if (totalIcons >= maxIcons) break;

		const assetPath = SET_ASSETS[setCode];
		const setName = SET_NAMES[setCode] || "Unknown";
		const isTwoPiece = TWO_PIECE_SETS.has(setCode);
		const isFourPiece = FOUR_PIECE_SETS.has(setCode);

		if (assetPath && fs.existsSync(assetPath)) {
			// Convert image to base64 data URL
			const imageBuffer = fs.readFileSync(assetPath);
			const imageBase64 = imageBuffer.toString('base64');
			const imageMimeType = 'image/png';
			const dataUrl = `data:${imageMimeType};base64,${imageBase64}`;

			// Calculate how many icons to show for this set and gear pieces used
			let iconsToShow = 0;
			let piecesUsed = 0;

			if (isTwoPiece && count >= 2) {
				// For 2-piece sets: show one icon per 2-piece bonus
				iconsToShow = Math.floor(count / 2);
				piecesUsed = iconsToShow * 2;
			} else if (isFourPiece && count >= 4) {
				// For 4-piece sets: show one icon per 4-piece bonus
				iconsToShow = Math.floor(count / 4);
				piecesUsed = iconsToShow * 4;
			}

			// Add icons up to the limit
			for (let i = 0; i < iconsToShow && totalIcons < maxIcons; i++) {
				iconsHtml += `<div class="set-combo"><img src="${dataUrl}" class="set-icon"></div>`;
				totalIcons++;
			}

			gearPiecesUsed += piecesUsed;

			if (iconsToShow > 0) {
				setNames.push(setName);
			}
		}
	}

	// Calculate remaining gear pieces (out of 6 total)
	const remainingPieces = 6 - gearPiecesUsed;

	// Add broken icons for remaining gear pieces (each broken icon represents 2 pieces)
	if (remainingPieces > 0 && totalIcons < maxIcons) {
		const brokenIconsNeeded = Math.min(
			Math.ceil(remainingPieces / 2),
			maxIcons - totalIcons
		);

		for (let i = 0; i < brokenIconsNeeded; i++) {
			iconsHtml += createBrokenIcon();
			totalIcons++;
		}

		if (brokenIconsNeeded > 0) {
			setNames.push("Broken");
		}
	}

	// Create set name text
	let setNameText = '';
	if (setNames.length === 0) {
		setNameText = 'Broken';
	} else if (setNames.length === 1 && !setNames.includes("Broken")) {
		setNameText = setNames[0];
	} else {
		setNameText = setNames.join('/');
	}

	if (iconsHtml) {
		const setClass = totalIcons === 1 ? 'single-set' : 'multi-set';
		return `
			<div class="set-icons-group ${setClass}">
				${iconsHtml}
			</div>
			<span class="set-name">${setNameText}</span>
		`;
	}

	return '<span class="broken-sets">Broken</span>';
}

async function analyzeHeroData(heroName, retryCount = 0) {
	// Check cache first
	const cacheKey = `hero_${heroName.toLowerCase()}`;
	const cachedResult = getCachedData(cacheKey);
	if (cachedResult) {
		console.log(`📋 Memory cache hit for ${heroName}`);
		return cachedResult;
	}

	try {
		// Find the correct hero name (case insensitive)
		const heroKeys = Object.keys(heroData);
		const matchedHero = heroKeys.find(key =>
			key.toLowerCase() === heroName.toLowerCase() ||
			heroData[key].name?.toLowerCase() === heroName.toLowerCase()
		);

		// Use the matched hero name or the original if no match found
		const actualHeroName = matchedHero ? heroData[matchedHero].name || matchedHero : heroName;

		console.log(`🔍 Hero name mapping: "${heroName}" -> "${actualHeroName}" (matched: ${!!matchedHero})`);

		// Try the API with the mapped name
		let rawBuilds = await getPopularBuilds(actualHeroName);

		// Handle circuit breaker blocking with retry
		if (rawBuilds.blocked && retryCount < 2) {
			const waitTime = retryCount === 0 ? 2000 : 5000; // 2s first retry, 5s second retry
			console.log(`🔄 Circuit breaker blocked, retrying in ${waitTime / 1000}s (attempt ${retryCount + 1}/2)...`);
			await new Promise(resolve => setTimeout(resolve, waitTime));
			return analyzeHeroData(heroName, retryCount + 1);
		}

		// If we got empty data but successfully mapped a hero, try once more
		if ((!rawBuilds.data || rawBuilds.data.length === 0) && matchedHero && retryCount === 0) {
			console.log(`🔄 Retrying for ${actualHeroName} - valid hero mapping but got empty data`);
			await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
			return analyzeHeroData(heroName, retryCount + 1);
		}

		// Process the build data
		const buildData = processBuildData(rawBuilds, heroData, artifactData);

		// If we got no valid build data, return null to trigger stale cache fallback
		if (!buildData.stats) {
			console.log(`⚠️  No valid build data for ${actualHeroName} - stats is null`);
			return null;
		}

		const result = {
			heroName: actualHeroName,
			totalBuilds: rawBuilds?.data?.length || 0,
			topSets: buildData.stats.setPopularity?.slice(0, 3).map(set => ({
				sets: set.sets,
				percentage: set.percentage.toString()
			})) || [],
			topArtifacts: buildData.stats.artifactPopularity?.slice(0, 3).map(artifact => ({
				name: artifact.name,
				percentage: artifact.percentage.toString(),
				code: ''
			})) || [],
			avgStats: {
				atk: buildData.stats.atk?.avg || 0,
				def: buildData.stats.def?.avg || 0,
				hp: buildData.stats.hp?.avg || 0,
				spd: buildData.stats.spd?.avg || 0,
				chc: buildData.stats.chc?.avg || 0,
				chd: buildData.stats.chd?.avg || 0,
				eff: buildData.stats.eff?.avg || 0,
				efr: buildData.stats.efr?.avg || 0,
				gs: buildData.stats.gs?.avg || 0
			}
		};

		// Cache the result
		setCachedData(cacheKey, result);

		return result;

	} catch (error) {
		console.error('Error fetching hero data:', error);
		return null;
	}
}

async function generateHTML(data) {
	const heroImageUrl = getHeroImageUrl(data.heroName, heroData);

	// Convert stat icons to base64 data URLs
	const statIconDataUrls = {};
	for (const [statKey, iconPath] of Object.entries(STAT_ICONS)) {
		if (fs.existsSync(iconPath)) {
			const imageBuffer = fs.readFileSync(iconPath);
			const imageBase64 = imageBuffer.toString('base64');
			statIconDataUrls[statKey] = `data:image/png;base64,${imageBase64}`;
		}
	}

	// Convert Briar Bot watermark to base64
	const watermarkPath = path.join(__dirname, '..', 'assets', 'briar-bot.png');
	let watermarkDataUrl = '';
	if (fs.existsSync(watermarkPath)) {
		const watermarkBuffer = fs.readFileSync(watermarkPath);
		const watermarkBase64 = watermarkBuffer.toString('base64');
		watermarkDataUrl = `data:image/png;base64,${watermarkBase64}`;
	}

	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
        
		html, body {
			margin: 0;
			padding: 0;
			background: transparent;
		}
        
		body {
			font-family: 'Segoe UI', 'San Francisco', -apple-system, BlinkMacSystemFont, sans-serif;
			width: 600px;
			height: 975px; /* Fixed height instead of min-height */
			background: linear-gradient(145deg, #1a1d3a 0%, #2a2d5a 25%, #1e2142 50%, #151829 75%, #0f1020 100%);
			border-radius: 24px;
			box-shadow: 
				0 25px 50px rgba(0, 0, 0, 0.6),
				0 0 0 1px rgba(255, 255, 255, 0.1),
				inset 0 1px 0 rgba(255, 255, 255, 0.1);
			color: #ffffff;
			padding: 30px;
			position: relative;
			overflow: hidden;
		}
        
		body::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: 
				radial-gradient(circle at 20% 20%, rgba(120, 150, 255, 0.1) 0%, transparent 50%),
				radial-gradient(circle at 80% 80%, rgba(255, 120, 200, 0.08) 0%, transparent 50%);
			pointer-events: none;
			border-radius: 24px;
		}
        
		.watermark-container {
			position: absolute;
			top: 20px;
			right: 20px;
			display: flex;
			align-items: center;
			gap: 8px;
			z-index: 10;
		}
        
		.watermark {
			width: 35px;
			height: 35px;
			border-radius: 50%;
			border: 1.5px solid rgba(255, 255, 255, 0.2);
			box-shadow: 
				0 6px 15px rgba(0, 0, 0, 0.3),
				0 0 0 1px rgba(255, 255, 255, 0.1);
			object-fit: cover;
			opacity: 0.9;
		}
        
		.watermark-text {
			font-size: 12px;
			font-weight: 600;
			color: rgba(255, 255, 255, 0.8);
			text-shadow: 
				0 0 6px rgba(255, 255, 255, 0.4),
				0 1px 2px rgba(0, 0, 0, 0.3);
			letter-spacing: 0.2px;
		}
        
		.header {
			display: flex;
			align-items: center;
			justify-content: left;
			gap: 20px;
			margin-bottom: 30px;
			padding-bottom: 20px;
			border-bottom: 1px solid rgba(255, 255, 255, 0.15);
			position: relative;
		}
        
		.hero-icon {
			width: 70px;
			height: 70px;
			border-radius: 50%;
			border: 3px solid rgba(142, 197, 252, 0.6);
			box-shadow: 
				0 0 30px rgba(142, 197, 252, 0.4),
				0 8px 25px rgba(0, 0, 0, 0.3),
				inset 0 1px 0 rgba(255, 255, 255, 0.2);
			object-fit: cover;
			object-position: center;
		}
        
		.hero-info {
			text-align: left;
		}
        
		.hero-name {
			font-size: 28px;
			font-weight: 800;
			color: #ffffff;
			text-shadow: 
				0 0 20px rgba(142, 197, 252, 0.8),
				0 0 40px rgba(142, 197, 252, 0.6),
				0 0 60px rgba(142, 197, 252, 0.4),
				0 2px 8px rgba(0, 0, 0, 0.5);
			margin-bottom: 8px;
			letter-spacing: 0.5px;
		}
        
		.build-count {
			font-size: 14px;
			color: rgba(255, 255, 255, 0.8);
			text-shadow: 
				0 0 10px rgba(255, 255, 255, 0.5),
				0 1px 3px rgba(0, 0, 0, 0.3);
			font-weight: 500;
		}
        
		.section {
			margin-bottom: 30px;
			background: rgba(255, 255, 255, 0.03);
			border-radius: 16px;
			padding: 20px;
			border: 1px solid rgba(255, 255, 255, 0.08);
			backdrop-filter: blur(10px);
			box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
		}
        
		.section-title {
			font-size: 16px;
			font-weight: 700;
			color: #ffffff;
			text-shadow: 
				0 0 15px rgba(142, 197, 252, 0.8),
				0 0 30px rgba(142, 197, 252, 0.5),
				0 1px 4px rgba(0, 0, 0, 0.4);
			margin-bottom: 15px;
			letter-spacing: 0.3px;
		}
        
		.sets-row {
			display: flex;
			gap: 12px;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 12px;
			position: relative;
		}
        
		.set-combo {
			position: relative;
			display: inline-block;
		}
        
		.set-icons-group {
			display: flex;
			gap: 8px;
			align-items: center;
			justify-content: center;
			min-width: 80px; /* Consistent width for alignment */
		}
        
		.set-icons-group.single-set {
			padding-right: 16px;
			justify-content: center;
		}
        
		.set-icons-group.multi-set {
			justify-content: flex-start;
		}
        
		.set-name {
			font-size: 14px;
			color: #ffffff;
			font-weight: 600;
			text-shadow: 
				0 0 8px rgba(255, 255, 255, 0.4),
				0 1px 2px rgba(0, 0, 0, 0.3);
			position: absolute;
			left: 120px; /* Fixed position to align with artifact names */
			flex: 1;
		}
        
		.set-icon {
			width: 28px;
			height: 28px;
			border-radius: 4px;
		}
        
		.broken-icon {
			width: 28px;
			height: 28px;
			border-radius: 4px;
			background: rgba(255, 107, 107, 0.2);
			border: 1px solid rgba(255, 107, 107, 0.4);
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
			font-weight: 700;
			color: #FF6B6B;
			text-shadow: 0 0 5px rgba(255, 107, 107, 0.5);
		}
        
		.percentage {
			font-size: 16px;
			font-weight: 700;
			color: #ffffff;
			text-shadow: 
				0 0 12px rgba(142, 197, 252, 0.8),
				0 0 25px rgba(142, 197, 252, 0.5),
				0 1px 3px rgba(0, 0, 0, 0.4);
			margin-left: auto;
			background: linear-gradient(45deg, rgba(25, 25, 112, 0.6), rgba(192, 192, 192, 0.3));
			padding: 6px 12px;
			border-radius: 8px;
			border: 1px solid rgba(142, 197, 252, 0.3);
		}
        
		.artifact-row {
			display: flex;
			align-items: center;
			gap: 18px;
			margin-bottom: 15px;
			padding: 12px;
			background: rgba(255, 255, 255, 0.04);
			border-radius: 12px;
			border: 1px solid rgba(255, 255, 255, 0.06);
			transition: all 0.3s ease;
		}
        
		.artifact-row:hover {
			background: rgba(255, 255, 255, 0.06);
		}
        
		.artifact-icon {
			width: 50px;
			height: 50px;
			border-radius: 10px;
			box-shadow:
				0 6px 20px rgba(0, 0, 0, 0.3),
				0 0 15px rgba(142, 197, 252, 0.1);
			object-fit: contain;
			object-position: center;
		}
        
		.artifact-name {
			font-size: 14px;
			flex: 1;
			color: #ffffff;
			text-shadow: 
				0 0 8px rgba(255, 255, 255, 0.4),
				0 1px 2px rgba(0, 0, 0, 0.3);
			font-weight: 600;
		}
        
		.stats-flow {
			display: grid;
			grid-template-columns: repeat(5, 1fr);
			gap: 8px;
			max-width: 500px;
		}
        
		.stats-row-2 {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 8px;
			margin-top: 8px;
			max-width: 500px;
		}
        
		.stat-item {
			display: flex;
			align-items: center;
			gap: 8px;
			background: linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
			border-radius: 12px;
			padding: 12px 10px;
			justify-content: center;
			border: 1px solid rgba(255, 255, 255, 0.1);
			box-shadow: 
				0 4px 15px rgba(0, 0, 0, 0.2),
				inset 0 1px 0 rgba(255, 255, 255, 0.1);
			transition: all 0.3s ease;
		}
        
		.stat-item:hover {
			background: linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
			transform: translateY(-1px);
		}
        
		.stat-icon {
			width: 22px;
			height: 22px;
			filter: brightness(1.3) drop-shadow(0 0 8px rgba(142, 197, 252, 0.3));
		}
        
		.stat-value {
			font-size: 12px;
			font-weight: 700;
			color: #ffffff;
			text-shadow: 
				0 0 10px rgba(255, 255, 255, 0.6),
				0 0 20px rgba(142, 197, 252, 0.4),
				0 1px 2px rgba(0, 0, 0, 0.4);
			letter-spacing: 0.2px;
		}
        
		.broken-sets {
			color: #FF6B6B;
			font-size: 12px;
			font-style: italic;
		}
	</style>
</head>
<body>
	${watermarkDataUrl ? `
		<div class="watermark-container">
			<img src="${watermarkDataUrl}" class="watermark" alt="Briar Bot">
			<span class="watermark-text">Briar Bot</span>
		</div>
	` : ''}
	<div class="header">
		${heroImageUrl ? `<img src="${heroImageUrl}" class="hero-icon" alt="${data.heroName}">` : ''}
		<div class="hero-info">
			<div class="hero-name">${data.heroName}</div>
			<div class="build-count">${data.totalBuilds.toLocaleString()}+ builds analyzed</div>
		</div>
	</div>
    
	<div class="section">
		<div class="section-title">Popular Sets</div>
		${data.topSets.map(setData => `
			<div class="sets-row">
				${generateSetHTML(setData.sets)}
				<div class="percentage">${setData.percentage}%</div>
			</div>
		`).join('')}
	</div>
    
	<div class="section">
		<div class="section-title">Popular Artifacts</div>
		${await Promise.all(data.topArtifacts.map(async (artifact) => {
		if (artifact.name.toLowerCase() == "succubus mirror") artifact.name = "Nostalgic Music Box";
		if (artifact.name.toLowerCase() == "elegiac candles") artifact.name = "Elegiac Candle";
		const artifactImageUrl = await getArtifactImage(artifact.name);
		return `
				<div class="artifact-row">
					<img class="artifact-icon" src="${artifactImageUrl}" alt="${artifact.name}">
					<div class="artifact-name">${artifact.name}</div>
					<div class="percentage">${artifact.percentage}%</div>
				</div>
			`;
	})).then(rows => rows.join(''))}
	</div>
    
	<div class="section">
		<div class="section-title">Average Stats</div>
		<div class="stats-flow">
			<div class="stat-item">
				<img src="${statIconDataUrls.atk || ''}" class="stat-icon">
				<div class="stat-value">${(data.avgStats.atk / 1000).toFixed(1)}k</div>
			</div>
			<div class="stat-item">
				<img src="${statIconDataUrls.def || ''}" class="stat-icon">
				<div class="stat-value">${(data.avgStats.def / 1000).toFixed(1)}k</div>
			</div>
			<div class="stat-item">
				<img src="${statIconDataUrls.hp || ''}" class="stat-icon">
				<div class="stat-value">${(data.avgStats.hp / 1000).toFixed(1)}k</div>
			</div>
			<div class="stat-item">
				<img src="${statIconDataUrls.spd || ''}" class="stat-icon">
				<div class="stat-value">${data.avgStats.spd}</div>
			</div>
			<div class="stat-item">
				<img src="${statIconDataUrls.chc || ''}" class="stat-icon">
				<div class="stat-value">${data.avgStats.chc}%</div>
			</div>
		</div>
		<div class="stats-row-2">
			<div class="stat-item">
				<img src="${statIconDataUrls.chd || ''}" class="stat-icon">
				<div class="stat-value">${data.avgStats.chd}%</div>
			</div>
			<div class="stat-item">
				<img src="${statIconDataUrls.eff || ''}" class="stat-icon">
				<div class="stat-value">${data.avgStats.eff}%</div>
			</div>
			<div class="stat-item">
				<img src="${statIconDataUrls.efr || ''}" class="stat-icon">
				<div class="stat-value">${data.avgStats.efr}%</div>
			</div>
			<div class="stat-item">
				<img src="${statIconDataUrls.gs || ''}" class="stat-icon">
				<div class="stat-value">${data.avgStats.gs}</div>
			</div>
		</div>
	</div>
</body>
</html>`;
}

async function generateReportImage(data) {
	const html = await generateHTML(data);

	const puppeteer = require('puppeteer');
	let browser;
	let page;

	try {
		const isProduction = process.env.NODE_ENV === 'production';

		const config = {
			headless: true,
			timeout: 60000,
			protocolTimeout: 60000,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-gpu',
				'--disable-web-security',
				'--disable-features=VizDisplayCompositor',
				'--disable-background-timer-throttling',
				'--disable-renderer-backgrounding',
				'--disable-backgrounding-occluded-windows',
				'--disable-ipc-flooding-protection',
				'--memory-pressure-off',
				'--no-first-run',
				'--no-default-browser-check',
				'--mute-audio',
				'--disable-extensions',
				'--disable-default-apps',
				'--disable-sync',
				'--disable-translate',
				'--hide-scrollbars',
				'--disable-plugins',
				'--disable-notifications'
			]
		};

		if (isProduction) {
			config.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
		}

		browser = await puppeteer.launch(config);

		page = await browser.newPage();

		// Optimize page settings for VM performance
		await page.setCacheEnabled(false);
		await page.setOfflineMode(false);

		await page.setContent(html, {
			waitUntil: 'domcontentloaded',
			timeout: 30000
		});

		await page.setViewport({
			width: 600,
			height: 975,
			deviceScaleFactor: 1.5
		});

		// Reduced wait time for faster response
		await new Promise(resolve => setTimeout(resolve, 1000));

		const screenshot = await page.screenshot({
			type: 'png',
			omitBackground: true,
			fullPage: false,
			clip: { x: 0, y: 0, width: 600, height: 975 }
		});

		return screenshot;

	} catch (error) {
		console.error('Puppeteer error:', error.message);
		throw error;
	} finally {
		try {
			if (page) await page.close();
		} catch (e) { /* ignore */ }
		try {
			if (browser) await browser.close();
		} catch (e) { /* ignore */ }
	}
}

// Create HTTP server for Render deployment
const server = http.createServer((req, res) => {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.end('Briar Bot is running!\n');
});

// Process optimization for VM environment
process.on('warning', (warning) => {
	console.warn('Node.js Warning:', warning.name, warning.message);
});

// Memory monitoring (reduced frequency)
function logMemoryUsage() {
	const usage = process.memoryUsage();
	const rss = Math.round(usage.rss / 1024 / 1024);
	const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);
	console.log(`Memory: ${rss}MB RSS, ${heapUsed}MB Heap, Queue: ${commandQueue.length}`);
}

// Only run Discord bot if this file is executed directly, not when imported
if (require.main === module) {
	// Start HTTP server for Render
	const port = process.env.PORT || 3000;
	server.listen(port, '0.0.0.0', () => {
		console.log(`HTTP server running on port ${port}`);
	});

	// Memory monitoring interval (reduced frequency)
	setInterval(logMemoryUsage, 1800000); // Every 30 minutes

	client.once('ready', async () => {
		console.log(`Logged in as ${client.user.tag}!`);
		await loadGameData();
		logMemoryUsage();
		initializeGuildWarScheduler(client);

	});

	client.on('messageCreate', async (message) => {
		if (message.author.bot) return;

		// Admin command: !botstatus
		if (message.content.toLowerCase() === '!botstatus') {
			const health = rateLimiter.getHealthStats();
			const cacheStats = cacheManager.getCacheStats();

			const statusEmbed = {
				title: '🤖 Briar Bot Status',
				color: health.circuitBreakerOpen ? 0xFF0000 : health.circuitBreakerHalfOpen ? 0xFFAA00 : 0x00FF00,
				fields: [
					{
						name: '📊 API Health',
						value: `**Strategy:** ${health.strategy}\n**Success Rate:** ${health.successRate}\n**Total Requests:** ${health.totalRequests}\n**Successful:** ${health.successfulRequests}`,
						inline: true
					},
					{
						name: '🔌 Circuit Breaker',
						value: `**Status:** ${health.circuitBreakerOpen ? '🔴 OPEN' : health.circuitBreakerHalfOpen ? '🟡 HALF-OPEN' : '🟢 CLOSED'}\n**Failures:** ${health.circuitBreakerFailureCount}\n**403s:** ${health.consecutive403s}\n**429s:** ${health.consecutive429s}`,
						inline: true
					},
					{
						name: '💾 Cache Stats',
						value: `**Images Cached:** ${cacheStats.totalImages}\n**Valid Images:** ${cacheStats.validImages}\n**Total Size:** ${cacheStats.totalSizeMB} MB\n**Cache Hits:** ${cacheStats.cacheHitsSinceStart}`,
						inline: true
					},
					{
						name: '⏱️ Timing',
						value: `**Last Success:** <t:${Math.floor(new Date(health.lastSuccessTime).getTime() / 1000)}:R>\n**Time Since:** ${Math.floor(health.timeSinceLastSuccess / 1000)}s`,
						inline: false
					},
					{
						name: '🔄 Queue Status',
						value: `**Queue Length:** ${commandQueue.length}\n**Processing:** ${processingCommands.size}\n**Active Connections:** ${activeConnections}`,
						inline: false
					}
				],
				timestamp: new Date().toISOString()
			};

			await message.reply({ embeds: [statusEmbed] });
			return;
		}

		// Admin command: !resetcircuit (for emergencies)
		if (message.content.toLowerCase() === '!resetcircuit') {
			rateLimiter.reset();
			await message.reply('🔄 Circuit breaker has been reset. API requests will resume normally.');
			return;
		}

		// Admin command: !testguildwar [attack|defense|both]
		if (message.content.toLowerCase().startsWith('!testguildwar')) {
			if (!message.member.permissions.has('Administrator')) {
				await message.reply('🕸️ Only those who command the guild may test the war horns.');
				return;
			}

			const args = message.content.split(' ');
			const type = args[1]?.toLowerCase() || 'both';

			if (!['attack', 'defense', 'both'].includes(type)) {
				await message.reply('🕸️ Speak clearly: `!testguildwar [attack|defense|both]`');
				return;
			}

			await message.reply('🧪 The witch summons the war spirits for testing...');
			await testAnnouncements(client, type, message.channel);
			return;
		}

		if (message.content.startsWith('!') && message.content.length > 1) {
			// Enhanced rate limiting check
			const rateLimitResult = checkRateLimit(message.author.id);
			if (!rateLimitResult.allowed) {
				const rateLimitMessage = getRandomResponse('rateLimited', { time: rateLimitResult.resetTime });
				await message.reply(`⏳ ${rateLimitMessage}`);
				return;
			}

			const rawInput = message.content.slice(1);

			// Input validation and sanitization
			let userInput;
			try {
				userInput = validateAndSanitizeInput(rawInput);
			} catch (error) {
				const invalidMessage = getRandomResponse('invalidInput', { error: error.message });
				await message.reply(`？ ${invalidMessage}`);
				return;
			}

			// Use fuzzy search to find the best character match
			const searchResult = findBestCharacterMatch(userInput);

			if (!searchResult) {
				const suggestions = getCharacterSuggestions(userInput, 3);
				if (suggestions.length > 0) {
					const suggestionsText = suggestions.map(s => `• ${s}`).join('\n');
					const suggestionMessage = getRandomResponse('characterNotFoundWithSuggestions', {
						input: userInput,
						suggestions: suggestionsText
					});
					await message.reply(suggestionMessage);
				} else {
					const notFoundMessage = getRandomResponse('characterNotFound', { input: userInput });
					await message.reply(notFoundMessage);
				}
				return;
			}

			const characterName = searchResult.character;
			const confidence = (searchResult.confidence * 100).toFixed(1);

			// Add to queue
			const queueResult = addToQueue({
				message,
				userInput,
				characterName,
				confidence,
				searchResult
			});

			if (!queueResult.success) {
				if (queueResult.reason === 'queue_full') {
					const queueFullMessage = getRandomResponse('queueFull');
					await message.reply(queueFullMessage);
				}
				return;
			}

			// Notify user of queue position if not being processed immediately
			if (processingCommands.size >= MAX_CONCURRENT_COMMANDS) {
				const queuedMessage = getRandomResponse('queued', {
					character: characterName,
					position: queueResult.position
				});
				await message.reply(queuedMessage);
			}
		}
	});

	client.login(BOT_TOKEN);

	process.on('SIGINT', () => {
		console.log('Shutting down bot...');
		client.destroy();
		process.exit(0);
	});
}

// Export functions for testing
module.exports = {
	loadGameData,
	analyzeHeroData,
	generateReportImage,
	generateHTML,
	checkRateLimit,
	heroData,
	artifactData,
	artifactsById
};
