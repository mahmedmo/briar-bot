#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const characterDataPath = path.join(__dirname, '..', 'data', 'character-names.json');
const characterAliasDataPath = path.join(__dirname, '..', 'data', 'character-aliases.json');

function parseArgs(argv) {
	const args = {};

	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];
		const next = argv[index + 1];

		if (!current.startsWith('--')) {
			continue;
		}

		args[current.slice(2)] = next;
		index += 1;
	}

	return args;
}

function normalizeAlias(alias) {
	return alias.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function splitAliases(rawAliases) {
	if (!rawAliases || rawAliases.trim().length === 0) {
		return [];
	}

	return rawAliases
		.split(/[\n,]/)
		.map((alias) => normalizeAlias(alias))
		.filter(Boolean);
}

function sortStrings(values) {
	return [...values].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, '\t')}\n`);
}

function ensureAliasTarget(existingValue, expectedCharacter, alias) {
	if (existingValue === undefined) {
		return;
	}

	if (Array.isArray(existingValue)) {
		if (existingValue.includes(expectedCharacter)) {
			return;
		}

		throw new Error(`Alias "${alias}" already points to multiple characters (${existingValue.join(', ')}).`);
	}

	if (existingValue !== expectedCharacter) {
		throw new Error(`Alias "${alias}" already points to "${existingValue}".`);
	}
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const character = (args.character || '').trim();
	const aliases = splitAliases(args.aliases || '');

	if (!character) {
		throw new Error('Missing required argument: --character "Full Character Name"');
	}

	const characterData = readJson(characterDataPath);
	const characterAliasData = readJson(characterAliasDataPath);
	characterAliasData.aliases = characterAliasData.aliases || {};
	const currentCharacters = new Set(characterData.characters);
	let changed = false;

	if (!currentCharacters.has(character)) {
		characterData.characters = sortStrings([...currentCharacters, character]);
		changed = true;
	}

	for (const alias of aliases) {
		const existingAliasValue = characterAliasData.aliases[alias];
		ensureAliasTarget(existingAliasValue, character, alias);
		if (Array.isArray(existingAliasValue)) {
			continue;
		}
		if (existingAliasValue !== character) {
			characterAliasData.aliases[alias] = character;
			changed = true;
		}
	}

	if (!changed) {
		console.log(`No changes needed for "${character}".`);
		return;
	}

	characterAliasData.aliases = Object.fromEntries(
		Object.entries(characterAliasData.aliases)
			.sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
	);

	writeJson(characterDataPath, characterData);
	writeJson(characterAliasDataPath, characterAliasData);

	console.log(`Updated character data for "${character}".`);
	if (aliases.length > 0) {
		console.log(`Aliases: ${aliases.join(', ')}`);
	}
}

try {
	main();
} catch (error) {
	console.error(error.message);
	process.exit(1);
}
