// ===========================================================================
// AdMob interstitial ads — shown after a game ends, with a frequency cap.
// No-op in a browser; active inside the native iOS/Android app.
// Uses Google's TEST ad units until the real AdMob ad-unit IDs are filled in.
// ===========================================================================
(function () {
  "use strict";

  // Google's public TEST interstitial ad units (always safe, show test ads).
  var TEST = {
    ios: "ca-app-pub-3940256099942544/4411468910",
    android: "ca-app-pub-3940256099942544/1033173712",
  };
  // ⬇️ Paste your REAL AdMob interstitial ad-unit IDs here once the AdMob
  // account is set up. Leaving them blank keeps test ads running.
  var REAL = {
    ios: "",
    android: "",
  };

  var Cap = window.Capacitor;
  var AdMob = (Cap && Cap.Plugins && Cap.Plugins.AdMob) ? Cap.Plugins.AdMob : null;
  var platform = (Cap && Cap.getPlatform) ? Cap.getPlatform() : "web";

  var ready = false;
  var lastShown = 0;
  var MIN_GAP_MS = 75 * 1000; // at most one interstitial per ~75 seconds

  function adId() {
    var real = REAL[platform];
    return (real && real.length) ? real : TEST[platform];
  }

  function prepare() {
    if (!AdMob) return;
    try { AdMob.prepareInterstitial({ adId: adId() }).catch(function () {}); }
    catch (e) { /* ignore */ }
  }

  function setupListeners() {
    if (!AdMob || !AdMob.addListener) return;
    // Readiness is reported via events, not the prepare() promise.
    AdMob.addListener("interstitialAdLoaded", function () { ready = true; });
    AdMob.addListener("interstitialAdFailedToLoad", function () {
      ready = false;
      setTimeout(prepare, 30000); // retry later
    });
    AdMob.addListener("interstitialAdDismissed", function () {
      ready = false;
      prepare(); // preload the next one as soon as this closes
    });
  }

  function init() {
    if (!AdMob || platform === "web") return;
    setupListeners();
    try {
      AdMob.initialize({ initializeForTesting: true })
        .then(function () {
          prepare(); // start loading the first interstitial immediately
          // iOS App Tracking Transparency prompt — fire-and-forget, never blocks ads.
          if (platform === "ios" && AdMob.requestTrackingAuthorization) {
            AdMob.requestTrackingAuthorization().catch(function () {});
          }
        })
        .catch(function () { /* ignore */ });
    } catch (e) { /* ignore */ }
  }

  // Show an interstitial if one is loaded and the frequency cap has elapsed.
  function showInterstitial() {
    if (!AdMob || platform === "web" || !ready) return;
    var now = Date.now();
    if (now - lastShown < MIN_GAP_MS) return;
    lastShown = now;
    ready = false;
    try { AdMob.showInterstitial().catch(function () {}); } catch (e) { /* ignore */ }
    // The next preload is triggered by the "interstitialAdDismissed" listener.
  }

  window.Ads = { init: init, showInterstitial: showInterstitial };

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
