const { Octokit } = require("@octokit/rest");

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const owner = 'amit142';
  const repo = 'besh';
  const path = 'data.json';
  const content = event.body;

  try {
    // Get the current file to get its SHA
    let sha;
    try {
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });
      sha = response.data.sha;
    } catch (error) {
      // If the file doesn't exist, we don't need a SHA
      if (error.status !== 404) {
        throw error;
      }
    }

    const message = `Update data.json - ${new Date().toISOString()}`;
    const contentEncoded = Buffer.from(content).toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: contentEncoded,
      sha,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Data saved successfully' }),
    };
  } catch (error) {
    return {
      statusCode: error.status || 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};