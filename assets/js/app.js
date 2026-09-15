/* =========================================================
   शौर्य Shaurya — Indian Armed Forces Radio
   Audio-only YouTube playback + rotating quotes + rotating photos
   ========================================================= */
(function () {
  "use strict";

  // ---------- Config ----------
  var CONFIG = {
    // Paste a public/unlisted YouTube (or YouTube Music) playlist ID here to
    // use your own playlist instead of the curated one. Can be overridden per
    // visit with ?list=PLxxxxxxxx in the URL.
    playlistId: "",
    quoteMs: 13000,      // quote rotation
    bgMs: 20000,         // background rotation
    defaultVolume: 80,
  };

  var $ = function (id) { return document.getElementById(id); };
  var TRACKS = (window.SHAURYA_TRACKS || []).slice();
  var QUOTES = (window.SHAURYA_QUOTES || []).slice();
  var BGS = (window.SHAURYA_BACKGROUNDS || []).slice();

  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem("shaurya:" + k); return v === null ? d : v; }
      catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem("shaurya:" + k, String(v)); } catch (e) {}
    },
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("is-on"); }, 2200);
  }

  // ---------- Ashoka Chakra (24 spokes) ----------
  function drawChakra(groupId) {
    var g = document.getElementById(groupId);
    if (!g) return;
    var parts = [
      '<circle cx="50" cy="50" r="46" stroke-width="3"/>',
      '<circle cx="50" cy="50" r="7" stroke-width="3"/>',
    ];
    for (var i = 0; i < 24; i++) {
      var a = (i * 15) * Math.PI / 180;
      parts.push(
        '<line x1="' + (50 + 8 * Math.cos(a)).toFixed(2) +
        '" y1="' + (50 + 8 * Math.sin(a)).toFixed(2) +
        '" x2="' + (50 + 45 * Math.cos(a)).toFixed(2) +
        '" y2="' + (50 + 45 * Math.sin(a)).toFixed(2) +
        '" stroke-width="1.6"/>'
      );
    }
    g.innerHTML = parts.join("");
  }
  ["chakraG", "chakraG2", "chakraG3"].forEach(drawChakra);

  /* =======================================================
     Quotes
     ======================================================= */
  var quoteBox = $("quoteBox"),
      quoteText = $("quoteText"),
      quoteAuthor = $("quoteAuthor"),
      quoteBarFill = $("quoteBar").firstElementChild;

  var quoteQueue = [], quoteTimer = null, quoteStart = 0, quoteRaf = null;

  function nextQuoteItem() {
    if (!quoteQueue.length) {
      quoteQueue = shuffle(QUOTES.slice());
      // Avoid repeating the quote that was just shown
      if (quoteQueue.length > 1 && quoteText.textContent &&
          quoteQueue[0].text === quoteText.textContent) {
        quoteQueue.push(quoteQueue.shift());
      }
    }
    return quoteQueue.shift();
  }

  function paintQuote(q) {
    quoteText.textContent = q.text;
    quoteAuthor.textContent = "— " + q.author;
    quoteBox.dataset.kind = q.kind;
  }

  function showQuote(instant) {
    var q = nextQuoteItem();
    if (instant) {
      paintQuote(q);
    } else {
      quoteBox.classList.add("is-fading");
      setTimeout(function () {
        paintQuote(q);
        quoteBox.classList.remove("is-fading");
      }, 420);
    }
    restartQuoteTimer();
  }

  function tickQuoteBar() {
    var pct = Math.min(100, ((Date.now() - quoteStart) / CONFIG.quoteMs) * 100);
    quoteBarFill.style.width = pct + "%";
    quoteRaf = requestAnimationFrame(tickQuoteBar);
  }

  function restartQuoteTimer() {
    clearTimeout(quoteTimer);
    cancelAnimationFrame(quoteRaf);
    quoteStart = Date.now();
    tickQuoteBar();
    quoteTimer = setTimeout(function () { showQuote(false); }, CONFIG.quoteMs);
  }

  /* =======================================================
     Backgrounds
     ======================================================= */
  var layers = document.querySelectorAll(".bg-layer");
  var bgQueue = [], bgIdx = -1, bgTimer = null, bgActive = 0, bgBusy = false;
  var creditBox = $("photoCredit"), creditText = $("photoCreditText");

  function preload(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(src); };
      img.onerror = function () { reject(src); };
      img.src = src;
    });
  }

  function paintBg(item) {
    var incoming = layers[1 - bgActive], outgoing = layers[bgActive];
    incoming.style.backgroundImage = 'url("' + item.src + '")';
    // Restart the Ken Burns drift on the incoming layer
    incoming.classList.remove("is-active");
    void incoming.offsetWidth;
    incoming.classList.add("is-active");
    outgoing.classList.remove("is-active");
    bgActive = 1 - bgActive;

    var bits = [item.label];
    if (item.author) bits.push(item.author);
    if (item.license) bits.push(item.license);
    creditText.textContent = bits.join(" · ");
    creditBox.classList.add("is-on");
  }

  /* Advance to the next usable photo. Tries each candidate in turn so a single
     missing file can never stall or loop the slideshow. */
  function advanceBg(restartTimer) {
    if (!bgQueue.length || bgBusy) return;
    bgBusy = true;
    var attempts = 0;

    function tryNext() {
      if (attempts >= bgQueue.length) { bgBusy = false; return; }
      attempts++;
      bgIdx = (bgIdx + 1) % bgQueue.length;
      var item = bgQueue[bgIdx];
      preload(item.src).then(function () {
        paintBg(item);
        bgBusy = false;
        // Warm the following image so the next crossfade is instant
        var peek = bgQueue[(bgIdx + 1) % bgQueue.length];
        if (peek) preload(peek.src).catch(function () {});
      }).catch(tryNext);
    }

    tryNext();
    if (restartTimer !== false) restartBgTimer();
  }

  function restartBgTimer() {
    clearTimeout(bgTimer);
    bgTimer = setTimeout(function () { advanceBg(true); }, CONFIG.bgMs);
  }

  function initBackgrounds() {
    if (!BGS.length) {
      creditBox.style.display = "none";
      return;
    }
    bgQueue = shuffle(BGS.slice());
    bgIdx = -1;
    advanceBg(true);
  }

  /* =======================================================
     Player (YouTube IFrame API — audio only, video never shown)
     ======================================================= */
  var params = new URLSearchParams(location.search);
  var playlistId = params.get("list") || CONFIG.playlistId || "";
  var usePlaylist = !!playlistId;

  /* A private link — index.html?for=mj — greets the person this was built for.
     Anyone arriving without the parameter sees the ordinary start screen. */
  var DEDICATIONS = {
    mj: {
      name: "MJ",
      salute: "MJ — this one's for you 🇮🇳",
    },
  };
  var dedication = DEDICATIONS[(params.get("for") || "").trim().toLowerCase()] || null;

  var yt = null, ready = false, order = [], cur = 0, playing = false;
  var pollTimer = null, seeking = false, deadIds = {};
  var wantPlay = false;

  var playBtn = $("playBtn"), plTitle = $("plTitle"), plCredit = $("plCredit"),
      plState = $("plState"), plEq = $("plEq"), plDisc = $("plDisc"),
      fill = $("progressFill"), knob = $("progressKnob"),
      tCur = $("tCur"), tDur = $("tDur"), progressWrap = $("progressWrap"),
      volRange = $("volRange"), muteBtn = $("muteBtn"), volWrap = muteBtn.parentNode;

  function buildOrder() {
    order = TRACKS.map(function (_, i) { return i; });
    shuffle(order);
    cur = 0;
  }

  function currentTrack() {
    if (usePlaylist) return null;
    return TRACKS[order[cur]] || null;
  }

  function renderNowPlaying() {
    if (usePlaylist) {
      var data = null;
      try { data = yt && yt.getVideoData ? yt.getVideoData() : null; } catch (e) {}
      plTitle.textContent = (data && data.title) ? data.title : "Loading your playlist…";
      plCredit.textContent = (data && data.author) ? data.author : "Your YouTube playlist";
      return;
    }
    var t = currentTrack();
    plTitle.textContent = t ? t.name : "—";
    plCredit.textContent = t ? t.credit : "";
    var link = $("ytLink");
    if (t) link.href = "https://www.youtube.com/watch?v=" + t.id;
    highlightTrack();
  }

  /* Keeping the music going on a phone.

     True screen-off playback is not available to us: mobile browsers suspend a
     cross-origin YouTube embed when the tab is backgrounded or the screen
     locks, and YouTube itself treats background play as a Premium feature. So
     the achievable goal is to stop the phone from sleeping on its own while
     Shaurya is open and playing, which is what kills playback in practice.

     The lock is released on pause, and the browser drops it whenever the page
     is hidden, so it is re-requested when the page comes back. */
  var wakeLock = null;

  function releaseWakeLock() {
    var held = wakeLock;
    wakeLock = null;
    if (held) { try { held.release(); } catch (e) {} }
  }

  function requestWakeLock() {
    if (!("wakeLock" in navigator) || wakeLock || document.hidden) return;
    navigator.wakeLock.request("screen").then(function (lock) {
      wakeLock = lock;
      lock.addEventListener("release", function () { wakeLock = null; });
    }).catch(function () {
      // Denied, unsupported, or not over HTTPS — playback still works.
    });
  }

  function setPlayingUI(on) {
    playing = on;
    playBtn.classList.toggle("is-playing", on);
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    plEq.classList.toggle("is-on", on);
    plDisc.classList.toggle("is-spinning", on);
    plState.textContent = on ? "ON AIR" : "PAUSED";
    if (on) requestWakeLock(); else releaseWakeLock();
  }

  function load(index, autoplay) {
    if (usePlaylist) return;
    cur = (index + order.length) % order.length;
    var t = currentTrack();
    if (!t) return;
    renderNowPlaying();
    if (!ready) { wantPlay = autoplay; return; }
    if (autoplay) yt.loadVideoById(t.id);
    else yt.cueVideoById(t.id);
  }

  function next(auto) {
    if (usePlaylist) { try { yt.nextVideo(); } catch (e) {} return; }
    // Skip tracks known to be unplayable
    for (var hops = 0; hops < order.length; hops++) {
      cur = (cur + 1) % order.length;
      var t = TRACKS[order[cur]];
      if (t && !deadIds[t.id]) break;
    }
    load(cur, true);
    if (!auto) toast("Next: " + (currentTrack() ? currentTrack().name : ""));
  }

  function prev() {
    if (usePlaylist) { try { yt.previousVideo(); } catch (e) {} return; }
    try {
      if (yt && yt.getCurrentTime && yt.getCurrentTime() > 4) { yt.seekTo(0, true); return; }
    } catch (e) {}
    for (var hops = 0; hops < order.length; hops++) {
      cur = (cur - 1 + order.length) % order.length;
      var t = TRACKS[order[cur]];
      if (t && !deadIds[t.id]) break;
    }
    load(cur, true);
  }

  function togglePlay() {
    if (!ready) { wantPlay = true; return; }
    try {
      if (playing) yt.pauseVideo();
      else yt.playVideo();
    } catch (e) {}
  }

  function poll() {
    if (!ready || seeking) return;
    var d = 0, c = 0;
    try { d = yt.getDuration() || 0; c = yt.getCurrentTime() || 0; } catch (e) { return; }
    if (d > 0) {
      var pct = Math.max(0, Math.min(100, (c / d) * 100));
      fill.style.width = pct + "%";
      knob.style.left = pct + "%";
      progressWrap.setAttribute("aria-valuenow", Math.round(pct));
    }
    tCur.textContent = fmtTime(c);
    tDur.textContent = fmtTime(d);
  }

  // ---------- Seek ----------
  function seekFromEvent(e) {
    var rect = progressWrap.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    var ratio = Math.max(0, Math.min(1, x / rect.width));
    var d = 0;
    try { d = yt.getDuration() || 0; } catch (err) {}
    if (d > 0) {
      try { yt.seekTo(d * ratio, true); } catch (err) {}
      fill.style.width = (ratio * 100) + "%";
      knob.style.left = (ratio * 100) + "%";
    }
  }

  progressWrap.addEventListener("pointerdown", function (e) {
    if (!ready) return;
    seeking = true;
    progressWrap.setPointerCapture(e.pointerId);
    seekFromEvent(e);
  });
  progressWrap.addEventListener("pointermove", function (e) {
    if (seeking) seekFromEvent(e);
  });
  progressWrap.addEventListener("pointerup", function () { seeking = false; });
  progressWrap.addEventListener("pointercancel", function () { seeking = false; });
  progressWrap.addEventListener("keydown", function (e) {
    if (!ready) return;
    var d = 0, c = 0;
    try { d = yt.getDuration() || 0; c = yt.getCurrentTime() || 0; } catch (err) { return; }
    if (e.key === "ArrowRight") { yt.seekTo(Math.min(d, c + 5), true); e.preventDefault(); }
    if (e.key === "ArrowLeft") { yt.seekTo(Math.max(0, c - 5), true); e.preventDefault(); }
  });

  // ---------- Volume ----------
  var savedVol = parseInt(store.get("vol", CONFIG.defaultVolume), 10);
  if (isNaN(savedVol)) savedVol = CONFIG.defaultVolume;
  volRange.value = savedVol;

  function applyVolume(v, remember) {
    try {
      yt.setVolume(v);
      if (v === 0) yt.mute(); else yt.unMute();
    } catch (e) {}
    volWrap.classList.toggle("is-muted", v === 0);
    if (remember) store.set("vol", v);
  }

  volRange.addEventListener("input", function () {
    applyVolume(parseInt(volRange.value, 10), true);
  });

  muteBtn.addEventListener("click", function () {
    var v = parseInt(volRange.value, 10);
    if (v > 0) {
      store.set("volPrev", v);
      volRange.value = 0;
      applyVolume(0, true);
    } else {
      var pv = parseInt(store.get("volPrev", CONFIG.defaultVolume), 10) || CONFIG.defaultVolume;
      volRange.value = pv;
      applyVolume(pv, true);
    }
  });

  /* =======================================================
     Playlist drawer
     ======================================================= */
  var drawer = $("drawer"), scrim = $("drawerScrim"), tracklist = $("tracklist");

  function renderTracklist() {
    if (usePlaylist) {
      $("drawerNote").textContent =
        "Playing your own YouTube playlist on shuffle. Remove ?list= from the URL to " +
        "return to the curated Shaurya playlist.";
      $("drawerCount").textContent = "";
      tracklist.innerHTML = "";
      return;
    }
    $("drawerNote").textContent =
      "Shuffled fresh on every visit. Audio streams from YouTube; nothing is hosted here.";
    $("drawerCount").textContent = "(" + TRACKS.length + ")";

    var frag = document.createDocumentFragment();
    order.forEach(function (ti, pos) {
      var t = TRACKS[ti];
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tl-btn";
      b.dataset.pos = pos;
      b.innerHTML =
        '<span class="tl-main"><span class="tl-name"></span>' +
        '<span class="tl-credit"></span></span>' +
        '<span class="tl-dur"></span>';
      b.querySelector(".tl-name").textContent = t.name;
      b.querySelector(".tl-credit").textContent = t.credit || "";
      b.querySelector(".tl-dur").textContent = t.duration ? fmtTime(t.duration) : "";
      if (deadIds[t.id]) b.classList.add("is-dead");
      b.addEventListener("click", function () {
        load(pos, true);
        closeDrawer();
      });
      li.appendChild(b);
      frag.appendChild(li);
    });
    tracklist.innerHTML = "";
    tracklist.appendChild(frag);
    highlightTrack();
  }

  function highlightTrack() {
    var btns = tracklist.querySelectorAll(".tl-btn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("is-current", parseInt(btns[i].dataset.pos, 10) === cur);
    }
  }

  function openDrawer() {
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    scrim.classList.add("is-on");
    $("listBtn").setAttribute("aria-expanded", "true");
    var active = tracklist.querySelector(".tl-btn.is-current");
    if (active) active.scrollIntoView({ block: "center" });
  }

  function closeDrawer() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    scrim.classList.remove("is-on");
    $("listBtn").setAttribute("aria-expanded", "false");
  }

  function toggleDrawer() {
    if (drawer.classList.contains("is-open")) closeDrawer();
    else openDrawer();
  }

  /* =======================================================
     YouTube API bootstrap
     ======================================================= */
  window.onYouTubeIframeAPIReady = function () {
    var vars = {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      iv_load_policy: 3,
      origin: location.origin,
    };

    var opts = {
      width: "1", height: "1",
      playerVars: vars,
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerState,
        onError: onPlayerError,
      },
    };

    if (usePlaylist) {
      vars.listType = "playlist";
      vars.list = playlistId;
    } else {
      var first = currentTrack();
      opts.videoId = first ? first.id : undefined;
    }

    yt = new YT.Player("ytFrame", opts);
  };

  function onPlayerReady() {
    ready = true;
    applyVolume(parseInt(volRange.value, 10), false);
    if (usePlaylist) {
      try { yt.setShuffle(true); } catch (e) {}
    }
    clearInterval(pollTimer);
    pollTimer = setInterval(poll, 250);
    if (wantPlay) {
      wantPlay = false;
      try { yt.playVideo(); } catch (e) {}
    }
    renderNowPlaying();
  }

  function onPlayerState(e) {
    var S = window.YT.PlayerState;
    if (e.data === S.PLAYING) {
      setPlayingUI(true);
      renderNowPlaying();
    } else if (e.data === S.PAUSED) {
      setPlayingUI(false);
    } else if (e.data === S.ENDED) {
      if (!usePlaylist) next(true);
    } else if (e.data === S.BUFFERING) {
      plState.textContent = "LOADING";
    } else if (e.data === S.CUED) {
      plState.textContent = "READY";
    }
  }

  // Unplayable video (removed, private, or embedding disabled) → skip on
  function onPlayerError() {
    var t = currentTrack();
    if (t) {
      deadIds[t.id] = true;
      toast("Skipped an unavailable track");
    }
    if (!usePlaylist) {
      renderTracklist();
      next(true);
    }
  }

  function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) { window.onYouTubeIframeAPIReady(); return; }
    var s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  }

  /* =======================================================
     Session ticker + IST clock + salutes
     ======================================================= */
  var sessionSecs = 0;
  setInterval(function () {
    if (playing) {
      sessionSecs++;
      var m = Math.floor(sessionSecs / 60), s = sessionSecs % 60;
      $("sessionTime").textContent =
        (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    }
  }, 1000);

  function tickClock() {
    var now = new Date();
    // IST = UTC+5:30
    var ist = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60000);
    var h = ist.getHours(), m = ist.getMinutes();
    $("istClock").textContent =
      (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  tickClock();
  setInterval(tickClock, 15000);

  var salutes = parseInt(store.get("salutes", "0"), 10) || 0;
  $("salutCount").textContent = salutes;

  function salute(originEl) {
    salutes++;
    store.set("salutes", salutes);
    $("salutCount").textContent = salutes;
    var btn = $("salutBtn");
    btn.classList.remove("is-pop");
    void btn.offsetWidth;
    btn.classList.add("is-pop");

    var rect = (originEl || btn).getBoundingClientRect();
    var fly = document.createElement("div");
    fly.className = "salute-fly";
    fly.textContent = "🇮🇳";
    fly.style.left = (rect.left + rect.width / 2) + "px";
    fly.style.top = (rect.top - 6) + "px";
    document.body.appendChild(fly);
    setTimeout(function () { fly.remove(); }, 1200);
  }

  /* =======================================================
     Wiring
     ======================================================= */
  playBtn.addEventListener("click", togglePlay);
  $("nextBtn").addEventListener("click", function () { next(false); });
  $("prevBtn").addEventListener("click", prev);
  $("listBtn").addEventListener("click", toggleDrawer);
  $("listBtn2").addEventListener("click", toggleDrawer);
  $("drawerClose").addEventListener("click", closeDrawer);
  scrim.addEventListener("click", closeDrawer);
  $("salutBtn").addEventListener("click", function () { salute(this); });

  $("newQuoteBtn").addEventListener("click", function () { showQuote(false); });

  function manualNextBg() {
    if (!bgQueue.length) { toast("No photos loaded"); return; }
    advanceBg(true);
  }
  $("newBgBtn").addEventListener("click", manualNextBg);
  $("photoNext").addEventListener("click", manualNextBg);

  function reshuffle() {
    if (usePlaylist) {
      try { yt.setShuffle(true); yt.nextVideo(); } catch (e) {}
      toast("Playlist reshuffled");
      return;
    }
    buildOrder();
    renderTracklist();
    load(0, playing);
    toast("Playlist reshuffled");
  }
  $("shuffleBtn").addEventListener("click", reshuffle);
  $("drawerShuffle").addEventListener("click", reshuffle);

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
    if (!$("gate").classList.contains("is-gone")) {
      if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); startSite(); }
      return;
    }

    switch (e.key.toLowerCase()) {
      case " ": break;
      case "n": next(false); break;
      case "p": prev(); break;
      case "q": showQuote(false); break;
      case "b": manualNextBg(); break;
      case "r": reshuffle(); break;
      case "l": toggleDrawer(); break;
      case "s": salute(); break;
      case "m": salute(); toast(dedication ? dedication.salute : "For MJ 🇮🇳"); break;
      case "escape": closeDrawer(); break;
    }
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  });

  // Pause the rotations while the tab is hidden (saves battery/data)
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      clearTimeout(bgTimer);
      clearTimeout(quoteTimer);
      cancelAnimationFrame(quoteRaf);
    } else if ($("gate").classList.contains("is-gone")) {
      restartBgTimer();
      restartQuoteTimer();
      if (playing) {
        requestWakeLock();
        // A phone browser suspends the embed while hidden. If the player was
        // left playing, pick the song back up instead of stranding it paused.
        try {
          if (ready && yt.getPlayerState && yt.getPlayerState() === YT.PlayerState.PAUSED) {
            yt.playVideo();
          }
        } catch (e) {}
      }
    }
  });

  /* =======================================================
     Start
     ======================================================= */
  function startSite() {
    var gate = $("gate");
    if (gate.classList.contains("is-gone")) return;
    gate.classList.add("is-gone");
    document.body.classList.remove("gate-open");
    restartQuoteTimer();
    restartBgTimer();
    // The click is the user gesture browsers require for audio
    if (ready) { try { yt.playVideo(); } catch (e) {} }
    else wantPlay = true;
    setTimeout(function () { toast("जय हिन्द — Jai Hind 🇮🇳"); }, 700);
  }

  /* The player bar's height depends on the viewport: on phones it wraps onto
     two rows, and long track titles or large system fonts change it further.
     Publishing the measured height as --player-h keeps the hero, the photo
     credit and the page's bottom padding correctly clear of it everywhere. */
  function syncPlayerHeight() {
    var el = $("player");
    if (!el) return;
    var h = Math.round(el.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty("--player-h", h + "px");
  }

  function watchPlayerHeight() {
    syncPlayerHeight();
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(syncPlayerHeight).observe($("player"));
    } else {
      window.addEventListener("resize", syncPlayerHeight);
      window.addEventListener("orientationchange", syncPlayerHeight);
    }
  }

  function init() {
    document.body.classList.add("gate-open");

    if (!TRACKS.length && !usePlaylist) {
      plTitle.textContent = "No tracks loaded";
      plCredit.textContent = "assets/data/tracks.js is missing or empty";
    }

    $("gateCount").textContent = usePlaylist ? "Your" : TRACKS.length;
    if (usePlaylist) {
      $("gateCount").parentNode.insertAdjacentHTML("afterbegin", "");
    }

    if (dedication) {
      var sub = document.querySelector(".gate-sub");
      if (sub) {
        sub.textContent = dedication.name + " — " + TRACKS.length + " songs, " +
          BGS.length + " photographs, and one very loud tribute. Press play.";
      }
    }

    buildOrder();
    renderTracklist();
    renderNowPlaying();
    showQuote(true);
    initBackgrounds();
    setPlayingUI(false);
    watchPlayerHeight();
    loadYouTubeAPI();

    $("gateBtn").addEventListener("click", startSite);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
