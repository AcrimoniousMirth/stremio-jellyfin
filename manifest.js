/**
 * Builds the Stremio addon manifest dynamically from the discovered Jellyfin libraries.
 * Each library becomes its own catalog entry in Stremio.
 */
export function buildManifest(catalogs) {
    const types = [...new Set(catalogs.map(c => c.type))]

    return {
        "id": "community.stremiojellyfin",
        "version": "2.1.0",
        "catalogs": catalogs,
        "resources": [
            "catalog",
            "stream",
            "meta"
        ],
        "types": types,
        "name": "Jellyfin",
        "description": "Stremio Jellyfin integration — browse and stream your Jellyfin libraries"
    }
}
