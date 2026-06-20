// ---------------------------------------------------------------------------
// Firebase setup for online multiplayer (one-time, free).
//
// 1. Go to https://console.firebase.google.com and create a project.
// 2. Build → Realtime Database → Create database (start in *locked* mode; we
//    set proper rules below via database.rules.json).
// 3. Build → Authentication → Sign-in method → enable *Anonymous*.
// 4. Project settings (gear) → "Your apps" → Web app (</>) → register, then
//    copy the config values into the object below (replace the placeholders).
// 5. Publish the rules from database.rules.json (Realtime Database → Rules).
//
// The solo Stopwatch and Guess modes work without any of this — only the
// "Play online" section needs Firebase.
// ---------------------------------------------------------------------------

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  appId: "YOUR_APP_ID",
};

// True once the placeholders above have been replaced with real values.
export const isConfigured =
  !!firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  !!firebaseConfig.databaseURL &&
  firebaseConfig.databaseURL.indexOf("YOUR_PROJECT") === -1;
