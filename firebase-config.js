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
  apiKey: "AIzaSyBhYJqq5Wln3X6qiKJscPwWoxDyAwy2SOQ",
  authDomain: "stopwatch-65e73.firebaseapp.com",
  databaseURL: "https://stopwatch-65e73-default-rtdb.firebaseio.com",
  projectId: "stopwatch-65e73",
  storageBucket: "stopwatch-65e73.firebasestorage.app",
  messagingSenderId: "1012833640428",
  appId: "1:1012833640428:web:0c2e0c696120babeefeac9",
  measurementId: "G-N9E79H3XFJ",
};

// True once the placeholders above have been replaced with real values.
export const isConfigured =
  !!firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  !!firebaseConfig.databaseURL &&
  firebaseConfig.databaseURL.indexOf("YOUR_PROJECT") === -1;
