const dotenv = require('dotenv');

module.exports = async () => {
  // Load .env.test environment variables
  const result = dotenv.config({ path: '.env.test' });
  if (result.error) {
    throw result.error;
  }
};
