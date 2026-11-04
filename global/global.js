import { initPembuka } from "../halaman-pembuka/pembuka.js";
import { initKuis1 } from "../kuis1/kuis1.js";

const $ = id => document.getElementById(id);

function initScreenController() {
    const screens = ["home", "quiz", "result"];

    document.addEventListener("app:show-screen", event => {
        const active = event.detail.name;
        screens.forEach(name => {
            const screen = $(name);
            if (screen) screen.hidden = name !== active;
        });
    });
}

function initZoom() {
    let zoomLevel = 1;
    const frame = $("frame");
    const stage = $("stage");

    function updateZoom() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        stage.style.width = width + "px";
        stage.style.height = height + "px";
        stage.style.transform = "scale(" + zoomLevel + ")";
        frame.style.width = width * zoomLevel + "px";
        frame.style.height = height * zoomLevel + "px";

        $("zoomValue").textContent = Math.round(zoomLevel * 100) + "%";
        $("zoomOut").disabled = zoomLevel <= 0.6;
        $("zoomIn").disabled = zoomLevel >= 1.6;
    }

    $("zoomOut").addEventListener("click", () => {
        zoomLevel = Math.max(0.6, Math.round((zoomLevel - 0.1) * 10) / 10);
        updateZoom();
    });

    $("zoomIn").addEventListener("click", () => {
        zoomLevel = Math.min(1.6, Math.round((zoomLevel + 0.1) * 10) / 10);
        updateZoom();
    });

    $("zoomReset").addEventListener("click", () => {
        zoomLevel = 1;
        updateZoom();
    });

    window.addEventListener("resize", updateZoom);
    updateZoom();
}

function initCacheReset() {
    $("cacheReset").addEventListener("click", async () => {
        if (!confirm("Hapus cache Alfiyah Quiz dan muat ulang aplikasi?")) return;

        $("cacheReset").disabled = true;

        try {
            if ("caches" in window) {
                const keys = await caches.keys();
                await Promise.all(
                    keys.filter(key => key.startsWith("alfiyah-quiz-")).map(key => caches.delete(key))
                );
            }

            if ("serviceWorker" in navigator) {
                const registration = await navigator.serviceWorker.getRegistration("./");
                if (registration) await registration.unregister();
            }

            location.reload();
        } catch (error) {
            $("cacheReset").disabled = false;
            alert("Cache gagal dihapus: " + error.message);
        }
    });
}

async function loadBlocks() {
    const [opening, quiz] = await Promise.all([
        fetch("./halaman-pembuka/pembuka.html").then(response => {
            if (!response.ok) throw new Error("Halaman pembuka gagal dimuat.");
            return response.text();
        }),
        fetch("./kuis1/kuis1.html").then(response => {
            if (!response.ok) throw new Error("Blok kuis1 gagal dimuat.");
            return response.text();
        })
    ]);

    $("screens").innerHTML = opening + quiz;
    initScreenController();
    initPembuka();
    initKuis1();
}

async function startApp() {
    initZoom();
    initCacheReset();

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./service-worker.js")
            .catch(error => console.error("Service Worker gagal didaftarkan:", error));
    }

    try {
        await loadBlocks();
    } catch (error) {
        $("bootStatus").textContent = error.message;
        console.error(error);
    }
}

startApp();