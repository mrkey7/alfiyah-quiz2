"use strict";

const $ = id => document.getElementById(id);

const DATA_URL = "./ALFIYYAH.json";
const SHOW_CACHE_RESET = true;
const sections = {
    awal: { start:1, end:334 },
    tsani: { start:335, end:668 },
    tsalits: { start:669, end:1003 },
    semua: { start:1, end:1003 }
};
let baitData = [], activeBaitData = [], questions = [];
let questionIndex = 0, correctCount = 0, answeredCount = 0;
let answered = false, selectedSection = "semua";
let quizStartedAt = 0, timerInterval = null;
const status = $("status"), home = $("home"), quiz = $("quiz"), result = $("result");

const cacheReset = $("cacheReset");
cacheReset.hidden = !SHOW_CACHE_RESET;
cacheReset.addEventListener("click", async () => {
    if (!confirm("Hapus cache Alfiyah Quiz dan muat ulang aplikasi?")) return;

    cacheReset.disabled = true;
    try {
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(key => key.startsWith("alfiyah-quiz-")).map(key => caches.delete(key))
        );

        const registration = await navigator.serviceWorker?.getRegistration("./");
        if (registration) await registration.unregister();

        location.reload();
    } catch (error) {
        cacheReset.disabled = false;
        alert("Cache gagal dihapus: " + error.message);
    }
});
document.querySelectorAll("[data-section]").forEach(button => {
    button.addEventListener("click", () => startQuiz(button.dataset.section));
});

async function loadOnlineData() {
    status.textContent = "Memuat data Alfiyyah...";
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        prepareData(await response.json());
    } catch (error) {
        status.textContent = "Gagal memuat data: " + error.message;
    }
		status.textContent = "";
}

function rhymeKey(text) {
    const words = String(text ?? "")
        .normalize("NFC")
        .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
        .replace(/[،؛,.!?؟\\]+$/g, "")
        .trim()
        .split(/\s+/);

    const word = (words.pop() || "")
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ى/g, "ا")
        .replace(/ة/g, "ه");

    return [...word].filter(char => /[\u0621-\u064A]/.test(char)).slice(-2).join("");
}

function prepareData(data) {
    if (!data || !Array.isArray(data.rows)) throw new Error("Format JSON tidak sesuai.");
    const rows = data.rows.filter(row => String(row["أول"] ?? "").trim() && String(row["ثَان"] ?? "").trim());
    baitData = rows.filter(row => {
        const rhyme = rhymeKey(row["أول"]);
        return rhyme && rhyme === rhymeKey(row["ثَان"]);
    });
    Object.entries(sections).forEach(([key, section]) => {
        const selected = baitData.filter(row => {
            const n = Number(row["نمر"]);
            return n >= section.start && n <= section.end;
        });
        const count = getPlayableData(selected).length;
        const button = document.querySelector(`[data-section="${key}"]`);
        button.disabled = count < 4;
    });
}

function getPlayableData(rows) {
    const firstGroups = new Map(), secondGroups = new Map();
    rows.forEach(row => {
        const key = rhymeKey(row["أول"]);
        if (!firstGroups.has(key)) firstGroups.set(key, new Set());
        if (!secondGroups.has(key)) secondGroups.set(key, new Set());
        firstGroups.get(key).add(String(row["أول"]).trim());
        secondGroups.get(key).add(String(row["ثَان"]).trim());
    });
    return rows.filter(row => {
        const key = rhymeKey(row["أول"]);
        return firstGroups.get(key).size >= 4 || secondGroups.get(key).size >= 4;
    });
}

