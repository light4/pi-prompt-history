# pi-prompt-history

A Pi extension that restores a previous prompt with a fuzzy picker.

## Use

- Press the configured shortcut (default **Ctrl+R**) while Pi is idle, or run `/history`.
- Type to fuzzy-filter prompts from the **active branch of the current session**.
- Use `↑` / `↓` to select a result, then `Enter` to put it back into Pi's editor.
- It only restores text; it does **not** submit the prompt.
- `Esc` or `Ctrl+C` dismisses the picker.

The search ranks in-order character matches and gives preference to consecutive and word-boundary matches. Repeated prompts appear once, prioritizing their most recent use.

## Configure the shortcut

The default picker shortcut is `Ctrl+R`. To change it globally without editing the installed package, create `~/.pi/agent/pi-prompt-history.json`:

```json
{
  "shortcut": "alt+r"
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
pi install git:github.com/light4/pi-prompt-history@v0.2.1
```

Or, after the corresponding npm release is available, install it from npm:

```sh
pi install npm:@light4/pi-prompt-history@0.2.1
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

The extension reads prompt messages from Pi's in-memory `SessionManager`; it does not execute subprocesses, read session files itself, send data over the network, or search other sessions.

## Development

The extension is TypeScript interpreted by Pi's extension loader and deliberately has no npm runtime dependencies. Test it manually by sending a few prompts, then invoking `Ctrl+R` or `/history`.
