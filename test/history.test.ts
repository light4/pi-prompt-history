import assert from "node:assert/strict";
import test from "node:test";

import { aggregateHistory, fuzzyScore, isMeaningfulPrompt, mergeHistory, rankHistory, resolveShortcut } from "../src/index.ts";

test("isMeaningfulPrompt rejects numeric-only accidental submissions", () => {
	assert.equal(isMeaningfulPrompt("1"), false);
	assert.equal(isMeaningfulPrompt("  123  "), false);
	assert.equal(isMeaningfulPrompt("123 deploys"), true);
	assert.equal(isMeaningfulPrompt("检查 123"), true);
});

test("fuzzyScore accepts in-order subsequences and rejects out-of-order text", () => {
	assert.notEqual(fuzzyScore("please inspect the auth module", "pam"), undefined);
	assert.equal(fuzzyScore("please inspect the auth module", "map"), undefined);
});

test("fuzzyScore prefers consecutive matches", () => {
	const consecutive = fuzzyScore("zz ng foo", "ng")!;
	const split = fuzzyScore("zz n foo g", "ng")!;
	assert.ok(consecutive > split);
});

test("resolveShortcut uses the environment override and falls back for empty values", () => {
	assert.equal(resolveShortcut({ shortcut: "alt+r" }, "ctrl+shift+r"), "ctrl+shift+r");
	assert.equal(resolveShortcut({ shortcut: "alt+r" }), "alt+r");
	assert.equal(resolveShortcut({ shortcut: "" }), "ctrl+r");
});

test("rankHistory prioritizes score and then newest matching prompt", () => {
	const ranked = rankHistory([
		{ text: "inspect API errors", recency: 1 },
		{ text: "inspect application logs", recency: 2 },
		{ text: "deploy application", recency: 3 },
	], "app");
	assert.deepEqual(ranked.map((item) => item.text), [
		"deploy application",
		"inspect application logs",
	]);
});

test("mergeHistory retains one copy of a prompt at its newest use", () => {
	const merged = mergeHistory(
		[{ text: "commit + push", recency: 10 }, { text: "older", recency: 5 }],
		[{ text: "commit + push", recency: 20 }, { text: "newer", recency: 15 }],
	);
	assert.deepEqual(rankHistory(merged, "").map((item) => item.text), [
		"commit + push",
		"newer",
		"older",
	]);
});

test("rankHistory lists an empty-query history in reverse chronological order", () => {
	const ranked = rankHistory([
		{ text: "oldest prompt", recency: 4 },
		{ text: "middle prompt", recency: 12 },
		{ text: "newest prompt", recency: 20 },
	], "");
	assert.deepEqual(ranked.map((item) => item.text), [
		"newest prompt",
		"middle prompt",
		"oldest prompt",
	]);
});

test("global history ranks repeated prompts by frequency and then recency", () => {
	const globalHistory = aggregateHistory(
		[{ text: "old frequent", recency: 5 }, { text: "new infrequent", recency: 20 }],
		[{ text: "old frequent", recency: 10 }],
	);
	assert.deepEqual(rankHistory(globalHistory, "").map((item) => item.text), [
		"old frequent",
		"new infrequent",
	]);
	assert.equal(globalHistory.find((item) => item.text === "old frequent")?.frequency, 2);
});
