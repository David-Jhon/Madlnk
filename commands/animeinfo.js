const axios = require("axios");

const ANILIST_URL = "https://graphql.anilist.co/";

module.exports = function (bot) {
  bot.on("text", async (msg) => {
    const command = msg.text.trim().split(" ")[0].toLowerCase();
    const animeTitle = msg.text.trim().split(" ").slice(1).join(" ");

    if (command === "/animeinfo") {
      if (!animeTitle) {
        return bot.sendMessage(
          msg.chat.id,
          "Please provide an anime title to search for.\nFormat: /anime <anime name> \nExample: /animeinfo one punch man.",
        );
      }

      try {
        const query = `
        query ($title: String) {
          Media (search: $title, type: ANIME) {
            id
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              medium
              large
            }
            genres
            format
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            season
            seasonYear
            episodes
            status
            averageScore
            tags {
            name
            }
            genres
            relations {
            edges {
              relationType(version: 2)
              node {
                id
                title {
                  romaji
                  english
                }
              }
            }
          }
          }
        }
      `;

        const variables = {
          title: animeTitle,
        };

        const response = await axios.post(ANILIST_URL, { query, variables });
        const animeData = response.data.data.Media;

        if (!animeData) {
          return bot.sendMessage(
            msg.chat.id,
            `No anime found with the title: ${animeTitle}`,
          );
        }

        const { romaji, english, native } = animeData.title;
        let title = "";
        if (english) {
          title += `\`${english}\`\n`;
        }
        if (romaji) {
          title += `• \`${romaji}\`\n`;
        }
        if (native) {
          title += `• \`${native}\`\n`;
        }
        const description =
          animeData.description.replace(/<[^>]+>/g, " ").substring(0, 900) +
          "...";
        const genres = animeData.genres.join(", ");
        const tags = animeData.tags
          .slice(0, 5)
          .map((tag) => tag.name)
          .join(", ");
        const format = animeData.format;
        const startDate = `${animeData.startDate.day}-${animeData.startDate.month}-${animeData.startDate.year}`;
        const endDate = animeData.endDate
          ? `${animeData.endDate.day}-${animeData.endDate.month}-${animeData.endDate.year}`
          : "Still Airing";
        const season = animeData.season;
        const seasonYear = animeData.seasonYear;
        const episodes = animeData.episodes || "N/A";
        const status = animeData.status;
        const averageScore = animeData.averageScore;
        const id = animeData.id;
        const coverImage = `https://img.anili.st/media/${id}`;

        let relations = "";
        animeData.relations.edges.forEach((edge) => {
          if (
            edge.relationType === "PREQUEL" ||
            edge.relationType === "SEQUEL"
          ) {
            relations += `*${edge.relationType}:* \`${edge.node.title.english || edge.node.title.romaji}\n\``;
          }
        });

        // const source = animeData.source;
        // const airingAt = animeData.airingAt;
        bot.sendPhoto(msg.chat.id, coverImage).then(() => {
          const message = `❏ *Title:* ${title}
*➤ Type:* ${format}
*➤ Genres:* ${genres}
*➤ Tags:* ${tags}
*➤ Start Date:* ${startDate}
*➤ End Date:* ${endDate}
*➤ Seaon:* ${season}, ${seasonYear}
*➤ Episodes:* ${episodes}
*➤ Status:* ${status}
*➤ Score:* ${averageScore}\n
${relations ? "*➤ Relations:*\n" + relations : ""}
*➤ Description:* ${description}
`;
          // bot.sendPhoto(msg.chat.id, coverImage)
          bot.sendMessage(msg.chat.id, message, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "More Info", url: `https://anilist.co/anime/${id}` }],
              ],
            },
          });
        });
      } catch (error) {
        console.error(error);
        bot.sendMessage(
          msg.chat.id,
          "An error occurred while fetching anime information. Try the romanji name or a proper name.",
        );
      }
    }
  });
};
