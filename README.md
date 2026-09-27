# Conversation Starters (QVAC)

Pick where you are (family dinner, new classmate, road trip, visiting grandparents...) or type your own situation, choose **light, medium or deep**, and an **on-device AI** deals a **deck of question cards** to get people talking. Flip through with the arrow keys, shuffle, deal more, and save the best questions.

It runs **on your own computer** using [QVAC](https://github.com/tetherto/qvac), Tether's open-source AI SDK.
No API key, no cloud service, and what you type never leaves your machine.

![screenshot](screenshot.png)

## SDK version

`@qvac/sdk` **0.19.0** (declared in `package.json`)

Functions used: `loadModel` and `completion` (with structured output via `responseFormat`), with the `LLAMA_3_2_1B_INST_Q4_0` model.

## Install

You need [Node.js](https://nodejs.org) 22 or newer and some free disk space for the model.

```bash
git clone https://github.com/misaki-codex/qvac-conversation-starters.git
cd qvac-conversation-starters
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3089** (the address, not the HTML file). The first start downloads the model.
While it loads, 30 built-in questions (10 per depth) are used.

## How it works

- `server.js` calls `completion` with a JSON schema that returns a list of open-ended questions, with rules to avoid awkward topics like money, weight or politics.
- **Deal more** tells the AI which questions you've already had, so they don't repeat.
- Saved questions stay in your browser.
- The server listens on `127.0.0.1`, so only your own computer can reach it.

## Troubleshooting

If you see `RPC_INIT_TIMEOUT`, the QVAC worker was slow to start. `server.js` already waits 3 minutes.
Set `QVAC_RPC_INIT_TIMEOUT_MS` (milliseconds) before `npm start` to wait longer, and make sure no other
QVAC app is running at the same time. If you see `ERR_MODULE_NOT_FOUND`, delete the `node_modules` folder
and run `npm install` again (this usually means an install was interrupted, for example by a full disk).

## License

MIT
