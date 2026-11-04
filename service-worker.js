const CACHE_NAME = "alfiyah-quiz-v16";
const APP_BASE = new URL("./", self.location.href);
const APP_INDEX = new URL("index.html", APP_BASE).href;
const APP_STYLE = new URL("style.css", APP_BASE).href;
const APP_SCRIPT = new URL("app.js", APP_BASE).href;
const DATA_FILE = new URL("ALFIYYAH.json", APP_BASE).href;
const SCOPE_PATH = APP_BASE.pathname;

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll([APP_INDEX, APP_STYLE, APP_SCRIPT, DATA_FILE]);
        await precacheGoogleFonts(cache);
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();

        await Promise.all(
            keys
                .filter(key => key.startsWith("alfiyah-quiz-") && key !== CACHE_NAME)
                .map(key => caches.delete(key))
        );

        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const request = event.request;

    if (request.method !== "GET") return;

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) {
        if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
            event.respondWith(networkFirst(request));
        }
        return;
    }

    if (!url.pathname.startsWith(SCOPE_PATH)) return;

    if (url.pathname === new URL(DATA_FILE).pathname) {
        event.respondWith(networkFirst(request, DATA_FILE));
        return;
    }

    if (url.pathname === new URL(APP_STYLE).pathname || url.pathname === new URL(APP_SCRIPT).pathname) {
        event.respondWith(networkFirst(request));
        return;
    }
    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request, APP_INDEX));
        return;
    }

    event.respondWith(cacheFirst(request));
});

async function networkFirst(request, cacheKey = request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetch(request, { cache: "no-cache" });

        if (response && (response.ok || response.type === "opaque")) {
            try {
                await cache.put(cacheKey, response.clone());
            } catch (error) {
                console.warn("Cache tidak dapat diperbarui:", error);
            }
        }

        return response;
    } catch (error) {
        const cached = await cache.match(cacheKey);
        return cached || Response.error();
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);

    if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
    }

    return response;
}

async function precacheGoogleFonts(cache) {
    const cssUrl = "https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap";

    try {
        const response = await fetch(cssUrl);
        if (!response.ok) return;

        await cache.put(cssUrl, response.clone());

        const css = await response.text();
        const fontUrls = css.split("url(")
            .slice(1)
            .map(part => part.split(")")[0])
            .filter(url => url.startsWith("https://fonts.gstatic.com/"));

        await Promise.all(fontUrls.map(async url => {
            try {
                const font = await fetch(url);
                if (font.ok) await cache.put(url, font.clone());
            } catch (error) {
                console.warn("Font tidak dapat disimpan:", error);
            }
        }));
    } catch (error) {
        console.warn("Font Noto Naskh tidak dapat disimpan untuk offline:", error);
    }
}
