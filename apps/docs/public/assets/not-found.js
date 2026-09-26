// 404 helpers (DX-049) — static 404 page: suggestions, section link, search prefill
(function () {
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }
  function normalized(a, b) {
    const d = levenshtein(a, b);
    const max = Math.max(a.length, b.length);
    return max === 0 ? 0 : d / max;
  }
  function getClosestPages(req, pages) {
    const maxSuggestions = 3, maxDist = 10, maxNorm = 0.6;
    const r = req.toLowerCase().replace(/\/+$/, "") || "/";
    const scored = pages.map((p) => {
      const route = p.route.toLowerCase();
      const d = levenshtein(r, route);
      const n = normalized(r, route);
      const isPrefix = route.startsWith(r) || r.startsWith(route);
      const adjD = isPrefix ? d * 0.7 : d;
      const adjN = isPrefix ? n * 0.7 : n;
      return { page: p, dist: adjD, norm: adjN };
    }).filter((s) => s.dist <= maxDist && s.norm <= maxNorm)
      .sort((a, b) => a.dist - b.dist || a.norm - b.norm)
      .slice(0, maxSuggestions).map((s) => s.page);
    return scored;
  }
  function getSearchTerms(path) {
    const without = path.split("?")[0].split("#")[0];
    return without.split("/").filter(Boolean).join(" ").replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().trim();
  }
  function getSectionLink(req, sections) {
    const r = req.toLowerCase().replace(/\/+$/, "");
    const seg = r.split("/").filter(Boolean)[0];
    if (!seg) return null;
    for (const sec of sections) {
      if (sec.pages.some((p) => p.toLowerCase().startsWith(seg)) && sec.pages.length) {
        return { label: sec.label, href: "/" + sec.pages[0] };
      }
    }
    return null;
  }

  const path = window.location.pathname;
  const pathEl = document.getElementById("not-found-path");
  if (pathEl) pathEl.textContent = path;

  const pageIndexEl = document.getElementById("page-index");
  const sectionsEl = document.getElementById("sections-index");
  let pages = [];
  let sections = [];
  try { pages = JSON.parse(pageIndexEl ? pageIndexEl.textContent : "[]"); } catch {}
  try { sections = JSON.parse(sectionsEl ? sectionsEl.textContent : "[]"); } catch {}

  const suggestions = getClosestPages(path, pages);
  const list = document.getElementById("suggestions-list");
  const sectionWrap = document.getElementById("suggestions-section");
  if (list && sectionWrap) {
    if (suggestions.length) {
      list.innerHTML = suggestions.map((s) => `<li><a href="${s.route}" class="text-sm font-medium text-primary hover:underline">${s.title}</a> <span class="text-xs text-text-tertiary">${s.route}</span></li>`).join("");
      sectionWrap.classList.remove("hidden");
      sectionWrap.removeAttribute("hidden");
    } else {
      sectionWrap.classList.add("hidden");
    }
  }

  const terms = getSearchTerms(path);
  const prefillEl = document.getElementById("search-prefill");
  if (prefillEl) prefillEl.setAttribute("data-search-prefill", terms);
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = terms;

  const section = getSectionLink(path, sections);
  const secWrap = document.getElementById("section-link-wrap");
  const secLink = document.getElementById("section-link");
  if (section && secWrap && secLink) {
    secLink.textContent = "Browse " + section.label;
    secLink.href = section.href;
    secWrap.classList.remove("hidden");
  }

  // Search dialog toggle
  const dialog = document.getElementById("search-dialog");
  function openSearch() {
    if (!dialog) return;
    dialog.hidden = false;
    dialog.removeAttribute("hidden");
    if (searchInput) { searchInput.value = terms; searchInput.focus(); }
    document.body.style.overflow = "hidden";
  }
  function closeSearch() {
    if (!dialog) return;
    dialog.hidden = true;
    dialog.setAttribute("hidden", "");
    document.body.style.overflow = "";
  }
  document.querySelectorAll("[data-open-search]").forEach((el) => el.addEventListener("click", openSearch));
  const closeBtn = document.querySelector("[data-close-search]");
  if (closeBtn) closeBtn.addEventListener("click", closeSearch);
  if (dialog) dialog.addEventListener("click", (e) => { if (e.target === dialog) closeSearch(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && dialog && !dialog.hidden) closeSearch(); });
})();
