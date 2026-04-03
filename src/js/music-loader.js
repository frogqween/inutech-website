const SPOTIFY_ID = '0cY13KDbHCE1yDrxCxa5KX';
const APPLE_ID = '1718278352';

function normalize(str) {
  return str?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
}

function isInutech(name) {
  return normalize(name) === 'inutech';
}

function buildReleaseEl(r) {
  const item = document.createElement('div');
  item.className = 'release';

  const img = document.createElement('img');
  img.className = 'release-cover';
  img.src = r.cover || '';
  img.alt = r.title;
  img.loading = 'lazy';
  item.appendChild(img);

  const info = document.createElement('div');
  info.className = 'release-info';

  const title = document.createElement('div');
  title.className = 'release-title';
  title.textContent = r.title;
  info.appendChild(title);

  const subParts = [];
  if (r.artist) subParts.push(r.artist);
  if (r.type) subParts.push(r.type);
  if (r.year) subParts.push(r.year);
  if (subParts.length) {
    const sub = document.createElement('div');
    sub.className = 'release-sub';
    sub.textContent = subParts.join(' · ');
    info.appendChild(sub);
  }

  const buttons = document.createElement('div');
  buttons.className = 'release-buttons';
  if (r.spotifyUrl) {
    const a = document.createElement('a');
    a.href = r.spotifyUrl; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Spotify';
    buttons.appendChild(a);
  }
  if (r.appleUrl) {
    const a = document.createElement('a');
    a.href = r.appleUrl; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Apple';
    buttons.appendChild(a);
  }
  if (buttons.children.length) info.appendChild(buttons);

  item.appendChild(info);
  return item;
}

function buildSection(label, releases) {
  if (!releases.length) return null;
  const section = document.createElement('div');
  section.className = 'music-section';
  const heading = document.createElement('p');
  heading.className = 'section-label';
  heading.textContent = label;
  section.appendChild(heading);
  const grid = document.createElement('div');
  grid.className = 'music-grid';
  releases.forEach(r => grid.appendChild(buildReleaseEl(r)));
  section.appendChild(grid);
  return section;
}

async function loadReleases() {
  const [primaryRes, featuresRes, appleRes] = await Promise.allSettled([
    fetch(`/.netlify/functions/spotify-releases?artistIds=${SPOTIFY_ID}&includeGroups=album,single&limit=50`),
    fetch(`/.netlify/functions/spotify-releases?artistIds=${SPOTIFY_ID}&includeGroups=appears_on&limit=50`),
    fetch(`/.netlify/functions/apple-releases?artistIds=${APPLE_ID}&limit=200`)
  ]);

  const appleMap = new Map();
  if (appleRes.status === 'fulfilled' && appleRes.value.ok) {
    const data = await appleRes.value.json();
    (data.artistResults?.[APPLE_ID]?.results || [])
      .filter(r => r.wrapperType === 'collection')
      .forEach(r => {
        const cover = r.artworkUrl100?.replace(/\/\d+x\d+bb\.(jpg|png)/, '/1000x1000bb.$1');
        appleMap.set(normalize(r.collectionName), {
          title: r.collectionName,
          artist: r.artistName || '',
          year: parseInt(r.releaseDate?.slice(0, 4), 10) || null,
          cover,
          appleUrl: r.collectionViewUrl || null
        });
      });
  }

  const allSpotify = [];
  if (primaryRes.status === 'fulfilled' && primaryRes.value.ok)
    allSpotify.push(...((await primaryRes.value.json()).releases || []));
  if (featuresRes.status === 'fulfilled' && featuresRes.value.ok)
    allSpotify.push(...((await featuresRes.value.json()).releases || []));

  const seen = new Set();
  const matchedKeys = new Set();
  const merged = [];

  allSpotify.forEach(s => {
    if (seen.has(s.id)) return;
    seen.add(s.id);
    const key = normalize(s.title);
    matchedKeys.add(key);
    const apple = appleMap.get(key);
    merged.push({
      title: s.title,
      type: s.type,
      year: s.year || apple?.year || null,
      artist: s.artist || apple?.artist || 'inutech',
      cover: s.coverUrl || apple?.cover || null,
      spotifyUrl: s.spotifyUrl,
      appleUrl: apple?.appleUrl || null
    });
  });

  appleMap.forEach((a, key) => {
    if (!matchedKeys.has(key)) {
      merged.push({ title: a.title, type: null, year: a.year, artist: a.artist || 'inutech', cover: a.cover, spotifyUrl: null, appleUrl: a.appleUrl });
    }
  });

  const releases = merged.filter(r => isInutech(r.artist));
  const features = merged.filter(r => !isInutech(r.artist));

  releases.sort((a, b) => (b.year || 0) - (a.year || 0));
  features.sort((a, b) => (b.year || 0) - (a.year || 0));

  return { releases, features };
}

function render({ releases, features }) {
  const container = document.getElementById('music-container');
  container.innerHTML = '';
  const r = buildSection('releases', releases);
  const f = buildSection('features', features);
  if (!r && !f) { container.innerHTML = '<p class="music-error">no releases found</p>'; return; }
  if (r) container.appendChild(r);
  if (f) container.appendChild(f);
}

loadReleases().then(render).catch(() => {
  document.getElementById('music-container').innerHTML = '<p class="music-error">could not load releases</p>';
});
