const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API = 'https://api.spotify.com/v1';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

let tokenCache = { token: null, expiresAt: 0 };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Spotify credentials not configured' })
    };
  }

  try {
    const accessToken = await getSpotifyToken(CLIENT_ID, CLIENT_SECRET);
    const params = event.queryStringParameters || {};
    const artistIds = params.artistIds ? params.artistIds.split(',') : [];
    const limit = parseInt(params.limit, 10) || 50;
    const includeGroups = params.includeGroups || 'album,single';

    if (artistIds.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No artist IDs provided' }) };
    }

    const allReleases = [];
    for (const artistId of artistIds) {
      const releases = await fetchArtistReleases(accessToken, artistId.trim(), limit, includeGroups);
      allReleases.push(...releases);
    }

    allReleases.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

    const seen = new Set();
    const unique = allReleases.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return { statusCode: 200, headers, body: JSON.stringify({ releases: unique }) };

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

async function getSpotifyToken(clientId, clientSecret) {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) throw new Error(`Spotify token failed: ${response.status}`);
  const data = await response.json();

  tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

async function fetchArtistReleases(accessToken, artistId, limit, includeGroups) {
  const url = `${SPOTIFY_API}/artists/${artistId}/albums?include_groups=${includeGroups}&limit=${limit}`;
  const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
  if (!response.ok) return [];

  const data = await response.json();
  return (data.items || []).map(album => {
    const artists = album.artists?.map(a => a.name) || [];
    let type = 'album';
    if (album.album_type === 'single') type = album.total_tracks === 1 ? 'single' : 'ep';
    else if (album.album_type === 'compilation') type = 'compilation';

    return {
      id: album.id,
      title: album.name,
      artist: artists[0] || 'inutech',
      artists,
      featuredArtists: artists.slice(1),
      type,
      releaseDate: album.release_date,
      year: parseInt(album.release_date?.split('-')[0]) || null,
      coverUrl: album.images?.[0]?.url || null,
      spotifyUrl: album.external_urls?.spotify || `https://open.spotify.com/album/${album.id}`
    };
  });
}
