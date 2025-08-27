exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const owner = 'amit142';
  const repo = 'besh';
  const path = 'data.json';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const content = event.body;

  try {
    // Get the current file to get its SHA
    let sha;
    const getResponse = await fetch(url, {
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    if (getResponse.ok) {
      const data = await getResponse.json();
      sha = data.sha;
    }

    const message = `Update data.json - ${new Date().toISOString()}`;
    const contentEncoded = Buffer.from(content).toString('base64');

    const body = JSON.stringify({
      message,
      content: contentEncoded,
      sha,
    });

    const putResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      body,
    });

    if (!putResponse.ok) {
      throw new Error(`GitHub API responded with ${putResponse.status}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Data saved successfully' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};