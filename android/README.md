# Parts Market Android App

This is the native Android shell for https://parts-market.pages.dev/.

## Build
Open this `android/` directory in Android Studio (Hedgehog or newer), using JDK 17 and Android SDK 35. Build the debug APK with **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

## Current foundation
- Kotlin Android application, package `com.partsmarket.app`
- HTTPS WebView loading the live Parts Market website
- Back navigation and external-link handoff
- Local theme preference bridge (system/light/dark)
- Android notification permission declared

## Important integration work still required
The website must consume `window.PartsMarketApp.getTheme()` and apply `data-app-theme` to all page styles before the theme selector affects the full website. Firebase project configuration, FCM token registration and secure server-side event delivery are not configured yet. Do not ship a release until push notifications, admin authorization, biometric/PIN lock, deep links, backup policies, and release signing are implemented and tested.

Never commit Firebase service credentials, signing keys, passwords, or Supabase service-role keys.
