const axios = require("axios");
const User = require("../DB/User");

const ANILIST_API_URL = "https://graphql.anilist.co";

const fetchGraphQL = async (query, variables) => {
  try {
    const response = await axios.post(
      ANILIST_API_URL,
      {
        query: query,
        variables: variables,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    return response.data.data;
  } catch (error) {
    console.error("Error in GraphQL request:", error);
    throw error;
  }
};

async function getUserId(username) {
  const query = `
        query ($username: String) {
            User(name: $username) {
                id
            }
        }
    `;
  const data = await fetchGraphQL(query, { username });
  return data.User.id;
}

async function getUserRecentActivity(userId) {
  const query = `
        query ($userId: Int) {
            Page(page: 1, perPage: 10) {
                activities(userId: $userId, sort: ID_DESC) {
                    ... on ListActivity {
                        id
                        status
                        progress
                        createdAt
                        media {
                            title {
                                romaji
                                english
                                native
                            }
                        }
                    }
                }
            }
        }
    `;
  const data = await fetchGraphQL(query, { userId });
  return data.Page.activities;
}

async function getUserStats(userId) {
  const query = `
        query ($userId: Int) {
            User(id: $userId) {
                statistics {
                    anime {
                        count
                        meanScore
                        minutesWatched
                    }
                    manga {
                        count
                        meanScore
                        chaptersRead
                    }
                }
            }
        }
    `;
  const data = await fetchGraphQL(query, { userId });
  return data.User.statistics;
}

module.exports = {
  name: "anilist",
  version: 1.0,
  longDescription: "Manage and view your AniList stats/activity, or other username.",
  shortDescription: "View your AniList activity and stats",
  guide: "{pn} [[set | del | view]] [[username]]"+
  "\n\n─── Usage:\n• `{pn} set username` - to save your AniList username"+
  "\n• `{pn} del` - to delete your saved username"+
  "\n• `{pn} view username` - to view someone else's AniList data"+
  "\n• `{pn}` - to view your AniList activity"+
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
        const anilistId = await getUserId(anilistUsername);
        await User.findOneAndUpdate(
          { userId: msg.from.id },
          { 
            anilistUsername: anilistUsername,
            anilistId: anilistId 
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
              anilistId: "" } }
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
    
    const userId = storedId || await getUserId(username);
    const recentActivity = await getUserRecentActivity(userId);
    const stats = await getUserStats(userId);
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
  }  catch (error) {
    console.error("Error fetching user data:", error);
    return bot.sendMessage(chatId, module.exports.lang.error);
  }
}