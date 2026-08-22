import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, Input, Key, type SelectItem, SelectList, Text, matchesKey } from "@earendil-works/pi-tui";

interface HistoryItem {
	text: string;
	recency: number;
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

	const selected = await ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
		const container = new Container();
		const input = new Input();
		let selectList: SelectList;
		let matches = history;

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
			selectList.onSelect = (item) => done(item.value);
			selectList.onCancel = () => done(null);
		};

		const refresh = () => {
			matches = rankHistory(history, input.getValue());
			createList();
		};

		input.onSubmit = () => {
			const item = selectList.getSelectedItem();
			if (item) done(item.value);
		};
		input.onEscape = () => done(null);
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
				if (matchesKey(data, Key.up) || matchesKey(data, Key.down) || matchesKey(data, Key.pageUp) || matchesKey(data, Key.pageDown)) {
					selectList.handleInput(data);
				} else if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
					selectList.handleInput(data);
				} else {
					input.handleInput(data);
					refresh();
				}
				tui.requestRender();
			},
		};
	}, { overlay: true, overlayOptions: { width: "80%", minWidth: 40, maxHeight: "70%" } });

	if (selected !== null) ctx.ui.setEditorText(selected);
}

export default function promptHistoryExtension(pi: ExtensionAPI) {
	pi.registerShortcut(Key.ctrl("r"), {
		description: "Fuzzy-search prompt history",
		handler: showHistory,
	});
	pi.registerCommand("history", {
		description: "Fuzzy-search prompts in the current session",
		handler: async (_args, ctx) => showHistory(ctx),
	});
}
