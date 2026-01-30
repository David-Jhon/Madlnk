// Message formatting utilities - Reusable across commands

const PARSE_MODES = {
    MARKDOWN: 'Markdown',
    HTML: 'HTML',
    NONE: null
};

/**
 * Get display name for parse mode
 */
function getParseModeName(mode) {
    if (mode === 'Markdown') return 'Markdown';
    if (mode === 'HTML') return 'HTML';
    return 'Plain';
}

/**
 * Get parse mode symbol for button display
 */
function getParseModeSymbol(mode, currentMode) {
    return mode === currentMode ? '●' : '○';
}

/**
 * Validate Markdown formatting
 */
function validateMarkdown(text) {
    try {
        // Basic validation - check for unclosed formatting
        const asterisks = (text.match(/\*/g) || []).length;
        const underscores = (text.match(/_/g) || []).length;
        const backticks = (text.match(/`/g) || []).length;

        return {
            valid: asterisks % 2 === 0 && underscores % 2 === 0 && backticks % 2 === 0,
            message: 'Markdown formatting appears valid'
        };
    } catch (error) {
        return { valid: false, message: error.message };
    }
}

/**
 * Validate HTML formatting
 */
function validateHTML(text) {
    try {
        // Check for basic HTML tag matching
        const openTags = text.match(/<([a-z]+)>/gi) || [];
        const closeTags = text.match(/<\/([a-z]+)>/gi) || [];

        return {
            valid: openTags.length === closeTags.length,
            message: 'HTML formatting appears valid'
        };
    } catch (error) {
        return { valid: false, message: error.message };
    }
}

/**
 * Build parse mode selector buttons
 */
function buildParseModeButtons(currentMode) {
    return [
        {
            text: `${getParseModeSymbol('Markdown', currentMode)} Markdown`,
            callback_data: 'parsemode:markdown'
        },
        {
            text: `${getParseModeSymbol('HTML', currentMode)} HTML`,
            callback_data: 'parsemode:html'
        },
        {
            text: `${getParseModeSymbol(null, currentMode)} Plain`,
            callback_data: 'parsemode:plain'
        }
    ];
}

module.exports = {
    PARSE_MODES,
    getParseModeName,
    getParseModeSymbol,
    validateMarkdown,
    validateHTML,
    buildParseModeButtons
};
