import app from '../index.js';

// Catch-all serverless entry so /api/* routes hit the Express app
export default (req, res) => app(req, res);

export const config = {
  api: {
    bodyParser: false,
  },
};
