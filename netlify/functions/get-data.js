const { Octokit } = require("@octokit/rest");

exports.handler = async function(event, context) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const owner = 'amit142';
  const repo = 'besh';
  const path = 'data.json';

  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    const content = Buffer.from(response.data.content, 'base64').toString('utf8');

    return {
      statusCode: 200,
      body: content,
    };
  } catch (error) {
    if (error.status === 404) {
      // If the file doesn't exist, return a default structure
      const defaultData = {
        version: 1,
        players: {},
        tournaments: [],
        settings: { points: { win: 1, mars: 2 } },
        activeTournamentId: null
      };
      return {
        statusCode: 200,
        body: JSON.stringify(defaultData)
      };
    }
    return {
      statusCode: error.status || 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};