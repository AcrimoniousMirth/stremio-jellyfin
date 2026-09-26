# Stremio Jellyfin Addon

[Stremio](https://www.stremio.com/) addon that enables streaming movies and TV series from your own Jellyfin server. Addon runs entirely locally, ensuring that none of your data is shared outside of your own network. Each Jellyfin library appears as its own catalog in Stremio, and you can choose which libraries to expose.

![](assets/si.png)

## Features

- **API Key Authentication** — No usernames or passwords needed. Generate an API key in Jellyfin and go.
- **Per-Library Catalogs** — Each Jellyfin library (Movies, Anime, TV Shows, etc.) appears as a separate, browsable catalog in Stremio.
- **Library Filtering** — Whitelist or blacklist which libraries to expose. Hide libraries you don't want in Stremio.
- **No Plugin Required** — Works with the native Jellyfin API. No companion plugins needed.
- **Username/Password Fallback** — Still works with credentials if you prefer.

## Jellyfin Setup

1. Go to **Jellyfin → Dashboard → Advanced → API Keys**
2. Click **+** to generate a new API key
3. Name it something like `Stremio Addon`
4. Copy the generated key

No plugins are required.

## Installation

### Docker Compose / Dockge (Recommended)

Create a `docker-compose.yml` (or paste into Dockge):

```yaml
version: "3"
services:
  stremio-jellyfin:
    image: ghcr.io/acrimoniousmirth/stremio-jellyfin:latest
    container_name: stremio-jellyfin
    restart: unless-stopped
    ports:
      - "60421:60421"
    environment:
      - JELLYFIN_API_KEY=your-api-key-here
      - JELLYFIN_SERVER=http://your-jellyfin-host:8096
      # Optional: only expose specific libraries (comma-separated)
      # - JELLYFIN_LIBRARIES=Movies,Anime,TV Shows
      # Optional: expose all libraries EXCEPT these (comma-separated)
      # - JELLYFIN_EXCLUDE_LIBRARIES=Online Movies
```

Then start it:

```bash
docker compose up -d
```

### Docker Run

```bash
docker pull ghcr.io/acrimoniousmirth/stremio-jellyfin:latest

docker run -d \
  --name stremio-jellyfin \
  --restart unless-stopped \
  -p 60421:60421 \
  -e JELLYFIN_API_KEY="your-api-key-here" \
  -e JELLYFIN_SERVER="http://your-jellyfin-host:8096" \
  -e JELLYFIN_EXCLUDE_LIBRARIES="Online Movies" \
  ghcr.io/acrimoniousmirth/stremio-jellyfin
```

### Running Locally

```bash
npm install
JELLYFIN_API_KEY="your-key" JELLYFIN_SERVER="http://localhost:8096" npm start
```

## Adding to Stremio

Once the addon is running, add the manifest URL in Stremio:

```
http://<your-host>:60421/manifest.json
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JELLYFIN_SERVER` | Yes | Jellyfin server URL (e.g. `http://192.168.1.100:8096`) |
| `JELLYFIN_API_KEY` | No* | API key from Jellyfin Dashboard → Advanced → API Keys |
| `JELLYFIN_USER` | No* | Jellyfin username (fallback auth) |
| `JELLYFIN_PASSWORD` | No* | Jellyfin password (fallback auth) |
| `JELLYFIN_LIBRARIES` | No | Whitelist — only expose these libraries (comma-separated) |
| `JELLYFIN_EXCLUDE_LIBRARIES` | No | Blacklist — expose all except these (comma-separated, ignored if whitelist is set) |
| `SERVER_PORT` | No | Addon port (default: `60421`) |

\* Either `JELLYFIN_API_KEY` or both `JELLYFIN_USER` + `JELLYFIN_PASSWORD` must be provided.

### Library Filtering

By default, all video libraries (movies and TV shows) are exposed as separate Stremio catalogs. You can control which libraries appear using environment variables.

**Example Jellyfin libraries:**

| Jellyfin Library | Type | Stremio Catalog |
|---|---|---|
| Movies | movies | Jellyfin - Movies |
| Anime | tvshows | Jellyfin - Anime |
| TV Shows | tvshows | Jellyfin - TV Shows |
| Online Movies | movies | *(excluded by blacklist)* |

**Whitelist** — only expose specific libraries:
```
JELLYFIN_LIBRARIES=Movies,Anime,TV Shows
```

**Blacklist** — expose everything except specific libraries:
```
JELLYFIN_EXCLUDE_LIBRARIES=Online Movies
```

Library names are **case-insensitive** and matched against your Jellyfin library names exactly. If both `JELLYFIN_LIBRARIES` and `JELLYFIN_EXCLUDE_LIBRARIES` are set, the whitelist takes priority.

Non-video libraries (music, books, etc.) are always excluded automatically.
