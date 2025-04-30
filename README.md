# 🕵️‍♂️ CheckM8

**CheckM8** is a powerful onchain intelligence bot powered by [Rugcheck](https://rugcheck.xyz/) that integrates seamlessly with **Telegram**, **Discord**, and **Twitter**. It scans any token address and provides **real-time risk analysis**, **developer wallet tracking**, and **community voting features** through wallets embedded on telegram and discord.

---

## 🔍 Overview

CheckM8 is designed for degens, traders, and communities to **instantly verify token safety**, **track developer behavior**, and **upvote/downvote** tokens embedded wallets — all within the apps they already use.

---

## [demo post](https://x.com/CheckM8_Bot/status/1917753103350112369)

## 🔗 Bot Link

- **Telegram Bot:** [@CheckM8_Bot](https://t.me/CheckM8_Bot)
- **Discord Bot Invite:** [Invite Link](https://discord.com/oauth2/authorize?client_id=1358869096560853162&permissions=1689934340028480&integration_type=0&scope=bot)
- **Twitter:** [@CheckM8_Bot](https://x.com/CheckM8_Bot)

## 🚀 Key Features

### ✅ Token Risk Analysis

- **Telegram Bot**
  - Add to group chats or message directly.
  - Automatically detects token addresses and replies with onchain analysis.
- **Discord Bot**

  - Add to channels.
  - Auto-detects token addresses posted in messages and replies with analytics.

- **Twitter Bot**
  - Tag the bot with a token address in a tweet.
  - The bot replies with an onchain risk breakdown.

### 🔎 Developer Wallet Tracking

- From Telegram, track the **creators/dev wallets** of any token.
- Get real-time notifications when they:
  - **Buy** more of the token.
  - **Sell** or **dump** their holdings.
- Helps users detect **potential rugpulls** or suspicious dev behavior.

### 🗳️ Community Voting with Wallets

- wallet system integrated into:
  - Telegram
  - Discord
- Users can **upvote** or **downvote** a token to express community sentiment.
- Each vote is recorded onchain using burner wallets generated per user/session.

## ⚙️ Functional Architecture

### 1. **Bot Interface Layer**

Handles interactions with:

- Telegram Bot API
- Discord WebSocket Events
- Twitter Mentions Listener

### 2. **Token Scanner Service**

- Parses the token address
- Queries onchain data
- Outputs a structured risk analysis

### 3. **Dev Wallet Tracker**

- Resolves contract deployer
- Subscribes to their onchain activity.
- Notifies user on any buy/sell related to the token

### 4. **Wallet Voting System**

- Each user has a wallet via Telegram or Discord
- Allows upvote/downvote of token
- Broadcasts votes to public log
- Prevents multiple votes per user per token

---

## 🧪 Example Usage

### Telegram

- Add the bot to your group:

- Paste a token address:
  → Bot replies with token scan result

- Track dev wallet:
  → Bot starts monitoring the dev

- Vote on a token:

### Discord

- Paste token address in any channel:
  → Bot replies with scan and voting options

### Twitter

- Tag `@CheckM8_Bot` with a token address:
  → The bot replies with a risk report

## 📈 Future Features

- Web dashboard for analytics and token tracking
- Wallet reputation score (WRS)
- Integration with Telegram Mini App for voting UI
- Daily/weekly top voted token summaries
- Anti-scam AI classifier

---

## 📬 Get in Touch

- **Telegram Bot:** [@CheckM8_Bot](https://t.me/CheckM8_Bot)
- **Discord Bot Invite:** [Invite Link](https://discord.com/oauth2/authorize?client_id=1358869096560853162&permissions=1689934340028480&integration_type=0&scope=bot)
- **Twitter:** [@CheckM8_Bot](https://x.com/CheckM8_Bot)

---

## 🧑‍💻 Contributing

Contributions are welcome! Please open an issue or pull request if you'd like to help improve CheckM8.

---

## 🪪 License

MIT License. See `LICENSE` file for details.
