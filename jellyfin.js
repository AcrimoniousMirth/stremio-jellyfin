import axios from "axios"
import os from "os"

export const server = process.env.JELLYFIN_SERVER
const apiKey = process.env.JELLYFIN_API_KEY
const user = process.env.JELLYFIN_USER
const password = process.env.JELLYFIN_PASSWORD
const device = os.hostname()
const itemsLimit = 20

// Maps Jellyfin collection types to Stremio content types
const COLLECTION_TYPE_MAP = {
    'movies': 'movie',
    'tvshows': 'series',
}

export class JellyfinApi {

    async authenticate() {
        if (apiKey) {
            await this.authenticateWithApiKey()
        } else if (user && password) {
            await this.authenticateWithCredentials()
        } else {
            console.error("No authentication method configured. Set JELLYFIN_API_KEY or both JELLYFIN_USER and JELLYFIN_PASSWORD.")
            process.exit(1)
        }
    }

    async authenticateWithApiKey() {
        console.log(`Connecting to Jellyfin server: ${server} with API key`)
        this.accessToken = apiKey
        this.authorisationHeader = `MediaBrowser Token="${this.accessToken}"`

        // Verify the API key works and resolve userId
        try {
            // First verify the connection
            const systemInfo = await axios.get(`${server}/System/Info`, {
                headers: this.getHeaders()
            }).then(it => it.data)
            console.log(`Connected to Jellyfin server: ${systemInfo.ServerName} (v${systemInfo.Version})`)

            // Resolve a userId for library queries
            // API keys are not tied to a user, so we pick the first admin or first available user
            const users = await axios.get(`${server}/Users`, {
                headers: this.getHeaders()
            }).then(it => it.data)

            if (!users || users.length === 0) {
                console.error("No users found on Jellyfin server. At least one user is required.")
                process.exit(1)
            }

            // Prefer admin user, otherwise first available
            const adminUser = users.find(u => u.Policy?.IsAdministrator)
            const selectedUser = adminUser || users[0]
            this.userId = selectedUser.Id
            console.log(`Using Jellyfin user: ${selectedUser.Name} (for library access)`)
            console.log(`Successfully connected to Jellyfin server: ${server}. Happy streaming.`)
        } catch (err) {
            if (err?.response) {
                console.error(`Error connecting with API key, server response: '${err?.response?.status}' and data: '${JSON.stringify(err?.response?.data) || "<empty>"}'`)
            } else {
                console.error(`Error connecting to Jellyfin (server: '${server}'). Error message: '${err?.message}'`)
            }
            console.info("Exiting. Please check your API key and Jellyfin connection.")
            process.exit(1)
        }
    }

    async authenticateWithCredentials() {
        console.log(`Connecting to Jellyfin server: ${server} with username: ${user}`)
        const authHeader = `MediaBrowser Client="Jellyfin Stremio Addon", Device="${device}", DeviceId="${device}", Version="2.0.0"`

        try {
            const auth = await axios.post(`${server}/Users/authenticatebyname`,
                {Username: user, Pw: password}, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader
                    }
                }).then(it => it.data)

