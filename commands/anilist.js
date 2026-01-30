const axios = require("axios");
const User = require("../DB/User");
const { getUserProfile, getUserById, getUserRecentActivity } = require("../utilities/anilistUtils");

module.exports = {
  name: "anilist",
  version: 1.0,
  longDescription: "Manage and view your AniList stats/activity, or other username.",
  shortDescription: "View your AniList activity and stats",
  guide: "{pn} [[set | del | view]] [[username]]" +
    "\n\n─── Usage:\n• `{pn} set username` - to save your AniList username" +
    "\n• `{pn} del` - to delete your saved username" +
    "\n• `{pn} view username` - to view someone else's AniList data" +
    "\n• `{pn}` - to view your AniList activity" +
    "\n\n─── Example:" +
    "\n• `{pn} set Sharkynemesis`",
  category: ['Anime & Manga Information', 3],
  lang: {
    setSuccess: "Username has been saved.",
    syntaxError: "The command you are using is wrong syntax, please type %1help %2 to see the details of how to use this command",
    delSuccess: "Your AniList username has been deleted from the bot.",
    noUser: "You haven't set your AniList username yet. Use `/anilist set username`.",
    error: "Error fetching user data. Make sure the username is correct and that your AniList profile is public.",
  },

  onStart: async ({ bot, msg, args }) => {
    const chatId = msg.chat.id;

    if (!args || args.length === 0) {
      const user = await User.findOne({ userId: msg.from.id });
      if (!user || !user.anilistUsername) {
        return bot.sendMessage(chatId, module.exports.lang.noUser, { parse_mode: "Markdown" });
      }
      return displayAniListData(bot, chatId, user.anilistUsername, user.anilistId);
    }

    const subCommand = args[0].toLowerCase();

    if (subCommand === "set") {
      const anilistUsername = args.slice(1).join(" ");
      if (!anilistUsername) {
        return bot.sendMessage(chatId, `Usage: /anilist set username`);
      }
      try {
        const userProfile = await getUserProfile(anilistUsername);
        await User.findOneAndUpdate(
          { userId: msg.from.id },
          {
            anilistUsername: anilistUsername,
            anilistId: userProfile.id
          },
          { upsert: true, new: true }
        );
        return bot.sendMessage(chatId, module.exports.lang.setSuccess);
      } catch (error) {
        console.error("Error saving username:", error);
        return bot.sendMessage(chatId, module.exports.lang.error);
      }
    } else if (subCommand === "del") {
      try {
        await User.findOneAndUpdate(
          { userId: msg.from.id },
          {
            $unset: {
              anilistUsername: "",
              anilistId: ""
            }
          }
        );
        return bot.sendMessage(chatId, module.exports.lang.delSuccess);
      } catch (error) {
        console.error("Error deleting username:", error);
        return bot.sendMessage(chatId, module.exports.lang.error);
      }
    } else if (subCommand === "view") {
      const username = args.slice(1).join(" ");
      if (!username) {
        return bot.sendMessage(chatId, `Usage: /anilist view username`);
      }
      return displayAniListData(bot, chatId, username);
    } else {
      return bot.sendMessage(chatId, module.exports.lang.syntaxError, { parse_mode: "Markdown" });
    }
  },
};

async function displayAniListData(bot, chatId, username, storedId = null) {
  try {
    await bot.sendChatAction(chatId, "typing");

    // Get user profile (includes ID and statistics)
    const userProfile = storedId ? await getUserById(storedId) : await getUserProfile(username);
    const userId = userProfile.id;
    const stats = userProfile.statistics;

    // Get recent activity
    const recentActivity = await getUserRecentActivity(userId);
    const metaImageUrl = `https://img.anili.st/user/${userId}`;

    let message = `❏ Recent activity of \`${username}\`:\n\n`;
    message += `*Anime Stats:*\n➤ Total Anime: ${stats.anime.count}\n➤ Days Watched: ${Math.round(
      stats.anime.minutesWatched / 60 / 24
    )}\n➤ Mean Score: ${stats.anime.meanScore}\n\n`;
    message += `*Manga Stats:*\n➤ Total Manga: ${stats.manga.count}\n➤ Chapters Read: ${stats.manga.chaptersRead}\n➤ Mean Score: ${stats.manga.meanScore}\n\n`;
    message += `*Recent Activities:*\n`;

    recentActivity.forEach((activity) => {
      if (activity.media) {
        const { romaji, english, native } = activity.media.title;
        const mediaTitle = english || romaji || native;
        message += `➤ ${activity.status.charAt(0).toUpperCase() + activity.status.slice(1)} ${activity.progress ? activity.progress : ""
          }: \`${mediaTitle}\`\n`;
      }
    });

    const response = await axios.get(metaImageUrl, { responseType: "stream" });
    return bot.sendPhoto(chatId, response.data, {
      caption: message,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Profile",
              url: `https://anilist.co/user/${username}`,
            },
          ],
        ],
      },
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return bot.sendMessage(chatId, module.exports.lang.error);
  }
}