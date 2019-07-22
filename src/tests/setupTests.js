const dotenv = require('dotenv');

module.exports = async () => {
  // Load .env.test environment variables
  dotenv.config({ path: '.env.test' });
};
