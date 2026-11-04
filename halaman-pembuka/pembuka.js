"use strict";

export function initPembuka() {
    document.querySelectorAll("[data-section]").forEach(button => {
        button.addEventListener("click", () => {
            document.dispatchEvent(new CustomEvent("kuis1:start", {
                detail: { sectionKey: button.dataset.section }
            }));
        });
    });

    document.addEventListener("kuis1:data-ready", event => {
        const { counts, totalBait } = event.detail;

        Object.entries(counts).forEach(([key, count]) => {
            const button = document.querySelector('[data-section="' + key + '"]');
            if (!button) return;

            button.disabled = count < 4;
            button.querySelector(".section-count").textContent = count + " soal tersedia";
        });

        const status = document.getElementById("status");
        if (status) status.textContent = totalBait.toLocaleString("id-ID") + " bait siap digunakan.";
    });

    document.addEventListener("kuis1:data-error", event => {
        const status = document.getElementById("status");
        if (status) status.textContent = "Data gagal dimuat: " + event.detail.message;
    });
}