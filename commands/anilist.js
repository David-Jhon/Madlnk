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
            },
        );
        return response.data.data;
    } catch (error) {
        console.error("Error in GraphQL request:", error);
        throw error;
    }
};

// Fetch user ID by username
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

module.exports = (bot) => {
    bot.onText(/\/anilist set (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const anilistUsername = match[1];

        try {
            await User.findOneAndUpdate(
                { userId: msg.from.id },
                { anilistUsername: anilistUsername },
                { upsert: true, new: true },
            );
            bot.sendMessage(chatId, "Username has been saved.");
        } catch (error) {
            console.error("Error saving username:", error);
            bot.sendMessage(
                chatId,
                "Error saving username. Make sure the username is correct and the privacy is set to public.",
            );
        }
    });

    bot.onText(/\/anilist del/, async (msg) => {
        const chatId = msg.chat.id;

        try {
            await User.findOneAndUpdate(
                { userId: msg.from.id },
                { $unset: { anilistUsername: "" } },
            );
            bot.sendMessage(
                chatId,
                "Your AniList username has been deleted from the bot",
            );
        } catch (error) {
            console.error("Error deleting username:", error);
            bot.sendMessage(
                chatId,
                "Error deleting username. Please try again.",
            );
        }
    });

    bot.onText(/\/anilist$/, async (msg) => {
        const chatId = msg.chat.id;

        try {
            const user = await User.findOne({ userId: msg.from.id });
            if (!user || !user.anilistUsername) {
                bot.sendMessage(
                    chatId,
                    `Please set your AniList username first.
\nUsages:
\`/anilist set username\` : To save your Anilist username
\`/anilist view username\` : To get intel on the provided username
\`/anilist\` : Get your anilist activity
\`/anilist del\` : To delete your anilist username\n\nExample:
/anilist set SharkyNemesis
/anilist view Pokimaru`,
                    { parse_mode: "Markdown" }
                );
                return;
            }

            const userId = await getUserId(user.anilistUsername);
            const recentActivity = await getUserRecentActivity(userId);
            const stats = await getUserStats(userId);
            const metaImageUrl = `https://img.anili.st/user/${userId}`;

            let message = `❏ Recent activity of \`${user.anilistUsername}\`:\n\n`;
            message += `*Anime Stats:*\n➤ Total Anime: ${stats.anime.count}\n➤ Days Watched: ${Math.round(stats.anime.minutesWatched / 60 / 24)}\n➤ Mean Score: ${stats.anime.meanScore}\n\n`;
            message += `*Manga Stats:*\n➤ Total Manga: ${stats.manga.count}\n➤ Chapters Read: ${stats.manga.chaptersRead}\n➤ Mean Score: ${stats.manga.meanScore}\n\n`;
            message += `*Recent Activities:*\n`;
            recentActivity.forEach((activity) => {
                if (activity.media) {
                    const { romaji, english, native } = activity.media.title;
                    const mediaTitle =  english || romaji || native;
                    message += `➤ ${activity.status.charAt(0).toUpperCase() + activity.status.slice(1)} ${activity.progress ? `${activity.progress}` : ""}: \`${mediaTitle}\`\n`;
                }
            });

            const response = await axios.get(metaImageUrl, { responseType: 'stream' });
            bot.sendPhoto(chatId, response.data, {
                caption: message,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Profile",
                                url: `https://anilist.co/user/${user.anilistUsername}`,
                            },
                        ],
                    ],
                },
            });
        } catch (error) {
            console.error("Error fetching user data:", error);
            bot.sendMessage(
                chatId,
                "Error fetching user data. Make sure the username is correct and the privacy is set to public.",
            );
        }
    });

    bot.onText(/\/anilist view (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const username = match[1];

        try {
            const userId = await getUserId(username);
            const recentActivity = await getUserRecentActivity(userId);
            const metaImageUrl = `https://img.anili.st/user/${userId}`;

            let message = `❏ Recent activity of \`${username}\`:\n\n`;
            recentActivity.forEach((activity) => {
                if (activity.media) {
                    const { romaji, english, native } = activity.media.title;
                    const mediaTitle = english || romaji ||  native;
                    message += `➤ ${activity.status.charAt(0).toUpperCase() + activity.status.slice(1)} ${activity.progress ? `${activity.progress}` : ""}: \`${mediaTitle}\`\n`;
                }
            });

            const response = await axios.get(metaImageUrl, { responseType: 'stream' });
            bot.sendPhoto(chatId, response.data, {
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
            bot.sendMessage(
                chatId,
                "Error fetching user data. Make sure the username is correct and the privacy is set to public.",
            );
        }
    });
};