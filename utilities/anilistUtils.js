const axios = require('axios');

const ANILIST_API_URL = 'https://graphql.anilist.co';

/**
 * Base function to fetch data from AniList GraphQL API
 * @param {string} query - The GraphQL query string
 * @param {object} variables - The variables for the query
 * @returns {Promise<any>} - The data from the response
 */
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
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    return response.data.data;
  } catch (error) {
    if (error.response) {
      console.error('Anilist API Error:', JSON.stringify(error.response.data, null, 2));
      throw new Error(`Anilist API Error: ${error.response.status} - ${JSON.stringify(error.response.data.errors)}`);
    } else {
      console.error('Network/Request Error:', error.message);
      throw error;
    }
  }
};

// ==========================================
//                 QUERIES
// ==========================================

const MEDIA_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
    userPreferred
  }
  type
  format
  status
  description
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
  seasonInt
  episodes
  duration
  chapters
  volumes
  countryOfOrigin
  isLicensed
  source
  hashtag
  trailer {
    id
    site
    thumbnail
  }
  updatedAt
  coverImage {
    extraLarge
    large
    medium
    color
  }
  bannerImage
  genres
  synonyms
  averageScore
  meanScore
  popularity
  isLocked
  trending
  favourites
  tags {
    id
    name
    description
    category
    rank
    isGeneralSpoiler
    isMediaSpoiler
    isAdult
  }
  relations {
    edges {
      id
      relationType(version: 2)
      node {
        id
        title {
          romaji
          english
          native
        }
        format
        type
        status
        coverImage {
          medium
        }
      }
    }
  }
  characters(page: 1, perPage: 500, sort: [ROLE, RELEVANCE]) {
    edges {
      id
      role
      node {
        id
        name {
          full
          native
        }
        image {
          medium
        }
      }
      voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
        id
        name {
          full
          native
        }
        image {
          medium
        }
      }
    }
  }
  recommendations(page: 1, perPage: 25, sort: RATING_DESC) {
    edges {
      node {
        id
        mediaRecommendation {
          id
          title {
            romaji
            english
            native
          }
        }
      }
    }
  }
  studios(isMain: true) {
    edges {
      isMain
      node {
        id
        name
      }
    }
  }
  externalLinks {
    id
    url
    site
    type
    language
  }
  rankings {
    id
    rank
    type
    format
    year
    season
    allTime
    context
  }
  nextAiringEpisode {
    id
    airingAt
    timeUntilAiring
    episode
  }
`;

const USER_FIELDS = `
  id
  name
  about
  avatar {
    large
    medium
  }
  bannerImage
  isFollowing
  isFollower
  isBlocked
  bans
  options {
    titleLanguage
    displayAdultContent
    airingNotifications
    profileColor
  }
  mediaListOptions {
    scoreFormat
    rowOrder
  }
  favourites {
    anime {
      edges {
        node {
          id
          title {
            userPreferred
          }
        }
      }
    }
    manga {
      edges {
        node {
          id
          title {
            userPreferred
          }
        }
      }
    }
    characters {
      edges {
        node {
          id
          name {
            full
          }
        }
      }
    }
  }
  statistics {
    anime {
      count
      meanScore
      standardDeviation
      minutesWatched
      episodesWatched
      chaptersRead
      volumesRead
      formats {
        format
        count
        meanScore
        minutesWatched
      }
      statuses {
        status
        count
        meanScore
        minutesWatched
      }
      scores {
        score
        count
        meanScore
        minutesWatched
      }
      lengths {
        length
        count
        meanScore
        minutesWatched
      }
      countries {
        country
        count
        meanScore
        minutesWatched
      }
      startYears {
        startYear
        count
        meanScore
        minutesWatched
      }
    }
    manga {
      count
      meanScore
      standardDeviation
      minutesWatched
      episodesWatched
      chaptersRead
      volumesRead
      formats {
        format
        count
        meanScore
        chaptersRead
      }
      statuses {
        status
        count
        meanScore
        chaptersRead
      }
      scores {
        score
        count
        meanScore
        chaptersRead
      }
      lengths {
        length
        count
        meanScore
        chaptersRead
      }
      countries {
        country
        count
        meanScore
        chaptersRead
      }
      startYears {
        startYear
        count
        meanScore
        chaptersRead
      }
    }
  }
  unreadNotificationCount
  siteUrl
  donatorTier
  donatorBadge
  moderatorRoles
  updatedAt
