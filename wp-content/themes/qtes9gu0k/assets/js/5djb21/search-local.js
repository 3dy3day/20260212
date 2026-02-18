/**
 * search-local.js
 * Replaces app.bundle.js for local search functionality.
 * - Handles keypad (left-radical + right-radical -> CJK character lookup)
 * - Intercepts form submission -> proxy search -> deactivated results
 * - Handles result link clicks -> proxy page fetch -> deactivated page view
 *
 * Works in two modes (auto-detected):
 *   localhost  -> uses search_proxy.py on port 8081
 *   GitHub Pages / other -> uses allorigins CORS proxy + JS-side deactivation
 */
(function () {
  "use strict";

  var LIVE_SITE = "https://www.qtes9gu0k.xyz";
  var ALLORIGINS = "https://api.allorigins.win/get?url=";
  var IS_LOCAL = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var PROXY_ORIGIN = location.protocol + "//" + location.hostname + ":8081";

  var KEY_MAP = null;
  var inputField = document.getElementById("5djb21-input");
  var submitButton = document.getElementById("submit-button");
  var form = document.querySelector(".p-5djb21__form");
  var dataPathEl = document.getElementById("data-path");
  var dataPath = dataPathEl ? dataPathEl.value : "/20260212/wp-content/themes/qtes9gu0k/assets/data/";

  // ========== Deactivation (JS-side, for GitHub Pages mode) ==========

  function deactivateHtml(html) {
    // 1. Remote URLs -> local paths
    html = html.replace(/https:\/\/www\.qtes9gu0k\.xyz\//g, "/20260212/");
    // 2. Comment out app.bundle.js
    html = html.replace(
      /<script([^>]*app\.bundle\.js[^>]*)><\/script>/g,
      "<!-- <script$1></script> -->"
    );
    // 3. Strip ?ver= from CSS URL
    html = html.replace(/(app\.css)\?ver=[^"]*"/g, '$1"');
    // 4. Add is-loaded class to result items
    html = html.replace(/p-5djb21-result__item">/g, 'p-5djb21-result__item is-loaded">');
    return html;
  }

  function extractResultHtml(html) {
    var m = html.match(/<div class="p-5djb21-result">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/main>/);
    if (m) {
      return '<div class="p-5djb21-result">' + m[1] + "</div>";
    }
    return null;
  }

  // ========== Fetch abstraction ==========

  function fetchFromLiveSite(url) {
    if (IS_LOCAL) {
      // Use local proxy - returns JSON with {ok, html, result_html, has_results}
      var proxyUrl;
      if (url.indexOf("?s=") !== -1) {
        var query = url.split("?s=")[1];
        proxyUrl = PROXY_ORIGIN + "/api/search?s=" + query;
      } else {
        var path = url.replace(LIVE_SITE, "");
        proxyUrl = PROXY_ORIGIN + "/api/page?path=" + encodeURIComponent(path);
      }
      return fetch(proxyUrl)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) throw new Error(data.error || "proxy error");
          return data.html;
        });
    } else {
      // Use allorigins CORS proxy
      var encoded = encodeURIComponent(url);
      return fetch(ALLORIGINS + encoded)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.contents) throw new Error("allorigins returned no contents");
          return deactivateHtml(data.contents);
        });
    }
  }

  // ========== Keypad Logic ==========

  var leftRadicals = document.querySelectorAll('input[name="left-radical"]');
  var rightRadicals = document.querySelectorAll('input[name="right-radical"]');
  var deleteButtons = document.querySelectorAll('button[name="delete"]');

  var swiperInstance = null;
  var swiperContainer = document.querySelector(".c-keypad__container");

  function initSwiper() {
    if (window.innerWidth <= 768 && swiperContainer && typeof Swiper !== "undefined") {
      if (!swiperInstance) {
        swiperInstance = new Swiper(swiperContainer, {
          speed: 350,
          pagination: {
            el: ".c-keypad__nav-indicator",
            clickable: true,
            bulletClass: "c-keypad__nav-dot",
            bulletActiveClass: "is-active",
          },
          navigation: {
            prevEl: ".c-keypad__nav-button--left-radical",
            nextEl: ".c-keypad__nav-button--right-radical",
          },
        });
      }
    } else if (swiperInstance) {
      swiperInstance.destroy(true, true);
      swiperInstance = null;
    }
  }

  function slideTo(index) {
    if (swiperInstance) {
      swiperInstance.slideTo(index);
    }
  }

  function loadKeyMap() {
    var keyMapUrl = dataPath + "key-map.json";
    fetch(keyMapUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        KEY_MAP = data;
        console.log("[search-local] key-map loaded:", Object.keys(data).length, "pages");
      })
      .catch(function (err) {
        console.error("[search-local] Failed to load key-map from", keyMapUrl, err);
        fetch("/key-map.json")
          .then(function (r) { return r.json(); })
          .then(function (data) {
            KEY_MAP = data;
            console.log("[search-local] key-map loaded from fallback /key-map.json");
          })
          .catch(function (err2) {
            console.error("[search-local] key-map fallback also failed:", err2);
          });
      });
  }

  function mergeRadicals() {
    var left = document.querySelector('input[name="left-radical"]:checked');
    var right = document.querySelector('input[name="right-radical"]:checked');
    if (left && right && KEY_MAP) {
      var lv = left.value;
      var rv = right.value;
      if (KEY_MAP[lv] && KEY_MAP[lv][rv]) {
        inputField.value += KEY_MAP[lv][rv];
        left.checked = false;
        right.checked = false;
        updateSubmitButton();
      }
    }
  }

  function updateSubmitButton() {
    submitButton.disabled = inputField.value.length === 0;
  }

  leftRadicals.forEach(function (el) {
    el.addEventListener("click", function () {
      if (el.checked) {
        leftRadicals.forEach(function (o) { o.checked = false; });
        el.checked = true;
        slideTo(1);
      }
    });
    el.addEventListener("change", mergeRadicals);
  });

  rightRadicals.forEach(function (el) {
    el.addEventListener("click", function () {
      if (el.checked) {
        rightRadicals.forEach(function (o) { o.checked = false; });
        el.checked = true;
        slideTo(0);
      }
    });
    el.addEventListener("change", mergeRadicals);
  });

  deleteButtons.forEach(function (el) {
    el.addEventListener("click", function () {
      var v = inputField.value;
      var chars = Array.from(v);
      chars.pop();
      inputField.value = chars.join("");
      updateSubmitButton();
    });
  });

  // ========== Search Form Interception ==========

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var query = inputField.value;
    if (!query) return;

    showLoading(query);

    var searchUrl = LIVE_SITE + "/?s=" + encodeURIComponent(query);

    fetchFromLiveSite(searchUrl)
      .then(function (html) {
        var hasResults = html.indexOf("p-5djb21-result__item") !== -1;
        var resultHtml = hasResults ? extractResultHtml(html) : null;
        showResults(resultHtml, hasResults, query);
      })
      .catch(function (err) {
        var hint = IS_LOCAL ? "\nsearch_proxy.py is running?" : "\nCORS proxy may be down.";
        showError("Search error: " + err.message + hint);
      });
  });

  // ========== Results Display ==========

  function getOrCreateResultArea() {
    var area = document.getElementById("search-result-area");
    if (!area) {
      area = document.createElement("div");
      area.id = "search-result-area";
      area.style.cssText = "margin-top: 2em;";
      var pageBody = document.querySelector(".l-page__body .l-container--middle .p-5djb21");
      if (pageBody) {
        pageBody.appendChild(area);
      } else {
        document.querySelector(".l-main").appendChild(area);
      }
    }
    return area;
  }

  function showLoading(query) {
    var area = getOrCreateResultArea();
    area.innerHTML =
      '<div class="p-5djb21-result">' +
      '<div class="p-5djb21-result__announce">' +
      '<p>"' + escapeHtml(query) + '" searching...</p>' +
      "</div></div>";
  }

  function showError(msg) {
    var area = getOrCreateResultArea();
    area.innerHTML =
      '<div style="color:red; padding:1em; border:1px solid red; margin-top:1em;">' +
      "<strong>Error:</strong> " + escapeHtml(msg) +
      "</div>";
  }

  function showResults(resultHtml, hasResults, query) {
    var area = getOrCreateResultArea();

    if (hasResults && resultHtml) {
      area.innerHTML = resultHtml;
      // Intercept result link clicks
      area.querySelectorAll(".p-5djb21-result__link").forEach(function (link) {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          var href = link.getAttribute("href");
          openDeactivatedPage(href);
        });
      });
    } else {
      area.innerHTML =
        '<div class="p-5djb21-result">' +
        '<div class="p-5djb21-result__announce">' +
        '<p>"' + escapeHtml(query) + '" - no results</p>' +
        "</div></div>";
    }
  }

  // ========== Page Viewer ==========

  function openDeactivatedPage(localHref) {
    // localHref looks like /20260212/qgur/abc123/
    // First check if the page exists locally
    fetch(localHref, { method: "HEAD" })
      .then(function (r) {
        if (r.ok) {
          window.open(localHref, "_blank");
        } else {
          throw new Error("not found locally");
        }
      })
      .catch(function () {
        // Fetch from live site via proxy
        var livePath = localHref.replace("/20260212/", "/");
        var liveUrl = LIVE_SITE + livePath;

        fetchFromLiveSite(liveUrl)
          .then(function (html) {
            var w = window.open("", "_blank");
            w.document.write(html);
            w.document.close();
          })
          .catch(function (err) {
            alert("Failed to fetch page: " + err.message);
          });
      });
  }

  // ========== Utility ==========

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ========== Init ==========

  loadKeyMap();
  initSwiper();
  window.addEventListener("resize", initSwiper);

  document.body.style.overflow = "";
  document.body.style.opacity = "1";

  console.log("[search-local] Initialized. Mode:", IS_LOCAL ? "LOCAL (proxy)" : "REMOTE (allorigins)");
})();
