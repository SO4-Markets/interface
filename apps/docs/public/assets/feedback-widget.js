// DX-061: cookieless "was this helpful" page feedback.
//
// Loaded as an external file because the docs CSP is `script-src 'self'`
// with no `'unsafe-inline'`, so an inline <script> would be blocked. Every
// sessionStorage access is wrapped in try/catch: private browsing modes and
// storage-disabled browsers throw on access rather than returning null, and
// a feedback control failing must never block the rest of the page.
(function () {
  "use strict";

  function sessionGet(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function sessionSet(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (e) {
      // Storage unavailable — the rate limit simply does not apply this session.
    }
  }

  function submit(path, verdict, comment) {
    try {
      fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: path,
          verdict: verdict,
          comment: comment || undefined,
        }),
      }).catch(function () {
        // Silent to the reader by design — the page must never show a
        // network error for an optional feedback submission.
      });
    } catch (e) {
      // fetch itself can throw synchronously in some restricted contexts.
    }
  }

  function init(section) {
    var path = section.getAttribute("data-feedback-path");
    if (!path) return;

    var storageKey = "so4-docs-feedback:" + path;
    var status = section.querySelector(".feedback-status");
    var controls = section.querySelector(".feedback-controls");
    var followup = section.querySelector(".feedback-followup");
    var comment = section.querySelector(".feedback-comment");
    var submitButton = section.querySelector(".feedback-submit");
    var yesButton = section.querySelector(".feedback-yes");
    var noButton = section.querySelector(".feedback-no");
    if (!status || !controls || !followup || !comment || !submitButton || !yesButton || !noButton) return;

    if (sessionGet(storageKey)) {
      controls.hidden = true;
      status.textContent = "Thanks for the feedback.";
      return;
    }

    function respond(verdict) {
      controls.hidden = true;
      followup.hidden = false;
      status.textContent = "Add an optional comment, or submit as is.";
      submitButton.onclick = function () {
        sessionSet(storageKey, "1");
        followup.hidden = true;
        status.textContent = "Thanks for the feedback.";
        submit(path, verdict, comment.value);
      };
    }

    yesButton.addEventListener("click", function () {
      respond("yes");
    });
    noButton.addEventListener("click", function () {
      respond("no");
    });
  }

  var sections = document.querySelectorAll(".feedback-widget");
  for (var i = 0; i < sections.length; i++) {
    init(sections[i]);
  }
})();