`;

// ==========================================
//                 FUNCTIONS
// ==========================================

/**
 * Get detailed information about a media (Anime or Manga) by search term
 * @param {string} search - The search term
 * @param {string} type - 'ANIME' or 'MANGA'
 * @returns {Promise<object>}
 */
const getMedia = async (search, type) => {
  const query = `
    query ($search: String, $type: MediaType) {
      Media (search: $search, type: $type) {
        ${MEDIA_FIELDS}
      }
    }
  `;
  const data = await fetchGraphQL(query, { search, type });
  return data.Media;
};

/**
 * Get detailed information about a media by ID
 * @param {number} id - The media ID
 * @returns {Promise<object>}
 */
const getMediaById = async (id) => {
  const query = `
    query ($id: Int) {
      Media (id: $id) {
        ${MEDIA_FIELDS}
      }
    }
  `;
  const data = await fetchGraphQL(query, { id });
  return data.Media;
};

/**
 * Get a list of media based on various filters (Top, Trending, Popular, Seasonal)
 * @param {object} options - Filter options
 * @param {number} [options.page=1]
 * @param {number} [options.perPage=10]
 * @param {string} [options.type] - 'ANIME' or 'MANGA'
 * @param {string} [options.search] - Search query
 * @param {string} [options.sort] - e.g., 'SCORE_DESC', 'POPULARITY_DESC', 'TRENDING_DESC'
 * @param {string} [options.genre]
 * @returns {Promise<object>}
 */
const getMediaList = async ({ page = 1, perPage = 10, type, search, sort, genre, seasonYear, season, status, startDateGreater, startDateLesser }) => {
  const query = `
    query ($page: Int, $perPage: Int, $type: MediaType, $search: String, $sort: [MediaSort], $genre: String, $seasonYear: Int, $season: MediaSeason, $status: MediaStatus, $startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt) {
      Page (page: $page, perPage: $perPage) {
        pageInfo {
          total
          perPage
          currentPage
          lastPage
          hasNextPage
        }
        media (type: $type, search: $search, sort: $sort, genre: $genre, seasonYear: $seasonYear, season: $season, status: $status, startDate_greater: $startDateGreater, startDate_lesser: $startDateLesser) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { page, perPage, type, search, sort, genre, seasonYear, season, status, startDateGreater, startDateLesser });
  return data.Page;
};

/**
 * Get a random media
 * @param {string} type - 'ANIME' or 'MANGA'
 * @returns {Promise<object>}
 */
const getRandomMedia = async (type) => {
  // We fetch a random page of 1 item from a large pool to simulate randomness effectively
  // or use a random page approach if we knew the total.
  // A better approach for true randomness with AniList API is often:
  // 1. Get a random page from a large range (heuristic)
  // 2. Or use the 'id' range if known.
  // However, the existing 'random.js' used a large perPage and picked one.
  // Let's use a more efficient method:
  // Fetch a random page from the first 500 pages of trending/popular or just a random page.

  // Strategy: Get total count first? No, that's two requests.
  // Strategy from existing code: Page(perPage: 5000) -> pick random. This is heavy but "random" enough for the user's previous code.
  // Let's optimize: Fetch 50 items from a random page (1-1000).

  const randomPage = Math.floor(Math.random() * 1000) + 1;

  const query = `
    query ($page: Int, $type: MediaType) {
      Page (page: $page, perPage: 50) {
        media (type: $type, sort: POPULARITY_DESC) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query, { page: randomPage, type });
    const mediaList = data.Page.media;
    if (mediaList.length === 0) {
      // Fallback to page 1 if random page was empty
      const fallbackData = await fetchGraphQL(query, { page: 1, type });
      return fallbackData.Page.media[Math.floor(Math.random() * fallbackData.Page.media.length)];
    }
    return mediaList[Math.floor(Math.random() * mediaList.length)];
  } catch (e) {
    // Fallback if page is out of range
    const fallbackData = await fetchGraphQL(query, { page: 1, type });
    return fallbackData.Page.media[Math.floor(Math.random() * fallbackData.Page.media.length)];
  }
};

/**
 * Get User Profile by Username
 * @param {string} username
 * @returns {Promise<object>}
 */
const getUserProfile = async (username) => {
  const query = `
    query ($username: String) {
      User (name: $username) {
        ${USER_FIELDS}
      }
    }
  `;
  const data = await fetchGraphQL(query, { username });
  return data.User;
};

/**
 * Get User Profile by ID
 * @param {number} id
 * @returns {Promise<object>}
 */
const getUserById = async (id) => {
  const query = `
    query ($id: Int) {
      User (id: $id) {
        ${USER_FIELDS}
      }
    }
  `;
  const data = await fetchGraphQL(query, { id });
  return data.User;
};

/**
 * Get User's Recent Activities
 * @param {number} userId
 * @param {number} [page=1]
 * @param {number} [perPage=10]
 * @returns {Promise<array>}
 */
const getUserRecentActivity = async (userId, page = 1, perPage = 10) => {
  const query = `
    query ($userId: Int, $page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        activities (userId: $userId, sort: ID_DESC) {
          ... on ListActivity {
            id
            userId
            type
            status
            progress
            replyCount
            createdAt
            media {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                medium
              }
            }
          }
          ... on TextActivity {
            id
            userId
            type
            text
            replyCount
            createdAt
            user {
              id
              name
              avatar {
                medium
              }
            }
          }
          ... on MessageActivity {
            id
            recipientId
            messengerId
            type
            message
            replyCount
            createdAt
            messenger {
              id
              name
              avatar {
                medium
              }
            }
          }
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { userId, page, perPage });
  return data.Page.activities;
};

