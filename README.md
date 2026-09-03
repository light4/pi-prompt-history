# pi-prompt-history

A Pi extension that restores a previous prompt with a fuzzy picker.

## Use

- Press the configured shortcut (default **Ctrl+R**) at any time, or run `/history`.
- Type to fuzzy-filter prompts from the **active branch**. The most recently used prompt is listed first by default.
- Press `Tab` to switch to **Global** history, which includes every saved Pi session and the local history retained for ephemeral sessions. Each result shows its use count and last-used time. The first global search builds a local cache; later searches reuse it. Press `Ctrl+G` to rebuild that cache from the saved sessions.
- Use `↑` / `↓` to select a result, then `Enter` to put it back into Pi's editor.
- It only restores text; it does **not** submit the prompt.
- `Esc` or `Ctrl+C` dismisses the picker.

The search ranks in-order character matches and gives preference to consecutive and word-boundary matches. Repeated prompts appear once, prioritizing their most recent use. The global history is stored locally in `~/.pi/agent/pi-prompt-history-history.json`; it starts collecting prompts after this version is installed.

## Configure the shortcut

The default picker shortcut is `Ctrl+R`. To change it globally without editing the installed package, create `~/.pi/agent/pi-prompt-history.json`:

```json
{
  "shortcut": "alt+r",
  "globalHistoryLimit": 1000
}
```

The `PI_PROMPT_HISTORY_SHORTCUT` environment variable takes precedence for one Pi launch:

```sh
PI_PROMPT_HISTORY_SHORTCUT=alt+r pi
```

Use any Pi keybinding format (for example `alt+r` or `ctrl+shift+r`). If the selected key conflicts with a built-in Pi shortcut, Pi reports the conflict at startup and `/history` remains available.

## Install

Install the latest tagged release as a global Pi package from GitHub:

```sh
pi install git:github.com/light4/pi-prompt-history@v0.2.4
```

Or, after the corresponding npm release is available, install it from npm:

```sh
pi install npm:@light4/pi-prompt-history@0.2.4
```

After changing the shortcut configuration, restart Pi or run `/reload`.

## Install for local development

Pi auto-discovers an extension whose directory contains `index.ts`. Symlink this repository's source directory into the global extension directory:

```sh
ln -sfn /Users/chenyuanning/sources/pi-prompt-history/src \
  ~/.pi/agent/extensions/pi-prompt-history
```

Then start Pi or run `/reload` in an existing session.

For a one-off test without installing it globally:

```sh
pi -e /Users/chenyuanning/sources/pi-prompt-history/src/index.ts
```

## Scope and privacy

The extension reads the active session, all locally saved Pi session files, and maintains a local global-history cache at `~/.pi/agent/pi-prompt-history-history.json` (including prompts from ephemeral sessions). It does not send prompt data over the network. Press `Ctrl+G` in the picker, or delete that file, to rebuild the cache from saved sessions.

## Development

The extension is TypeScript interpreted by Pi's extension loader and deliberately has no npm runtime dependencies. Test it manually by sending a few prompts, then invoking `Ctrl+R` or `/history`.
