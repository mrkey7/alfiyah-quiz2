"use strict";

const $ = id => document.getElementById(id);

const DATA_URL = "./ALFIYYAH.json";
const sections = {
    awal: { start: 1, end: 334 },
    tsani: { start: 335, end: 668 },
    tsalits: { start: 669, end: 1003 },
    semua: { start: 1, end: 1003 }
};

let baitData = [];
let activeBaitData = [];
let questions = [];
let questionIndex = 0;
let correctCount = 0;
let answeredCount = 0;
let answered = false;
let selectedSection = "semua";
let quizStartedAt = 0;
let timerInterval = null;

function showScreen(name) {
    document.dispatchEvent(new CustomEvent("app:show-screen", {
        detail: { name }
    }));
}

function rhymeKey(text) {
    const words = String(text ?? "")
        .normalize("NFC")
        .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
        .replace(/[،؛,.!?؟\\]+$/g, "")
        .trim()
        .split(/\\s+/);

    const word = (words.pop() || "")
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ى/g, "ا")
        .replace(/ة/g, "ه");

    return [...word].filter(char => /[\u0621-\u064A]/.test(char)).slice(-2).join("");
}

function getPlayableData(rows) {
    const firstGroups = new Map();
    const secondGroups = new Map();

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

function prepareData(data) {
    if (!data || !Array.isArray(data.rows)) {
        throw new Error("Format data Alfiyyah tidak sesuai.");
    }

    const rows = data.rows.filter(row =>
        String(row["أول"] ?? "").trim() &&
        String(row["ثَان"] ?? "").trim()
    );

    baitData = rows.filter(row => {
        const rhyme = rhymeKey(row["أول"]);
        return rhyme && rhyme === rhymeKey(row["ثَان"]);
    });

    const counts = {};
    Object.entries(sections).forEach(([key, section]) => {
        const selected = baitData.filter(row => {
            const number = Number(row["نمر"]);
            return number >= section.start && number <= section.end;
        });

        counts[key] = getPlayableData(selected).length;
    });

    document.dispatchEvent(new CustomEvent("kuis1:data-ready", {
        detail: { counts, totalBait: baitData.length }
    }));
}

async function loadData() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error("HTTP " + response.status);
        prepareData(await response.json());
    } catch (error) {
        document.dispatchEvent(new CustomEvent("kuis1:data-error", {
            detail: { message: error.message }
        }));
    }
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
        const number = Number(row["نمر"]);
        return number >= section.start && number <= section.end;
    });

    activeBaitData = getPlayableData(rows);
    questions = shuffle(activeBaitData);

    if (!questions.length) return;

    questionIndex = 0;
    correctCount = 0;
    answeredCount = 0;
    answered = false;

    clearInterval(timerInterval);
    quizStartedAt = Date.now();
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);

    showScreen("quiz");
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
    const distractors = shuffle(allAnswers.filter(answer => answer !== correctAnswer)).slice(0, 3);

    if (distractors.length < 3) {
        throw new Error("Data tidak memiliki cukup pilihan jawaban berbeda.");
    }

    const choices = shuffle([correctAnswer, ...distractors]);

    answered = false;

    $("questionNumber").textContent = (questionIndex + 1) + " / " + questions.length;
    $("quizAvailable").textContent = questions.length - questionIndex;
    $("score").textContent = correctCount;
    $("progressBar").style.width = (questionIndex / questions.length * 100) + "%";

    $("rightHalf").textContent = askFirst ? "" : first;
    $("leftHalf").textContent = askFirst ? second : "";
    $("rightHalf").classList.toggle("is-empty", askFirst);
    $("leftHalf").classList.toggle("is-empty", !askFirst);

    const baitNo = Number(item["نمر"]);
    $("questionTitle").textContent = "Lengkapi Bait " + baitNo.toLocaleString("id-ID") + " Berikut";
    $("baitNumber").textContent = String(item["ن"] ?? baitNo);

    const options = $("options");
    options.replaceChildren();

    choices.forEach(answer => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "option";
        button.lang = "ar";
        button.textContent = answer;
        button.addEventListener("click", () => chooseAnswer(button, answer, correctAnswer));

        options.appendChild(button);
    });

    $("feedback").className = "feedback";
    $("feedback").textContent = "Pilih satu jawaban.";
    $("nextButton").textContent = questionIndex === questions.length - 1 ? "Lihat Hasil" : "Soal Berikutnya";
    $("nextButton").disabled = true;
    $("finishButton").disabled = false;
}

function chooseAnswer(selectedButton, answer, correctAnswer) {
    if (answered) return;
    answered = true;

    [...$("options").children].forEach(button => {
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
        $("feedback").textContent = "Belum tepat. Jawaban yang benar ditandai warna hijau.";
    }

    $("score").textContent = correctCount;
    $("progressBar").style.width = ((questionIndex + 1) / questions.length * 100) + "%";
    $("nextButton").disabled = false;
}

function updateTimer() {
    const seconds = Math.floor((Date.now() - quizStartedAt) / 1000);
    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
    const remainder = String(seconds % 60).padStart(2, "0");

    $("timer").textContent = minutes + ":" + remainder;
}

function showResult() {
    clearInterval(timerInterval);
    timerInterval = null;

    showScreen("result");

    const percent = answeredCount ? Math.round(correctCount / answeredCount * 100) : 0;

    $("finalScore").textContent = correctCount + " / " + answeredCount;
    $("finalDetail").textContent = answeredCount
        ? answeredCount + " dari " + questions.length + " soal dikerjakan · Akurasi " + percent + "%."
        : "Belum ada soal yang dijawab.";
}

function initKuis1() {
    document.addEventListener("kuis1:start", event => {
        startQuiz(event.detail.sectionKey);
    });

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
    $("retryButton").addEventListener("click", () => startQuiz(selectedSection));

    $("homeButton").addEventListener("click", () => {
        clearInterval(timerInterval);
        timerInterval = null;
        showScreen("home");
    });

    loadData();
}

export { initKuis1 };