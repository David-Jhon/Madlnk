/**
 * Command Template
 *
 * This template outlines the structure for creating a new command module.
 * Place your new command file inside the "commands" directory.
 *
 * Each command module should export an object containing:
 *  - Metadata (name, version, descriptions, guide, etc.)
 *  - A "lang" object for localized strings and messages.
 *  - An "onStart" function to handle the command invocation (e.g., /commandName).
 *  - Optionally, an "onCallback" function to handle inline keyboard callback queries.
 *  - Optionally, an "onChat" function to handle chat messages (if needed).
 *
 * When the command is loaded, the bot's command loader (from index.js) will register
 * handlers for the command's onStart (and optionally onCallback and onChat) functions.
 */

module.exports = {
    // Command name (triggered by /commandName)
    name: 'commandName',
  
    // Version of the command
    version: 1.0,
  
    // A longer, detailed description of what the command does.
    longDescription: 'A detailed description of the command, its functionality, and any special features.',
  
    // A short description that can be used in help menus.
    shortDescription: 'Brief summary of command functionality.',
  
    // A usage guide that explains how to use the command.
    // For example: "{pn} <argument1> [optionalArgument]" where {pn} is replaced by the command prefix.
    guide: '{pn} <requiredArg> [optionalArg]',

    // Category of the command. Used for grouping commands in help menus. 1 is the order value.
    category: ['Category Name', 1],
  
    // Language/localization strings for common messages related to the command.
    lang: {
      usage: 'Usage: /commandName <requiredArg> [optionalArg]',
      error: 'An error occurred while processing your command.',
      notFound: 'No results found for your query.'
    },
  
    /**
     * onStart: This function is called when the command is invoked via a message.
     *
     * Parameters:
     *  - {Object} params - The parameters object.
     *  - {Object} params.bot - The instance of the Telegram bot.
     *  - {Object} params.msg - The incoming Telegram message object.
     *  - {Array}  params.args - The array of arguments passed to the command (split by space).
     *
     * Example: User sends "/commandName value1 value2"
     *          args will be ["value1", "value2"]
     */
    onStart: async ({ bot, msg, args }) => {
      const chatId = msg.chat.id;
      
      // Example: Check if required arguments are provided
      if (!args || args.length === 0) {
        return bot.sendMessage(chatId, module.exports.lang.usage);
      }
  
      // Your command logic goes here.
      // For example, process the args, call external APIs, etc.
      try {
        // ... command-specific code ...
        bot.sendMessage(chatId, 'Command executed successfully!');
      } catch (error) {
        console.error('Error in command execution:', error);
        bot.sendMessage(chatId, module.exports.lang.error);
      }
    },
  
    /**
     * onCallback (Optional): This function is called when an inline keyboard button
     * associated with this command is pressed.
     *
     * Parameters:
     *  - {Object} params - The parameters object.
     *  - {Object} params.bot - The instance of the Telegram bot.
     *  - {Object} params.callbackQuery - The Telegram callback query object.
     *  - {Array}  params.params - The array of parameters extracted from the callback data.
     *
     * Example callback data format: "commandName:param1:param2"
     */
    onCallback: async ({ bot, callbackQuery, params }) => {
      // Ensure the callback query is answered to remove the loading state.
      try {
        // ... callback-specific code ...
        bot.answerCallbackQuery(callbackQuery.id);
      } catch (error) {
        console.error('Error processing callback:', error);
        bot.answerCallbackQuery(callbackQuery.id, { text: module.exports.lang.error });
      }
    },
  
    /**
     * onChat (Optional): This function is triggered on every incoming text message.
     * Use this handler if you want your command to monitor or respond to messages that
     * are not direct command invocations (e.g., for interactive chat sessions).
     *
     * Parameters:
     *  - {Object} params - The parameters object.
     *  - {Object} params.bot - The instance of the Telegram bot.
     *  - {Object} params.msg - The incoming Telegram message object.
     *  - {Array}  params.args - The array of words from the message.
     */
    onChat: async ({ bot, msg, args }) => {
      // Optional: Add chat-specific logic here.
      // For example, listen for certain keywords or phrases.
    },
  };
  
  /* Key Notes for Command Development:
  1. File Location: Save in ./commands/ folder as [commandName].js
  2. Callback Data Format: Use "commandName:action:parameters" format
  3. Error Handling: Always wrap in try/catch and use error messages
  4. Message Types: Support text, photos, documents via msg object
  5. User State: Implement state management if needed (outside this template)
  6. Database: Access via userModel (if needed) for user-specific data
  7. Localization: Use this.lang for all user-facing messages
  8. Permissions: Use msg.from.id for user-specific checks
  9. Buttons: Use MarkdownV2 formatting where applicable
  10. Cooldowns: Respect the cooldown property for rate limiting
  
  Example Command Flow:
  1. User sends /commandName argument
  2. onStart handles initial response with inline keyboard
  3. User clicks button, triggering onCallback
  4. Bot edits original message based on callback action
  */