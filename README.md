# Stremio Jellyfin Addon

[Stremio](https://www.stremio.com/) addon that enables streaming movies and TV series from your own Jellyfin server. Addon runs entirely locally, ensuring that none of your data is shared outside of your own network. It provides Stremio with a 'library' featuring your Jellyfin movies and TV series collection, allowing you to stream seamlessly both movies and series to your favorite Stremio player.

![](assets/si.png)

## What's New in v2.0

- **API Key Authentication** — No more passing usernames and passwords. Generate an API key in Jellyfin Dashboard and you're set.
- **No Plugin Required** — Removed the dependency on the `jellyfin-providersid-search-plugin`. Everything works with the native Jellyfin API.
- **Modern Jellyfin Compatibility** — Updated from the removed `X-Emby-Authorization` header to the standard `Authorization: MediaBrowser` header (required for Jellyfin 12.0+).
- **Username/Password Fallback** — Still works with credentials if you prefer that auth method.

## Installation

### Jellyfin Setup

1. Go to **Jellyfin > Dashboard > Advanced > API Keys**
2. Click **+** to generate a new API key
3. Name it something like `Stremio Addon`
4. Copy the generated key

No plugins are required.

### Docker (Recommended)

Pull the latest image:

```
docker pull ghcr.io/acrimoniousmirth/stremio-jellyfin:latest
```

#### Using API Key (Recommended)

```bash
docker run -p 60421:60421 \
  -e JELLYFIN_API_KEY="<your api key>" \
  -e JELLYFIN_SERVER="http://<your jellyfin host>:8096" \
  ghcr.io/acrimoniousmirth/stremio-jellyfin
```

#### Using Username/Password (Fallback)

```bash
docker run -p 60421:60421 \
  -e JELLYFIN_USER="<your jellyfin username>" \
  -e JELLYFIN_PASSWORD="<your jellyfin user password>" \
  -e JELLYFIN_SERVER="http://<your jellyfin host>:8096" \
  ghcr.io/acrimoniousmirth/stremio-jellyfin
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JELLYFIN_SERVER` | Yes | Jellyfin server URL (e.g. `http://192.168.1.100:8096`) |
| `JELLYFIN_API_KEY` | No* | API key from Jellyfin Dashboard > Advanced > API Keys |
| `JELLYFIN_USER` | No* | Jellyfin username (fallback auth) |
| `JELLYFIN_PASSWORD` | No* | Jellyfin password (fallback auth) |
| `SERVER_PORT` | No | Addon port (default: `60421`) |

\* Either `JELLYFIN_API_KEY` or both `JELLYFIN_USER` + `JELLYFIN_PASSWORD` must be provided.

### Running Locally

```bash
npm install
JELLYFIN_API_KEY="your-key" JELLYFIN_SERVER="http://localhost:8096" npm start
```

### Adding to Stremio

Once the addon is running, add the manifest URL to Stremio:

```
http://<your docker host>:60421/manifest.json
```
