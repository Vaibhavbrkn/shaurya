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

  function slug(s) {
    return String(s)
      .toLowerCase()
      .replace(/['\u2018\u2019]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /* Give every track that has a local file in assets/audio/ a .file property.
     Those play through the <audio> element and survive a screen lock; the rest
     stay on the YouTube embed, which does not. Returns how many are covered. */
  function attachLocalAudio() {
    var man = window.SHAURYA_LOCAL_AUDIO || {};
    // Accept the generated {byTrack, extra} shape and a plain hand-written map
    var byTrack = man.byTrack || (man.extra ? {} : man);
    var extra = man.extra || [];
    var n = 0;

    TRACKS.forEach(function (t) {
      var file = byTrack[t.id] || byTrack[slug(t.name)];
      if (file) { t.file = file; n++; }
    });

    extra.forEach(function (e) {
      if (!e || !e.file) return;
      TRACKS.push({
        id: e.id || "",
        name: e.name || e.file.split("/").pop(),
        credit: e.credit || "From your library",
        source: e.source || "",
        duration: e.duration || 0,
        file: e.file,
      });
      n++;
    });

    return n;
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
      volRange = $("volRange"), muteBtn = $("muteBtn"), volWrap = muteBtn.parentNode,
      audioEl = $("audioEl");

  /* =======================================================
     Playback engines

     Both backends expose the same handful of methods so the controls, progress
     bar, keyboard shortcuts and playlist never need to know which is playing.
     `background: true` means the engine keeps going when the phone is locked,
     which is the whole reason the <audio> path exists.
     ======================================================= */
  var localEngine = {
    name: "local",
    background: true,
    load: function (t, autoplay) {
      audioEl.src = t.file;
      audioEl.load();
      if (autoplay) localEngine.play();
      else plState.textContent = "READY";
    },
    play: function () {
      var p = audioEl.play();
      // Rejects when there was no user gesture yet, or the file will not
      // decode. Correct the UI, or the bar keeps claiming ON AIR and the play
      // button needs pressing twice.
      if (p && p.catch) p.catch(function () {
        if (engine === localEngine) setPlayingUI(false);
      });
    },
    pause: function () { audioEl.pause(); },
    seek: function (s) { try { audioEl.currentTime = s; } catch (e) {} },
    time: function () { return audioEl.currentTime || 0; },
    duration: function () {
      return isFinite(audioEl.duration) ? audioEl.duration : 0;
    },
    volume: function (v) {
      audioEl.volume = Math.max(0, Math.min(1, v / 100));
      audioEl.muted = v === 0;
    },
    stop: function () {
      audioEl.pause();
      // Dropping the attribute and reloading releases the stream. Assigning ""
      // instead would resolve to the page URL and fire a bogus error event.
      audioEl.removeAttribute("src");
      audioEl.load();
    },
  };

  var ytEngine = {
    name: "youtube",
    background: false,
    load: function (t, autoplay) {
      // Only ever set the flag, never clear it: cueing a track must not discard
      // a play the user already asked for while the iframe was still loading.
      if (!ready) { if (autoplay) wantPlay = true; return; }
      if (autoplay) yt.loadVideoById(t.id);
      else yt.cueVideoById(t.id);
    },
    play: function () { try { yt.playVideo(); } catch (e) {} },
    pause: function () { try { yt.pauseVideo(); } catch (e) {} },
    seek: function (s) { try { yt.seekTo(s, true); } catch (e) {} },
    time: function () { try { return yt.getCurrentTime() || 0; } catch (e) { return 0; } },
    duration: function () { try { return yt.getDuration() || 0; } catch (e) { return 0; } },
    volume: function (v) {
      try { yt.setVolume(v); if (v === 0) yt.mute(); else yt.unMute(); } catch (e) {}
    },
    stop: function () { try { yt.pauseVideo(); } catch (e) {} },
  };

  var engine = ytEngine;
  var localCount = 0;

  function engineFor(t) { return t && t.file ? localEngine : ytEngine; }

  /* iOS only lets an <audio> element begin playing from inside a user gesture,
     and counts the element as unlocked once it has. When the opening track is a
     YouTube one, the element would still be locked by the time a local track
     came round mid-session, and that play() would be refused. So spend the
     opening click on a millisecond of silence to unlock it. */
  var SILENCE = "data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+" +
                "AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA";
  var audioPrimed = false;

  function primeAudio() {
    if (audioPrimed || engine === localEngine) return;
    audioPrimed = true;
    try {
      audioEl.src = SILENCE;
      var p = audioEl.play();
      if (p && p.then) p.then(function () {
        // A real track may have taken the element over by the time this settles
        if (audioEl.src === SILENCE) audioEl.pause();
      }, function () {});
    } catch (e) {}
  }

  // Local-only tracks have no YouTube id, so fall back to the file path
  function trackKey(t) { return t ? (t.id || t.file || "") : ""; }

  /* ---------- <audio> events, mirroring the YouTube state handlers ---------- */
  audioEl.addEventListener("playing", function () {
    if (engine !== localEngine) return;
    setPlayingUI(true);
    renderNowPlaying();
  });
  audioEl.addEventListener("pause", function () {
    if (engine === localEngine) setPlayingUI(false);
  });
  audioEl.addEventListener("waiting", function () {
    if (engine === localEngine) plState.textContent = "LOADING";
  });
  audioEl.addEventListener("ended", function () {
    if (engine === localEngine) next(true);
  });
  audioEl.addEventListener("error", function () {
    var src = audioEl.getAttribute("src");
    if (engine !== localEngine || !src) return;
    var t = currentTrack();
    // The event is queued, so it can arrive after the user has moved on
    if (!t || src !== t.file) return;

    if (t.id) {
      // A local file is an upgrade on the YouTube stream, so a broken one
      // should demote the track rather than remove it from the playlist.
      delete t.file;
      if (localCount > 0) localCount--;
      toast("Local file missing — streaming that one instead");
      renderTracklist();
      load(cur, true);
      return;
    }

    // Nothing to fall back to: the track exists only as a file
    deadIds[trackKey(t)] = true;
    toast("Skipped a missing audio file");
    renderTracklist();
    next(true);
  });

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
    // Local-only tracks have no video to open
    var link = $("ytLink");
    link.hidden = !(t && t.id);
    if (t && t.id) link.href = "https://www.youtube.com/watch?v=" + t.id;
    highlightTrack();
  }

  /* A fallback for YouTube tracks only.

     Those cannot play with the screen off — phone browsers suspend media in a
     cross-origin iframe and YouTube gates background play behind Premium — so
     the next best thing is to stop the phone sleeping on its own while one is
     playing. Local files need none of this and are better off without it: no
     lock means the screen can go dark while the music keeps going.

     The browser drops the lock whenever the page is hidden, so it has to be
     re-requested when the page comes back. */
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

  /* =======================================================
     Media Session — lock-screen title, artwork and controls
     ======================================================= */
  var mediaSessionWired = false;

  function wireMediaSession() {
    if (mediaSessionWired || !("mediaSession" in navigator)) return;
    mediaSessionWired = true;

    var handlers = {
      play: function () { engine.play(); },
      pause: function () { engine.pause(); },
      stop: function () { engine.pause(); },
      previoustrack: prev,
      nexttrack: function () { next(false); },
      seekbackward: function (d) {
        engine.seek(Math.max(0, engine.time() - ((d && d.seekOffset) || 10)));
      },
      seekforward: function (d) {
        engine.seek(Math.min(engine.duration(), engine.time() + ((d && d.seekOffset) || 10)));
      },
      seekto: function (d) {
        if (d && d.seekTime != null) engine.seek(d.seekTime);
      },
    };

    Object.keys(handlers).forEach(function (action) {
      // Browsers reject actions they do not implement; skip those quietly
      try { navigator.mediaSession.setActionHandler(action, handlers[action]); }
      catch (e) {}
    });
  }

  function publishMetadata() {
    if (!("mediaSession" in navigator) || typeof window.MediaMetadata !== "function") return;
    var t = currentTrack();
    if (!t) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: t.name,
        artist: t.credit || "Indian Armed Forces Radio",
        album: "शौर्य Shaurya",
        artwork: [{
          src: new URL("assets/art/cover.jpg", location.href).href,
          sizes: "512x512",
          type: "image/jpeg",
        }],
      });
    } catch (e) {}
  }

  var lastPositionPush = 0;

  function publishPosition(c, d) {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!(d > 0) || !(c >= 0) || c > d) return;
    // The poll runs four times a second; the lock-screen scrubber needs one
    var now = Date.now();
    if (now - lastPositionPush < 1000) return;
    lastPositionPush = now;
    try {
      navigator.mediaSession.setPositionState({ duration: d, position: c, playbackRate: 1 });
    } catch (e) {}
  }

  function setPlayingUI(on) {
    playing = on;
    playBtn.classList.toggle("is-playing", on);
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    plEq.classList.toggle("is-on", on);
    plDisc.classList.toggle("is-spinning", on);
    plState.textContent = on ? "ON AIR" : "PAUSED";
    if (on && !engine.background) requestWakeLock(); else releaseWakeLock();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = on ? "playing" : "paused";
    }
  }

  function load(index, autoplay) {
    if (usePlaylist) return;
    cur = (index + order.length) % order.length;
    var t = currentTrack();
    if (!t) return;

    // Silence the outgoing backend before handing over, or both would play.
    // Switch first: stopping fires events whose handlers check which engine is
    // current, and they must not mistake the handover for a real pause.
    var target = engineFor(t);
    var previous = engine;
    engine = target;
    if (previous !== target) previous.stop();

    renderNowPlaying();
    publishMetadata();
    engine.volume(parseInt(volRange.value, 10));
    engine.load(t, autoplay);
  }

  /* Every candidate is marked unplayable. Stop rather than loading one anyway:
     a missing audio folder fails in milliseconds, so skipping onwards would
     spin through the playlist in a tight loop. */
  function stall() {
    engine.stop();
    setPlayingUI(false);
    plState.textContent = "NO SOURCE";
    toast("Nothing in the playlist can be played right now");
  }

  // Walk to the next track that is not known to be unplayable
  function step(dir) {
    for (var hops = 0; hops < order.length; hops++) {
      cur = (cur + dir + order.length) % order.length;
      var t = TRACKS[order[cur]];
      if (t && !deadIds[trackKey(t)]) return true;
    }
    return false;
  }

  function next(auto) {
    if (usePlaylist) { try { yt.nextVideo(); } catch (e) {} return; }
    if (!step(1)) { stall(); return; }
    load(cur, true);
    if (!auto) toast("Next: " + (currentTrack() ? currentTrack().name : ""));
  }

  function prev() {
    if (usePlaylist) { try { yt.previousVideo(); } catch (e) {} return; }
    if (engine.time() > 4) { engine.seek(0); return; }
    if (!step(-1)) { stall(); return; }
    load(cur, true);
  }

  function togglePlay() {
    // Only the iframe has a readiness handshake; <audio> is usable immediately
    if (engine === ytEngine && !ready) { wantPlay = true; return; }
    if (playing) engine.pause(); else engine.play();
  }

  function poll() {
    if (seeking) return;
    if (engine === ytEngine && !ready) return;
    var d = engine.duration(), c = engine.time();
    if (d > 0) {
      var pct = Math.max(0, Math.min(100, (c / d) * 100));
      fill.style.width = pct + "%";
      knob.style.left = pct + "%";
      progressWrap.setAttribute("aria-valuenow", Math.round(pct));
    }
    tCur.textContent = fmtTime(c);
    tDur.textContent = fmtTime(d);
    publishPosition(c, d);
  }

  // ---------- Seek ----------
  function canSeek() { return engine !== ytEngine || ready; }

  function seekFromEvent(e) {
    var rect = progressWrap.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    var ratio = Math.max(0, Math.min(1, x / rect.width));
    var d = engine.duration();
    if (d > 0) {
      engine.seek(d * ratio);
      fill.style.width = (ratio * 100) + "%";
      knob.style.left = (ratio * 100) + "%";
    }
  }

  progressWrap.addEventListener("pointerdown", function (e) {
    if (!canSeek()) return;
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
    if (!canSeek()) return;
    var d = engine.duration(), c = engine.time();
    if (e.key === "ArrowRight") { engine.seek(Math.min(d, c + 5)); e.preventDefault(); }
    if (e.key === "ArrowLeft") { engine.seek(Math.max(0, c - 5)); e.preventDefault(); }
  });

  // ---------- Volume ----------
  var savedVol = parseInt(store.get("vol", CONFIG.defaultVolume), 10);
  if (isNaN(savedVol)) savedVol = CONFIG.defaultVolume;
  volRange.value = savedVol;

  function applyVolume(v, remember) {
    // Set both backends so a handover never jumps in loudness
    localEngine.volume(v);
    ytEngine.volume(v);
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
    $("drawerNote").textContent = localCount
      ? localCount + " of " + TRACKS.length + " tracks play from this site and keep " +
        "going with the screen locked. The rest stream from YouTube, which stops " +
        "when you leave the page."
      : "Shuffled fresh on every visit. Audio streams from YouTube; nothing is hosted here.";
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
        (t.file ? '<span class="tl-badge" title="Plays with the screen off">BG</span>' : '') +
        '<span class="tl-dur"></span>';
      b.querySelector(".tl-name").textContent = t.name;
      b.querySelector(".tl-credit").textContent = t.credit || "";
      b.querySelector(".tl-dur").textContent = t.duration ? fmtTime(t.duration) : "";
      if (deadIds[trackKey(t)]) b.classList.add("is-dead");
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
      // Nothing to cue when the opening track is a local file
      var first = currentTrack();
      if (first && !first.file) opts.videoId = first.id;
    }

    yt = new YT.Player("ytFrame", opts);
  };

  function onPlayerReady() {
    ready = true;
    applyVolume(parseInt(volRange.value, 10), false);
    if (usePlaylist) {
      try { yt.setShuffle(true); } catch (e) {}
    }
    if (wantPlay) {
      wantPlay = false;
      // The iframe can arrive long after the click. If a local track took over
      // in the meantime, leave it alone instead of restarting it from zero.
      if (usePlaylist) { try { yt.playVideo(); } catch (e) {} }
      else if (engine === ytEngine) load(cur, true);
    }
    renderNowPlaying();
  }

  function onPlayerState(e) {
    if (engine !== ytEngine) return;
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
    if (engine !== ytEngine) return;
    var t = currentTrack();
    if (t) {
      deadIds[trackKey(t)] = true;
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
      case "j": salute(); toast(dedication ? dedication.salute : "For MJ 🇮🇳"); break;
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
      // Only the iframe gets suspended while hidden; a local file never stopped,
      // so this repair is for YouTube tracks alone.
      if (playing && engine === ytEngine) {
        requestWakeLock();
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
    // The click is the user gesture browsers require for audio, and the only
    // moment iOS will accept registering the lock-screen controls.
    wireMediaSession();
    primeAudio();
    if (usePlaylist) {
      if (ready) engine.play(); else wantPlay = true;
    } else {
      load(cur, true);
    }
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

    // Playlist mode ignores the curated list, so local files have nothing to
    // attach to and their extras would be unreachable
    localCount = usePlaylist ? 0 : attachLocalAudio();

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
    engine = engineFor(currentTrack());
    renderTracklist();
    renderNowPlaying();
    showQuote(true);
    initBackgrounds();
    setPlayingUI(false);
    watchPlayerHeight();

    // Drives the progress bar for whichever engine is playing, so it cannot
    // depend on the YouTube handshake the way it used to.
    clearInterval(pollTimer);
    pollTimer = setInterval(poll, 250);

    applyVolume(parseInt(volRange.value, 10), false);
    if (!usePlaylist) load(cur, false);
    loadYouTubeAPI();

    $("gateBtn").addEventListener("click", startSite);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
