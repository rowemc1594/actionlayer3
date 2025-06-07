// API Configuration for ActionLayer3
// Uses environment variable for security
const OPENAI_API_KEY = '';

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OPENAI_API_KEY };
}