/**
 * Get Character Information
 * @param {string} search
 * @returns {Promise<object>}
 */
const getCharacter = async (search) => {
  const query = `
    query ($search: String) {
      Character (search: $search) {
        id
        name {
          first
          middle
          last
          full
          native
          userPreferred
        }
        image {
          large
          medium
        }
        description
        gender
        dateOfBirth {
          year
          month
          day
        }
        age
        bloodType
        siteUrl
        media (page: 1, perPage: 10, sort: POPULARITY_DESC) {
          edges {
            id
            characterRole
            node {
              id
              title {
                romaji
                english
              }
              coverImage {
                medium
              }
            }
          }
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { search });
  return data.Character;
};

/**
 * Get Staff Information
 * @param {string} search
 * @returns {Promise<object>}
 */
const getStaff = async (search) => {
  const query = `
    query ($search: String) {
      Staff (search: $search) {
        id
        name {
          first
          middle
          last
          full
          native
          userPreferred
        }
        languageV2
        image {
          large
          medium
        }
        description
        primaryOccupations
        gender
        dateOfBirth {
          year
          month
          day
        }
        dateOfDeath {
          year
          month
          day
        }
        age
        yearsActive
        homeTown
        bloodType
        siteUrl
        staffMedia (page: 1, perPage: 10, sort: POPULARITY_DESC) {
          edges {
            id
            staffRole
            node {
              id
              title {
                romaji
                english
              }
              coverImage {
                medium
              }
            }
          }
        }
        characters (page: 1, perPage: 10, sort: FAVOURITES_DESC) {
          edges {
            id
            role
            node {
              id
              name {
                full
              }
              image {
                medium
              }
            }
          }
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { search });
  return data.Staff;
};

/**
 * Get Studio Information
 * @param {string} search
 * @returns {Promise<object>}
 */
const getStudio = async (search) => {
  const query = `
    query ($search: String) {
      Studio (search: $search) {
        id
        name
        isAnimationStudio
        siteUrl
        favourites
        media (page: 1, perPage: 10, sort: POPULARITY_DESC) {
          nodes {
            id
            title {
              romaji
              english
            }
            coverImage {
              medium
            }
          }
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { search });
  return data.Studio;
};

/**
 * Get Airing Schedule
 * @param {number} start - Unix timestamp for start of range
 * @param {number} end - Unix timestamp for end of range
 * @param {number} [page=1]
 * @param {number} [perPage=20]
 * @returns {Promise<object>}
 */
const getAiringSchedule = async (start, end, page = 1, perPage = 20) => {
  const query = `
    query ($start: Int, $end: Int, $page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        pageInfo {
          total
          perPage
          currentPage
          lastPage
          hasNextPage
        }
        airingSchedules (airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id
          airingAt
          timeUntilAiring
          episode
          media {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              medium
            }
            siteUrl
          }
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { start, end, page, perPage });
  return data.Page;
};

/**
 * Get all characters for a media by ID with pagination
 * @param {number} mediaId - The media ID
 * @param {number} [page=1] - Page number
 * @param {number} [perPage=25] - Items per page (max 25 for AniList)
 * @returns {Promise<object>}
 */
const getMediaCharacters = async (mediaId, page = 1, perPage = 25) => {
  const query = `
    query ($mediaId: Int, $page: Int, $perPage: Int) {
      Media(id: $mediaId) {
        id
        characters(page: $page, perPage: $perPage, sort: [ROLE, RELEVANCE]) {
          pageInfo {
            total
            perPage
            currentPage
            lastPage
            hasNextPage
          }
          edges {
            id
            role
            node {
              id
              name {
                full
                native
              }
              image {
                medium
              }
            }
          }
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { mediaId, page, perPage });
  return data.Media.characters;
};

/**
 * Get all relations for a media by ID
 * Note: AniList API doesn't support pagination on relations field
 * @param {number} mediaId - The media ID
 * @returns {Promise<object>}
 */
const getMediaRelations = async (mediaId) => {
  const query = `
    query ($mediaId: Int) {
      Media(id: $mediaId) {
        id
        relations {
          edges {
            id
            relationType(version: 2)
            node {
              id
              title {
                romaji
                english
                native
              }
              format
              type
              status
            }
          }
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { mediaId });
  return data.Media.relations;
};

module.exports = {
  fetchGraphQL,
  getMedia,
  getMediaById,
  getMediaList,
  getRandomMedia,
  getUserProfile,
  getUserById,
  getUserRecentActivity,
  getCharacter,
  getStaff,
  getStudio,
  getAiringSchedule,
  getMediaCharacters,
  getMediaRelations
};