            this.accessToken = auth.AccessToken
            this.userId = auth.User.Id
            this.authorisationHeader = `MediaBrowser Client="Jellyfin Stremio Addon", Device="${device}", DeviceId="${device}", Version="2.0.0", Token="${this.accessToken}"`
            console.log(`Successfully connected to Jellyfin server: ${server}. Happy streaming.`)
        } catch (err) {
            if (err?.response) {
                console.error(`Error during Jellyfin authentication, server response: '${err?.response?.status}' and data: '${JSON.stringify(err?.response?.data) || "<empty>"}' (server: '${server}' with username: '${user}')`)
            } else {
                console.error(`Error connecting to Jellyfin (server: '${server}' with username: '${user}'). Error message: '${err?.message}'`)
            }
            console.info("Exiting. Please check your configuration and Jellyfin connection.")
            process.exit(1)
        }
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': this.authorisationHeader
        }
    }

    /**
     * Fetch all libraries from Jellyfin and return them mapped to Stremio catalog info.
     * Applies whitelist (JELLYFIN_LIBRARIES) or blacklist (JELLYFIN_EXCLUDE_LIBRARIES) filtering.
     */
    async getLibraries() {
        try {
            const response = await axios.get(`${server}/Library/VirtualFolders`, {
                headers: this.getHeaders()
            })

            const allLibraries = response.data || []

            // Map to a simpler structure, filtering to video-compatible types
            let libraries = allLibraries
                .filter(lib => COLLECTION_TYPE_MAP[lib.CollectionType])
                .map(lib => ({
                    name: lib.Name,
                    id: lib.ItemId,
                    collectionType: lib.CollectionType,
                    stremioType: COLLECTION_TYPE_MAP[lib.CollectionType],
                    catalogId: `jellyfin-${lib.Name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                }))

            // Apply whitelist or blacklist
            const includeList = process.env.JELLYFIN_LIBRARIES
            const excludeList = process.env.JELLYFIN_EXCLUDE_LIBRARIES

            if (includeList) {
                const include = includeList.split(',').map(s => s.trim().toLowerCase())
                libraries = libraries.filter(lib => include.includes(lib.name.toLowerCase()))
            } else if (excludeList) {
                const exclude = excludeList.split(',').map(s => s.trim().toLowerCase())
                libraries = libraries.filter(lib => !exclude.includes(lib.name.toLowerCase()))
            }

            if (libraries.length === 0) {
                console.warn("No libraries matched the filter. Check JELLYFIN_LIBRARIES / JELLYFIN_EXCLUDE_LIBRARIES settings.")
                console.warn(`Available libraries: ${allLibraries.map(l => `${l.Name} (${l.CollectionType})`).join(', ')}`)
            }

            return libraries
        } catch (err) {
            console.error(`Error fetching libraries: ${err?.message}`)
            return []
        }
    }

    async getItemById(itemId) {
        return axios.get(`${server}/Users/${this.userId}/Items/${itemId}`, {
            headers: this.getHeaders()
        })
    }

    async searchItems(skip, movie, searchTerm = null, parentId = null) {
        let startIndex = Number(skip) || 0
        let itemsSearch = `${server}/Items?userId=${this.userId}&hasImdb=true&Recursive=true&startIndex=${startIndex}&limit=${itemsLimit}&sortBy=SortName&fields=ProviderIds`

        if (parentId) {
            itemsSearch += `&parentId=${parentId}`
        }

        if (searchTerm) {
            itemsSearch += `&searchTerm=${encodeURIComponent(searchTerm)}`
        }

        if (movie) {
            itemsSearch += `&IncludeItemTypes=Movie`
        } else {
            itemsSearch += `&IncludeItemTypes=Series`
        }

        return axios.get(itemsSearch, {
            headers: this.getHeaders()
        })
            .then(it => it.data.Items.map(it => this.getItemById(it.Id)))
    }

    /**
     * Find items by IMDB ID using the native Jellyfin /Items endpoint.
     * Fetches items with ProviderIds and filters client-side for the matching IMDB ID.
     * This replaces the old /ProvidersIdSearch endpoint that required a custom plugin.
     */
    async getItemByImdbId(imdbId) {
        try {
            // Search both movies and series, include ProviderIds in the response
            const response = await axios.get(
                `${server}/Items?userId=${this.userId}&Recursive=true&IncludeItemTypes=Movie,Series&fields=ProviderIds,MediaSources,MediaStreams&hasImdb=true`,
                { headers: this.getHeaders() }
            )

            const items = response.data.Items || []
            // Filter client-side for the exact IMDB ID match
            const matched = items.filter(item =>
                item.ProviderIds?.Imdb === imdbId || item.ProviderIds?.IMDB === imdbId
            )

            return matched
        } catch (err) {
            console.error(`Error searching for IMDB ID ${imdbId}: ${err?.message}`)
            return []
        }
    }

    async getSeasonByParentItemIdAndSeasonNumber(itemId, seasonNumber) {
        return axios.get(`${server}/Shows/${itemId}/Seasons?userId=${this.userId}`, {
            headers: this.getHeaders()
        }).then(item => item.data)
    }

    async getEpisodeByItemIdAndSeasonId(itemId, seasonId) {
        return axios.get(`${server}/Shows/${itemId}/Episodes?seasonId=${seasonId}&userId=${this.userId}`, {
            headers: this.getHeaders()
        }).then(item => item.data)
    }
}
