const ITUNES_API = 'https://itunes.apple.com';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    const params = event.queryStringParameters || {};
    const artistIds = params.artistIds ? params.artistIds.split(',') : [];
    const limit = parseInt(params.limit) || 200;

    if (artistIds.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No artist IDs provided' }) };
    }

    const allResults = {};
    for (const artistId of artistIds) {
      const id = artistId.trim();
      const url = `${ITUNES_API}/lookup?id=${encodeURIComponent(id)}&entity=album&limit=${limit}`;
      try {
        const response = await fetch(url);
        allResults[id] = response.ok ? await response.json() : { resultCount: 0, results: [] };
      } catch {
        allResults[id] = { resultCount: 0, results: [] };
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ source: 'apple', artistResults: allResults }) };

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
