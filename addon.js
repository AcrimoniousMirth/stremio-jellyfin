// noinspection JSPotentiallyInvalidConstructorUsage

import {addonBuilder} from "stremio-addon-sdk"
import {JellyfinApi, server} from "./jellyfin.js";
import {buildManifest} from "./manifest.js";

// --- Startup: authenticate, discover libraries, build manifest ---

const jellyfin = new JellyfinApi()
await jellyfin.authenticate()

const libraries = await jellyfin.getLibraries()

if (libraries.length === 0) {
    console.error("No Jellyfin libraries to expose. Exiting.")
    process.exit(1)
}

console.log(`Exposing ${libraries.length} libraries as Stremio catalogs:`)
libraries.forEach(lib => console.log(`  • ${lib.name} (${lib.collectionType}) → Stremio type: ${lib.stremioType}, catalog ID: ${lib.catalogId}`))

// Build catalog-to-library mapping for handler routing
const libraryMap = new Map()
const catalogs = libraries.map(lib => {
    libraryMap.set(lib.catalogId, lib)
    return {
        type: lib.stremioType,
        id: lib.catalogId,
        name: `Jellyfin - ${lib.name}`,
        extra: [
            { name: "skip", isRequired: false },
            { name: "search", isRequired: false }
        ]
    }
})

const manifest = buildManifest(catalogs)

// --- Addon builder & handlers ---

let builder = new addonBuilder(manifest)

function stringToUuid(plainStringUuid) {
    return plainStringUuid.replace(
        /(.{8})(.{4})(.{4})(.{4})(.{12})/g,
        "$1-$2-$3-$4-$5"
    )
}

function itemToMeta(item) {
    const imdbId = item.ProviderIds?.Imdb || item.ProviderIds?.IMDB
    return {
        id: imdbId,
        type: item.Type.toLowerCase(),
        name: item.Name,
        poster: `${server}/Items/${item.Id}/Images/Primary?api_key=${jellyfin.accessToken}`
    }
}

builder.defineCatalogHandler(async ({type, id, extra}) => {
    console.log(`request for catalog: type=${type} id=${id}`)
    try {
        const library = libraryMap.get(id)
        const parentId = library?.id || null
        return {
            metas: await Promise.all(await jellyfin.searchItems(extra.skip || 0, type === 'movie', extra.search, parentId))
                .then(it => it.map(e => itemToMeta(e.data)))
        }
    } catch (err) {
        console.error(`Error in catalog handler (${id}): ${err?.message}`)
        return {metas: []}
    }
})

builder.defineMetaHandler(({type, id}) => {
    console.log("request for meta: " + type + " " + id)
    return Promise.resolve({meta: null})
})

builder.defineStreamHandler(async ({type, id}) => {
    console.log("request for streams: " + type + " " + id)
    try {
        let items = []
        if (id.includes(":")) {

            // resolve actual episode (format: imdbId:season:episode)
            const resolvedId = id.split(":")
            const seriesId = resolvedId[0]
            const season = Number(resolvedId[1])
            const episode = Number(resolvedId[2])

            const seriesItem = (await jellyfin.getItemByImdbId(seriesId))[0]
            if (seriesItem === undefined)
                return {streams: []}
            const seasonItem = (await jellyfin.getSeasonByParentItemIdAndSeasonNumber(seriesItem.Id, season)).Items.find(it => it.IndexNumber === season)
            if (seasonItem === undefined)
                return {streams: []}
            const episodeItem = (await jellyfin.getEpisodeByItemIdAndSeasonId(seriesItem.Id, seasonItem.Id)).Items.find(it => it.IndexNumber === episode)
            if (episodeItem === undefined)
                return {streams: []}
            const actualEpisodeItem = await jellyfin.getItemById(episodeItem.Id).then(it => it.data)

            items = [actualEpisodeItem]

        } else {
            items = await jellyfin.getItemByImdbId(id)
        }

        if (items === undefined || items.length === 0)
            return {streams: []}

        const item = items[0]
        const itemId = stringToUuid(item.Id)

        if (!(itemId === undefined)) {
            // Fetch full item details if MediaSources are not present
            let fullItem = item
            if (!fullItem.MediaSources) {
                fullItem = await jellyfin.getItemById(item.Id).then(it => it.data)
            }

            if (!fullItem.MediaSources || fullItem.MediaSources.length === 0) {
                console.log(`No media sources found for: ${id}`)
                return {streams: []}
            }

            const mediaSource = fullItem.MediaSources[0]
            const videoStream = mediaSource.MediaStreams?.find(s => s.Type === 'Video')
            const description = videoStream?.DisplayTitle || mediaSource.Name || 'Unknown'

            const stream = {
                url: `${server}/videos/${itemId}/stream.mkv?static=true&api_key=${jellyfin.accessToken}&mediaSourceId=${mediaSource.Id}`,
                name: 'Jellyfin',
                description: description
            }
            return {streams: [stream]}
        }

        console.log(`Can't find stream for: ${id}`)
        return {streams: []}
    } catch (err) {
        console.error(`Error in stream handler for ${id}: ${err?.message}`)
        return {streams: []}
    }
})

export const addonInterface = builder.getInterface()
