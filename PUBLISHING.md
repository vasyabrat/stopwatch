# Publishing Stopwatch Games to the App Store & Google Play

This project is a web app wrapped with [Capacitor](https://capacitorjs.com), which
produces **real native iOS and Android apps** from the exact same code (same games,
same Firebase, same parameters). You build them once and submit to each store.

> The web app stays the single source of truth at the repo root. `npm run build:www`
> copies it into `www/`, and Capacitor bundles `www/` into the native apps.

---

## 0. One-time prerequisites

### Both platforms
- **Node.js** (already installed) and this repo.

### iOS (requires a Mac — you have one)
- **Xcode** — install from the Mac App Store (large, ~7 GB). Then run once:
  ```bash
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  sudo xcodebuild -license accept
  ```
- **CocoaPods**:
  ```bash
  brew install cocoapods        # or: sudo gem install cocoapods
  ```
- **Apple Developer Program** — **$99/year**, sign up at
  https://developer.apple.com/programs/ (approval can take a day or two).

### Android
- **Android Studio** — https://developer.android.com/studio (bundles the JDK + SDK).
  Open it once and let it finish "SDK Components Setup".
- **Google Play Console** account — **$25 one-time**, https://play.google.com/console/signup.

---

## 1. Install & generate the native projects (run once)

From the project folder:

```bash
npm install                       # installs Capacitor
npm run build:www                 # copies the web app into www/
npx cap add ios                   # creates the ios/ Xcode project
npx cap add android               # creates the android/ Android Studio project
npx capacitor-assets generate --assetPath assets \
  --iconBackgroundColor '#05070b' --splashBackgroundColor '#05070b'   # icons + splash from assets/logo.svg
npx cap sync                      # copies web + plugins into both native projects
```

After **any** change to the web code, re-run:

```bash
npm run sync                      # = build:www + cap sync
```

The app id is **`com.vasyabrat.stopwatchgames`** and the name is **Stopwatch Games**
(set in `capacitor.config.json` — change them before your first submission if you want;
the id can never be changed after a store release).

---

## 2. Publish to the Apple App Store

1. **Open the iOS project:**
   ```bash
   npm run ios          # builds www, syncs, opens Xcode
   ```
2. **Signing:** in Xcode, select the **App** target → **Signing & Capabilities** →
   check **Automatically manage signing** → choose your **Team** (your Apple Developer
   account). Confirm the **Bundle Identifier** is `com.vasyabrat.stopwatchgames`.
3. **Version:** set **Version** (e.g. `1.0.0`) and **Build** (`1`) under **General**.
4. **Create the app record** at https://appstoreconnect.apple.com → **My Apps → + → New App**:
   - Platform: iOS · Name: *Stopwatch Games* · Primary language · Bundle ID (pick the one
     you registered) · SKU: any unique string (e.g. `stopwatch-games-1`).
5. **Archive & upload:** in Xcode, set the run destination to **Any iOS Device (arm64)**
   → menu **Product → Archive** → when it finishes, **Distribute App → App Store Connect
   → Upload**. Wait for it to appear in App Store Connect (a few minutes, "Processing").
6. **Fill the listing** in App Store Connect:
   - **Screenshots** (required): 6.7" iPhone (1290×2796) and 6.5" iPhone at minimum.
     Take them in the iOS Simulator (`Cmd+S` saves a screenshot).
   - **Description, keywords, support URL, marketing URL** (your Vercel URL works).
   - **App Privacy:** you collect **player name** + gameplay data via Firebase. Declare:
     *Data linked to user* → "User Content" / "Identifiers" as appropriate, used for **App
     Functionality**, not for tracking. (Be honest — names are typed by users.)
   - **Age rating** questionnaire (this is a casual game; no objectionable content).
   - **Sign-in:** none required from Apple's side (you use anonymous Firebase auth).
7. **Select the build** you uploaded, then **Add for Review → Submit**.
   Review typically takes ~24–48 hours.

### ⚠️ Apple gotchas to know up front
- **Guideline 4.2 (minimum functionality):** Apple sometimes rejects apps that feel like
  "just a website." Your multiplayer games are genuinely interactive, which helps. To
  strengthen it, consider adding a small native touch (e.g. Capacitor **Haptics** buzzing
  on start/stop) — see "Optional native polish" below.
- **Guideline 2.5.2 (no remote code):** the app loads the Firebase SDK from Google's CDN at
  runtime. This is a standard library and generally fine, but if review pushes back, bundle
  Firebase locally instead of importing from `gstatic.com` (ask and I'll wire it up).

---

## 3. Publish to Google Play

1. **Open the Android project:**
   ```bash
   npm run android      # builds www, syncs, opens Android Studio
   ```
2. **Create an upload key** (one-time — keep this file + passwords forever; losing it means
   you can't update the app):
   ```bash
   keytool -genkey -v -keystore stopwatch-upload.keystore \
     -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   Store `stopwatch-upload.keystore` somewhere safe **outside** the repo.
3. **Build a signed release bundle:** in Android Studio → **Build → Generate Signed App
   Bundle / APK → Android App Bundle (.aab)** → select your keystore → **release** variant.
   The `.aab` lands in `android/app/release/`.
   - Set **applicationId** = `com.vasyabrat.stopwatchgames`, **versionCode** `1`,
     **versionName** `1.0.0` in `android/app/build.gradle` if you want to adjust them.
4. **Create the app** at https://play.google.com/console → **Create app**: name, language,
   "App", "Free".
5. **Complete the required declarations** (Play won't let you publish until these are green):
   - **Privacy policy URL** (required) — you'll need a hosted privacy policy page. I can
     generate one you can drop on Vercel.
   - **Data safety** form — declare you collect the typed **name** + gameplay state via
     Firebase; not shared with third parties for ads; not used for tracking.
   - **Content rating** questionnaire, **Target audience**, **Ads = No**.
6. **Upload the `.aab`:** **Testing → Internal testing** first (fastest, add your own email
   as a tester) to verify it installs and runs. Then promote to **Production → Create
   release**, upload the `.aab`, add release notes, **Review → Roll out**.
   First review can take a few hours up to a couple of days.

---

## 4. Shipping updates later

1. Make your web changes (and `git push` for the Vercel site as usual).
2. Bump the version:
   - iOS: **Build** number in Xcode (and Version for user-facing changes).
   - Android: **versionCode** (+1) and **versionName** in `android/app/build.gradle`.
3. `npm run sync`, then re-archive (iOS) / re-build the signed `.aab` (Android) and upload
   a new release to each store.

---

## Optional native polish (recommended for App Store acceptance)

Add real device haptics so start/stop *buzz* — a genuine native feature:

```bash
npm install @capacitor/haptics
npx cap sync
```

Then I can wire `Haptics.impact()` into the start/stop handlers. Tell me if you want this —
it improves the game feel and helps clear Apple's "minimum functionality" bar.

---

## Quick reference

| Task | Command |
|------|---------|
| Rebuild web → native | `npm run sync` |
| Open Xcode | `npm run ios` |
| Open Android Studio | `npm run android` |
| Regenerate icons/splash | `npx capacitor-assets generate --assetPath assets` |

Stuck on any step? Tell me where and I'll get specific.
