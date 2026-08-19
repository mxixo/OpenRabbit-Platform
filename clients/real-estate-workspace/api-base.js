"use strict";

// Desktop builds load the workspace from file://, so relative /v1 requests need
// an explicit remote API origin. Browser deployments can leave this blank and
// continue using same-origin requests.
const nativeFetch = window.fetch.bind(window);

window.fetch = (input, init) => {
  if (typeof input === "string" && input.startsWith("/v1/")) {
    const apiBaseField = document.getElementById("apiBase");
    const apiBase = apiBaseField?.value?.trim().replace(/\/+$/, "") || "";

    if (window.location.protocol === "file:") {
      if (!apiBase) {
        return Promise.reject(new Error("API base URL is required in the desktop app. Open Advanced connection settings and enter your OpenRabbit API URL."));
      }
      return nativeFetch(`${apiBase}${input}`, init);
    }

    if (apiBase) return nativeFetch(`${apiBase}${input}`, init);
  }

  return nativeFetch(input, init);
};
