(() => {
  const search = document.querySelector("#help-search");
  const resultsBox = document.querySelector("#help-search-results");
  const clearBtn = document.querySelector("[data-help-search-clear]");
  const topicList = document.querySelector(".help-topic-list");

  if (!search || !resultsBox || !topicList) return;

  const faqEls = [...document.querySelectorAll(".help-faq")];
  const topics = [...document.querySelectorAll(".help-topic")];
  const popular = [...document.querySelectorAll("[data-open-faq]")];

  const normalize = (value = "") =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\bpick\s+up\b/g, "pickup")
      .replace(/\bpop\s+up\b/g, "popup")
      .replace(/\bgiraffe\s+box\b/g, "giraffe pack")
      .replace(/\ballergies\b/g, "allergens")
      .replace(/\bcancellation\b/g, "cancel")
      .replace(/\s+/g, " ")
      .trim();

  const tokens = value => normalize(value).split(" ").filter(Boolean);

  const records = faqEls.map(el => {
    const topic = el.closest(".help-topic");
    const answerEl = el.querySelector(".help-faq-answer");
    return {
      id: el.dataset.faqId,
      category: el.dataset.category || "",
      question: el.dataset.question || "",
      aliases: el.dataset.aliases || "",
      status: el.dataset.status || "",
      answer: answerEl ? answerEl.textContent.trim() : "",
      el,
      topic
    };
  });

  const recordById = new Map(records.map(r => [r.id, r]));
  let activeResult = -1;
  let rendered = [];
  let debounceTimer = null;

  function scoreRecord(record, rawQuery) {
    const q = normalize(rawQuery);
    if (!q) return 0;

    const question = normalize(record.question);
    const aliases = normalize(record.aliases);
    const category = normalize(record.category);
    const answer = normalize(record.answer);
    const qTokens = tokens(q);

    let score = 0;

    if (question === q) score += 100;
    if (question.includes(q)) score += 80;
    if (aliases.includes(q)) score += 65;
    if (category.includes(q)) score += 40;

    qTokens.forEach(word => {
      if (word.length < 2) return;
      if (question.split(" ").some(t => t === word)) score += 30;
      else if (question.split(" ").some(t => t.startsWith(word) || word.startsWith(t))) score += 20;

      if (aliases.split(" ").some(t => t === word)) score += 18;
      if (answer.includes(word)) score += 15;
      if (category.includes(word)) score += 10;
    });

    // Small typo tolerance: shared word prefixes.
    if (score < 25) {
      const hay = [...new Set(tokens(question + " " + aliases))];
      qTokens.forEach(word => {
        if (word.length < 4) return;
        if (hay.some(t => t.slice(0, 4) === word.slice(0, 4))) score += 8;
      });
    }

    return score;
  }

  function snippet(text, query) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= 145) return clean;
    const q = normalize(query);
    const normalized = normalize(clean);
    const idx = normalized.indexOf(q);
    if (idx <= 40) return clean.slice(0, 142) + "…";
    return "…" + clean.slice(Math.max(0, idx - 45), idx + 95) + "…";
  }

  function closeResults() {
    resultsBox.hidden = true;
    search.setAttribute("aria-expanded", "false");
    activeResult = -1;
    rendered = [];
  }

  function renderResults(query) {
    const q = normalize(query);
    clearBtn.hidden = !q;

    if (q.length < 2) {
      closeResults();
      return;
    }

    const ranked = records
      .map(record => ({ record, score: scoreRecord(record, q) }))
      .filter(item => item.score >= 15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    resultsBox.innerHTML = "";
    resultsBox.hidden = false;
    search.setAttribute("aria-expanded", "true");
    activeResult = -1;

    if (!ranked.length) {
      resultsBox.innerHTML = `
        <div class="help-search-empty">
          <strong>No exact match found.</strong>
          <p>Try another search, browse Help by Topic below, or contact the OBA Cookie Crew.</p>
          <div class="help-search-empty-actions">
            <button type="button" data-browse-help>Browse Help ↓</button>
            <a href="/contact.html">Contact OBA →</a>
          </div>
        </div>`;
      resultsBox.querySelector("[data-browse-help]")?.addEventListener("click", () => {
        closeResults();
        document.querySelector("#browse-help")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      rendered = [];
      return;
    }

    rendered = ranked;
    ranked.forEach((item, index) => {
      if (index === 0 && item.score >= 45) {
        const label = document.createElement("div");
        label.className = "help-search-best";
        label.textContent = "Best Match";
        resultsBox.appendChild(label);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "help-search-result";
      button.setAttribute("role", "option");
      button.dataset.resultIndex = String(index);
      button.innerHTML = `
        <span class="help-search-kicker">${escapeHTML(item.record.category)}${item.record.status !== "Final" ? " · Coming Soon" : ""}</span>
        <strong>${escapeHTML(item.record.question)}</strong>
        <p>${escapeHTML(snippet(item.record.answer, q))}</p>`;
      button.addEventListener("click", () => openFAQ(item.record.id, true));
      resultsBox.appendChild(button);
    });
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setActiveResult(index) {
    const buttons = [...resultsBox.querySelectorAll(".help-search-result")];
    buttons.forEach(b => b.classList.remove("is-active"));
    if (!buttons.length) return;
    activeResult = (index + buttons.length) % buttons.length;
    buttons[activeResult].classList.add("is-active");
    buttons[activeResult].scrollIntoView({ block: "nearest" });
  }

  function closeOtherTopics(targetTopic) {
    topics.forEach(topic => {
      if (topic !== targetTopic) topic.open = false;
    });
  }

  function openFAQ(id, updateHash = true) {
    const record = recordById.get(String(id));
    if (!record) return;

    closeResults();
    closeOtherTopics(record.topic);
    record.topic.open = true;
    record.el.open = true;

    if (updateHash) {
      history.replaceState(null, "", `#faq-${String(id).replace(".", "-")}`);
    }

    requestAnimationFrame(() => {
      record.el.scrollIntoView({ behavior: "smooth", block: "center" });
      record.el.classList.remove("is-highlighted");
      void record.el.offsetWidth;
      record.el.classList.add("is-highlighted");
      setTimeout(() => record.el.classList.remove("is-highlighted"), 1800);
    });
  }

  // Expose the conceptual controller used by Popular Questions and future internal links.
  window.openFAQ = openFAQ;

  topics.forEach(topic => {
    topic.addEventListener("toggle", () => {
      if (!topic.open) return;
      topics.forEach(other => {
        if (other !== topic) other.open = false;
      });
    });
  });

  popular.forEach(button => {
    button.addEventListener("click", () => openFAQ(button.dataset.openFaq, true));
  });

  search.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderResults(search.value), 170);
  });

  search.addEventListener("keydown", event => {
    if (resultsBox.hidden) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResult(activeResult + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResult(activeResult - 1);
    } else if (event.key === "Enter" && activeResult >= 0 && rendered[activeResult]) {
      event.preventDefault();
      openFAQ(rendered[activeResult].record.id, true);
    } else if (event.key === "Escape") {
      closeResults();
      search.focus();
    }
  });

  clearBtn.addEventListener("click", () => {
    search.value = "";
    clearBtn.hidden = true;
    closeResults();
    search.focus();
  });

  document.addEventListener("click", event => {
    if (!event.target.closest("[data-help-search-shell]")) closeResults();
  });

  function openFromHash() {
    const match = location.hash.match(/^#faq-(\d+)-(\d+)$/);
    if (!match) return;
    openFAQ(`${match[1]}.${match[2]}`, false);
  }

  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
