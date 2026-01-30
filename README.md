<div align="center">
  <img src="https://telegra.ph/file/a75224364402636a04803.jpg" alt="MadBot Banner" width="100%">
  
  # MadBot (Madlink-Manga)
  
  **The Ultimate Anime & Manga Companion for Telegram**
  
  [![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
  [![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
</div>

---

## 📖 Overview

**MadBot** is a feature-packed Telegram bot designed for anime and manga enthusiasts. It serves as a comprehensive tool for discovering content, managing groups, downloads, and more. With its robust backend and user-friendly interface, keeping up with your favorite series has never been easier.

## ✨ Features

- **Anime & Manga Search**: Instantly retrieve detailed information about anime and manga from sources like Anilist.
- **Media Downloader**:
  - **YouTube**: Download videos and audio directly from YouTube links.
  - **Nhentai**: (NSFW) Download doujinshi with ease.
- **Schedule Tracking**: Stay updated with the latest anime release schedules.
- **Group Management**:
  - **Force Subscription**: ensure users join specific channels before using the bot.
  - **Welcome Messages**: Custom greetings for new members.
- **Web Dashboard**: A full-featured admin panel to view analytics, manage users, and configure settings.
- **AI Integration**: Powered by Google Gemini for smart chat interactions.
- **Deep Linking**: Secure file retrieval and sharing via storage channels.
- **Broadcast System**: Send announcements to all bot users.

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Connection URI required)
- [Git](https://git-scm.com/)

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd madlink-manga
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add the following configurations (adjust values as needed):
   
   ```env
   # Bot Configuration
   BOT_TOKEN=your_telegram_bot_token
   OWNER_ID=your_telegram_user_id
   
   # Database
   MONGO_URI=your_mongodb_connection_string
   
   # Web Dashboard
   PORT=2631
   SESSION_SECRET=your_random_secret_string
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=password
   
   # APIs & Services
   GEMINI_API_KEY=your_gemini_api_key
   IMGUR_CLIENT_ID_1=your_imgur_client_id
   
   # Channels (IDs must be integers or strings depending on library usage)
   STORAGE_GROUP_ID=-100xxxxxxxxxx
   GC_ID=-100xxxxxxxxxx
   POST_FILE_GC_ID=-100xxxxxxxxxx
   ```

4. **Start the Bot**
   ```bash
   npm start
   ```
   *For development with auto-reload:*
   ```bash
   npm run dev 
   # (Requires nodemon: npm install -g nodemon)
   ```

## 🎮 Commands

Here are some of the main commands available:

| Command | Description |
|:--- |:--- |
| `/start` | Start the bot and check subscription status. |
| `/help` | Display the help menu with all commands. |
| `/anime <name>` | Search for an anime. |
| `/manga <name>` | Search for a manga. |
| `/ytb <link>` | Download video/audio from YouTube. |
| `/music <name>` | Search and download music. |
| `/schedule` | detailed anime airing schedule. |
| `/top` | View top-rated anime/manga. |
| `/gemini <text>` | Chat with the AI assistant. |
| `/login` | Access the web dashboard login (link). |

## 📁 Directory Structure

```
madlink-manga/
├── commands/       # Bot command handlers
├── DB/             # Database models and connection
├── page/           # Web dashboard frontend files
├── routes/         # Express API routes
├── utilities/      # Helper functions (cron, formatting, etc.)
├── index.js        # Main bot entry point
├── server.js       # Express server entry point
└── .env            # Environment configuration
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the ISC License.