function shuffle(items) {
    const array = [...items];

    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

function startQuiz(sectionKey = "semua") {
    selectedSection = sectionKey;
    const section = sections[sectionKey];
    const rows = baitData.filter(row => {
        const n = Number(row["نمر"]);
        return n >= section.start && n <= section.end;
    });
    activeBaitData = getPlayableData(rows);
    questions = shuffle(activeBaitData);
    questionIndex = 0;
    correctCount = 0;
    answeredCount = 0;
    answered = false;
    clearInterval(timerInterval);
    quizStartedAt = Date.now();
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
    home.style.display = "none";
    quiz.style.display = "flex";
    result.style.display = "none";
    $("finishButton").disabled = false;
    renderQuestion();
}

function renderQuestion() {
    const item = questions[questionIndex];
    const first = String(item["أول"]).trim();
    const second = String(item["ثَان"]).trim();
    const firstRhyme = rhymeKey(second);
    const secondRhyme = rhymeKey(first);
    const firstAnswers = [...new Set(
        activeBaitData
            .filter(row => rhymeKey(row["أول"]) === firstRhyme)
            .map(row => String(row["أول"] ?? "").trim())
            .filter(Boolean)
    )];
    const secondAnswers = [...new Set(
        activeBaitData
            .filter(row => rhymeKey(row["ثَان"]) === secondRhyme)
            .map(row => String(row["ثَان"] ?? "").trim())
            .filter(Boolean)
    )];
    const canAskFirst = firstAnswers.length >= 4;
    const canAskSecond = secondAnswers.length >= 4;
    const askFirst = canAskFirst && (!canAskSecond || Math.random() < 0.5);
    const correctAnswer = askFirst ? first : second;
    const allAnswers = askFirst ? firstAnswers : secondAnswers;

    const distractors = shuffle(
        allAnswers.filter(answer => answer !== correctAnswer)
    ).slice(0, 3);

    if (distractors.length < 3) {
        throw new Error("Data tidak memiliki cukup pilihan jawaban berbeda.");
    }

    const choices = shuffle([correctAnswer, ...distractors]);

    answered = false;

    $("questionNumber").textContent = `${questionIndex + 1} dari ${questions.length}`;
    $("quizAvailable").textContent = questions.length - questionIndex;

    $("score").textContent = correctCount;
    $("progressBar").style.width =
        `${(questionIndex / questions.length) * 100}%`;

    $("rightHalf").textContent = askFirst ? "" : first;
    $("leftHalf").textContent = askFirst ? second : "";
    $("rightHalf").classList.toggle("is-empty", askFirst);
    $("leftHalf").classList.toggle("is-empty", !askFirst);
    $("baitNumber").textContent = String(item["ن"] ?? item["نمر"] ?? "");
    $("baitStage").dataset.number = String(item["ن"] ?? item["نمر"] ?? "");

    const options = $("options");
    options.replaceChildren();

    choices.forEach(answer => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "option";
        button.lang = "ar";
        button.textContent = answer;

        button.addEventListener("click", () =>
            chooseAnswer(button, answer, correctAnswer)
        );

        options.appendChild(button);
    });

    $("feedback").className = "feedback";
    $("feedback").textContent = "";
    $("nextButton").disabled = true;
    $("finishButton").disabled = false;
}

function chooseAnswer(selectedButton, answer, correctAnswer) {
    if (answered) return;
    answered = true;

    const buttons = [...$("options").children];

    buttons.forEach(button => {
        button.disabled = true;

        if (button.textContent === correctAnswer) {
            button.classList.add("correct");
        }
    });

    answeredCount++;
    if (answer === correctAnswer) {
        correctCount++;
        $("feedback").className = "feedback good";
        $("feedback").textContent = "Benar. Pasangan bait tepat.";
    } else {
        selectedButton.classList.add("wrong");
        $("feedback").className = "feedback bad";
        $("feedback").textContent =
            "Belum tepat. Jawaban benar ditandai warna hijau.";
    }

    $("score").textContent = correctCount;
    $("nextButton").textContent = "Soal Berikutnya";
    $("nextButton").disabled = false;

    $("progressBar").style.width =
        `${((questionIndex + 1) / questions.length) * 100}%`;
}

$("nextButton").addEventListener("click", () => {
    if (!answered) return;

    questionIndex++;

    if (questionIndex < questions.length) {
        renderQuestion();
    } else {
        showResult();
    }
});
$("finishButton").addEventListener("click", showResult);

function updateTimer() {
    const seconds = Math.floor((Date.now() - quizStartedAt) / 1000);
    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
    const remainder = String(seconds % 60).padStart(2, "0");
    $("timer").textContent = `${minutes}:${remainder}`;
}

function showResult() {
    clearInterval(timerInterval);
    timerInterval = null;
    quiz.style.display = "none";
    result.style.display = "block";
    const percent = answeredCount ? Math.round(correctCount / answeredCount * 100) : 0;
    $("finalScore").textContent = `${correctCount}/${answeredCount}`;
    $("finalDetail").textContent = answeredCount
        ? `${answeredCount} dari ${questions.length} soal dikerjakan · Akurasi ${percent}%.`
        : "Belum ada soal yang dijawab.";
}

$("retryButton").addEventListener("click", () => startQuiz(selectedSection));

$("homeButton").addEventListener("click", () => {
    result.style.display = "none";
    home.style.display = "block";
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js")
        .catch(error => console.error("Service Worker gagal didaftarkan:", error));
}

loadOnlineData();