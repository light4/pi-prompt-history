import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { CONFIG_DIR_NAME, DynamicBorder, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Input, Key, type KeyId, type SelectItem, SelectList, Text, matchesKey } from "@earendil-works/pi-tui";

interface HistoryItem {
	text: string;
	recency: number;
}

interface PromptHistoryConfig {
	shortcut?: string;
}

const DEFAULT_SHORTCUT = Key.ctrl("r");

/**
 * Resolve the picker shortcut. An environment variable takes precedence over
 * the user config so callers can change the binding for a single Pi launch.
 */
export function resolveShortcut(config: PromptHistoryConfig, environmentShortcut?: string): KeyId {
	const shortcut = environmentShortcut ?? config.shortcut ?? DEFAULT_SHORTCUT;
	return typeof shortcut === "string" && shortcut.trim() ? shortcut.trim() as KeyId : DEFAULT_SHORTCUT;
}

function loadConfig(): PromptHistoryConfig {
	const path = join(homedir(), CONFIG_DIR_NAME, "agent", "pi-prompt-history.json");
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
		return parsed !== null && typeof parsed === "object" ? parsed as PromptHistoryConfig : {};
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			console.warn(`pi-prompt-history: unable to read ${path}: ${error instanceof Error ? error.message : String(error)}`);
		}
		return {};
	}
}

/**
 * Scores a subsequence match. Earlier, consecutive, and word-boundary matches rank higher.
 * Returning undefined means every query character did not occur in order.
 */
export function fuzzyScore(candidate: string, query: string): number | undefined {
	const haystack = candidate.toLocaleLowerCase();
	const needle = query.trim().toLocaleLowerCase();
	if (!needle) return 0;

	let score = 0;
	let cursor = 0;
	let previous = -2;
	for (const character of needle) {
		const found = haystack.indexOf(character, cursor);
		if (found === -1) return undefined;

		score += 1;
		if (found === previous + 1) score += 6;
		if (found === 0 || /[\s_./:-]/.test(haystack[found - 1] ?? "")) score += 3;
		score -= found - cursor;
		previous = found;
		cursor = found + 1;
	}
	return score;
}

export function rankHistory(history: HistoryItem[], query: string): HistoryItem[] {
	const terms = query.trim().split(/\s+/).filter(Boolean);
	return history
		.map((item) => {
			const score = terms.reduce<number | undefined>((total, term) => {
				if (total === undefined) return undefined;
				const termScore = fuzzyScore(item.text, term);
				return termScore === undefined ? undefined : total + termScore;
			}, 0);
			return { item, score };
		})
		.filter((match): match is { item: HistoryItem; score: number } => match.score !== undefined)
		.sort((left, right) => right.score - left.score || right.item.recency - left.item.recency)
		.map((match) => match.item);
}

function getPromptHistory(ctx: ExtensionContext): HistoryItem[] {
	const seen = new Set<string>();
	const result: HistoryItem[] = [];
	const branch = ctx.sessionManager.getBranch();

	for (let index = branch.length - 1; index >= 0; index--) {
		const entry = branch[index];
		if (entry.type !== "message" || entry.message.role !== "user") continue;
		const content = entry.message.content;
		const text = typeof content === "string"
			? content.trim()
			: content
				.filter((block): block is { type: "text"; text: string } => block.type === "text")
				.map((block) => block.text)
				.join("\n")
				.trim();
		if (!text || seen.has(text)) continue;
		seen.add(text);
		result.push({ text, recency: result.length });
	}
	return result;
}

function displayLabel(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

async function showHistory(ctx: ExtensionContext): Promise<void> {
	if (!ctx.isIdle()) {
		ctx.ui.notify("Wait for Pi to finish before searching prompt history.", "warning");
		return;
	}

	const history = getPromptHistory(ctx);
	if (history.length === 0) {
		ctx.ui.notify("This session has no prompt history yet.", "info");
		return;
	}

	let requestRender: (() => void) | undefined;
	const selected = await ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
		requestRender = () => tui.requestRender();
		const container = new Container();
		const input = new Input();
		let selectList: SelectList;
		let matches = history;
		let selectedIndex = 0;

		const createList = () => {
			const items: SelectItem[] = matches.slice(0, 200).map((item) => ({
				value: item.text,
				label: displayLabel(item.text),
				description: item.text.includes("\n") ? "multiline prompt" : undefined,
			}));
			selectList = new SelectList(items, 10, {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});
			selectList.setSelectedIndex(selectedIndex);
		};

		const refresh = () => {
			matches = rankHistory(history, input.getValue());
			selectedIndex = 0;
			createList();
		};

		const moveSelection = (delta: number) => {
			if (matches.length === 0) return;
			selectedIndex = (selectedIndex + delta + matches.length) % matches.length;
			selectList.setSelectedIndex(selectedIndex);
		};
		createList();

		return {
			get focused() {
				return input.focused;
			},
			set focused(value: boolean) {
				input.focused = value;
			},
			render(width: number) {
				container.clear();
				container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
				container.addChild(new Text(theme.fg("accent", theme.bold("Prompt history")), 1, 0));
				container.addChild(new Text(theme.fg("dim", "fuzzy filter: "), 1, 0));
				container.addChild(input);
				container.addChild(selectList);
				container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter restore • esc cancel"), 1, 0));
				container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
				return container.render(width);
			},
			invalidate() {
				container.invalidate();
				input.invalidate();
				selectList.invalidate();
			},
			handleInput(data: string) {
				// Handle picker controls here instead of delegating to SelectList. Its
				// handler reads the application's keybinding manager, which may not
				// match the raw key events delivered to a custom overlay.
				if (matchesKey(data, Key.up)) {
					moveSelection(-1);
				} else if (matchesKey(data, Key.down)) {
					moveSelection(1);
				} else if (matchesKey(data, Key.pageUp)) {
					moveSelection(-10);
				} else if (matchesKey(data, Key.pageDown)) {
					moveSelection(10);
				} else if (matchesKey(data, Key.enter)) {
					const item = selectList.getSelectedItem();
					if (item) done(item.value);
				} else if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
					done(null);
				} else {
					input.handleInput(data);
					refresh();
				}
				tui.requestRender();
			},
		};
	}, { overlay: true, overlayOptions: { width: "80%", minWidth: 40, maxHeight: "70%" } });

	if (selected !== null) {
		ctx.ui.setEditorText(selected);
		// setEditorText updates the editor state but does not schedule a repaint.
		// The picker close already rendered, so explicitly repaint the restored text.
		requestRender?.();
	}
}

export default function promptHistoryExtension(pi: ExtensionAPI) {
	pi.registerShortcut(resolveShortcut(loadConfig(), process.env.PI_PROMPT_HISTORY_SHORTCUT), {
		description: "Fuzzy-search prompt history",
		handler: showHistory,
	});
	pi.registerCommand("history", {
		description: "Fuzzy-search prompts in the current session",
		handler: async (_args, ctx) => showHistory(ctx),
	});
}
