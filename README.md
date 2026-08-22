# pi-prompt-history

A Pi extension that restores a previous prompt with a fuzzy picker.

## Use

- Press **Ctrl+R** while Pi is idle, or run `/history`.
- Type to fuzzy-filter prompts from the **active branch of the current session**.
- Use `↑` / `↓` to select a result, then `Enter` to put it back into Pi's editor.
- It only restores text; it does **not** submit the prompt.
- `Esc` or `Ctrl+C` dismisses the picker.

The search ranks in-order character matches and gives preference to consecutive and word-boundary matches. Repeated prompts appear once, prioritizing their most recent use.

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
