# Punic Chess

An original strategy board game inspired by the Punic Wars, now playable in the browser.

Punic Chess is a tactical, formation-driven chess-like game set in an abstract battlefield between the Roman Republic and Carthage. Unlike traditional chess, victory does not come only from a single decisive capture. You must coordinate units, build protected formations, escort siege forces, break palace defenses, and decide when a sacrifice is worth one more square of progress.

Play locally with a friend, challenge the built-in AI, or create an online room for remote two-player battles.

## Why Punic Chess?

Punic Chess is about cooperation between pieces.

A lone queen may dominate open space. A chariot may tear through ranks. A soldier may look weak on its own. But the real power of the game appears when pieces move as a formation: chariots become protected siege engines, yellow soldiers become untouchable escorts, and ordinary soldiers turn into the key link that holds an army together.

Every move asks a strategic question:

- Should you advance your siege formation or protect your king?
- Should you sacrifice a guard to permanently seal a square?
- Should you break formation for a quick attack, or preserve protection for the long war?
- Can you force your opponent to defend the palace while your own army regroups?

This is not just chess with new pieces. It is a small war system built around formation, protection, sacrifice, and breakthrough.

## Features

- Local two-player mode: play on the same device with a friend.
- Human vs AI mode: choose a side and test your strategy against the built-in computer opponent.
- Online two-player mode: create or join a private room and play remotely with another player.
- Pure web implementation: built with HTML, CSS, and native JavaScript modules.
- No framework required: lightweight, easy to read, easy to host, and easy to modify.
- Move log and action panel: see available actions, selected piece information, formations, and game history.
- Original formation mechanics: siege formations, special-force formations, protected pieces, group movement, guard clashes, blocked squares, and palace breakthrough rules.

## Game Overview

The board is a 6 x 10 grid. Each side owns a 4 x 3 palace at one end of the board.

The two factions are:

- Rome, advancing from the north.
- Carthage, advancing from the south.

Each army contains:

- King, the core of the army.
- Queen, the strongest mobile piece.
- Guard, a defensive piece that can sacrifice itself and block a square.
- Chariot, a powerful straight-line attacker.
- Yellow Soldier, a flexible short-range unit.
- Soldier, a forward-moving infantry unit and the backbone of formations.

## Core Rules

### King

The king moves one square in any direction, but only inside its own palace.

If your king is captured, you lose.

### Queen

The queen moves any number of squares in any direction.

### Guard

The guard moves one square in any direction inside its own palace.

When a guard captures or is captured, both pieces are removed from the board, and that square becomes permanently blocked.

### Chariot

The chariot moves any number of squares horizontally or vertically.

### Yellow Soldier

The yellow soldier moves one square in any direction.

### Soldier

The soldier moves one square forward.

## Formations

Formations are the heart of Punic Chess.

A piece inside a valid formation may gain protection, new tactical options, or the ability to move together with the group.

### Siege Formation

A chariot and a friendly soldier form a siege formation when they are adjacent.

The chariot is protected.

If the complete siege formation enters the opponent's palace, that side wins.

### Special-Force Formation

A soldier and two friendly yellow soldiers form a special-force formation when all three pieces fit within a 3 x 3 area.

The two yellow soldiers are protected.

### Three-Arms Formation

A chariot, a yellow soldier, and a soldier form a three-arms formation when all three pieces fit within a 3 x 3 area.

The chariot and yellow soldier are protected.

### Protected Pieces

Protected pieces cannot be captured.

This creates the main tactical tension of the game: you are not only attacking pieces, but also attacking the structure that makes them safe. A protected chariot may be impossible to take directly, but if you break its formation, it becomes vulnerable again.

## Victory Conditions

You win by either:

- Capturing the opponent's king.
- Moving a complete siege formation into the opponent's palace.

The second condition is what gives Punic Chess its identity. Sometimes the fastest way to win is not to hunt the king, but to escort a siege group deep into enemy territory.

## Getting Started

Clone the repository:

```bash
git clone https://github.com/Thryzen/Punic-Chess.git
cd Punic-Chess
```

Start a local HTTP server:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8765/
```

To stop the server, return to the terminal window and press `Ctrl+C`.

## If the Port Is Already in Use

Use another port, for example:

```bash
python -m http.server 8770 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8770/
```

## Project Structure

```text
Punic-Chess/
├── index.html
├── styles.css
├── game.config.json
├── README.md
└── src/
    ├── ai.mjs
    ├── config.mjs
    ├── game.mjs
    ├── labels.mjs
    ├── online-core-loader.mjs
    ├── online-seats.mjs
    └── ui.mjs
```

## Online Mode

Online play uses a signaling service so two remote players can share room state and moves. The online layer is powered by [Board Games Core](https://github.com/Thryzen/Board-Game-Core), a reusable P2P-first friend-room core for board games.

When deploying your own instance, make sure the frontend points to your own secure WebSocket endpoint in `game.config.json`, for example:

```text
wss://your-domain.example/ws
```

If your site is served over HTTPS, the online service should also use `wss://` rather than `ws://`; otherwise browsers may block the connection as mixed content.

## Design Philosophy

Punic Chess was designed around one simple idea:

A battlefield is not won by isolated heroes, but by coordinated forces.

The pieces are intentionally asymmetric in role. Some are individually powerful. Some are fragile but essential. Some exist mainly to protect, escort, block, or enable others.

A good player must think in layers:

- material advantage,
- palace defense,
- formation integrity,
- protected targets,
- siege pressure,
- sacrifice value,
- long-term board control.

The result is a compact strategy game where every formation tells a story.

## Development Notes

This project uses native browser technologies only:

- HTML
- CSS
- JavaScript ES modules

Because the game uses ES modules, opening `index.html` directly through `file://` may not work reliably in all browsers. Running a small local HTTP server is recommended.

## Contributing

Contributions are welcome.

Good places to start:

- Improve the UI/UX.
- Add rule explanations or tutorials.
- Strengthen online play reliability.
- Improve the AI.
- Add tests for move generation and win conditions.
- Translate the interface.

Before making large changes, please open an issue or discussion so the design can stay consistent with the original rule system.

## Acknowledgements

The boundless imagination of our childhood.

May your siege engines reach the palace, and may your formations hold.
