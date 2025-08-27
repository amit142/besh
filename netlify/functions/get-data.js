exports.handler = async function(event, context) {
  const owner = 'amit142';
  const repo = 'besh';
  const path = 'data.json';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
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
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');

    return {
      statusCode: 200,
      body: content,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};