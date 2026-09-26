// DX-050: versioned documentation routing — the version picker.
//
// Every <option> already carries the exact destination URL as its value,
// computed at build time in scripts/build.ts (resolveVersionSwitchTarget in
// src/lib/doc-versions.ts). This script only has to navigate on change; it
// does no route arithmetic of its own. External file for the same CSP
// reason as feedback-widget.js: script-src 'self' with no 'unsafe-inline'.
(function () {
  "use strict";

  var picker = document.querySelector(".doc-version-picker");
  if (!picker) return;

  picker.addEventListener("change", function () {
    if (picker.value) {
      window.location.href = picker.value;
    }
  });
})();
