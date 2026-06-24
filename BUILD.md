# Building & running

This covers running the app in development and producing an installable **Android APK**.
For the product spec see [PLAN.md](PLAN.md); for the tech stack and code layout see
[CLAUDE.md](CLAUDE.md).

> **`npm`/`npx` gotcha.** If a global `~/.npmrc` sets `workspaces=true`, `npm`/`npx` break in
> this non-workspace repo (ENOENT for a missing root `package.json`). If a command fails that
> way, prefix it: `npm_config_workspaces=false npx expo ...` — or in PowerShell:
> `$env:npm_config_workspaces='false'; npx expo ...`

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | LTS (18+) | for npm / Expo CLI |
| **JDK 17** | 17.x | **required for the Android build** — see warning below |
| Android SDK | platform 35 + build-tools 37 | via Android Studio; `ANDROID_HOME` must be set |

Set `ANDROID_HOME` to your Android SDK location and `JAVA_HOME` (or the Gradle property below)
to a JDK 17 install. Examples below use `$JAVA_HOME` / `$ANDROID_HOME` — substitute your own
paths.

## Development (no native build)

```sh
npm install            # install dependencies
npx expo start         # Metro dev server — open in Expo Go or a simulator
npm test               # unit tests (grades + stats)
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint
```

`npx expo export --platform android --output-dir dist-check` does a JS-bundle sanity check
without a device.

## Running on an Android emulator

The app uses custom native modules, so **Expo Go won't run it** — use a debug native build
(`expo run:android`), which builds, installs, and launches on a running emulator and starts
Metro for fast refresh. The same **JDK 17 requirement** as the APK build applies (see below).

```sh
# 1. List your Android Virtual Devices (AVDs) — create them in Android Studio › Device Manager
"$ANDROID_HOME/emulator/emulator" -list-avds

# 2. Boot one (leave it running in its own terminal); use a name from step 1
"$ANDROID_HOME/emulator/emulator" -avd <avd-name>

# 3. Confirm it's connected
"$ANDROID_HOME/platform-tools/adb" devices        # -> emulator-5554  device

# 4. Build + install + launch on it (JDK 17 — see the APK section for why)
JAVA_HOME=<path-to-jdk-17> npx expo run:android
```

`expo run:android` auto-selects the running emulator; pass `--device` to choose interactively
when several are connected. PowerShell equivalents:
`& "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds`,
`& "$env:ANDROID_HOME\emulator\emulator.exe" -avd <avd-name>`, then
`$env:JAVA_HOME='<path-to-jdk-17>'; npx expo run:android`.

The first build takes several minutes; afterwards `npx expo start` (press `a`) reuses the
installed dev build and only re-bundles JS. On Windows the emulator binary must be invoked from
its own directory or with a full path (it resolves DLLs relative to itself).

## Building an Android APK

The `android/` (and `ios/`) native folders are **generated and gitignored**. They are created
by `expo prebuild` and are not committed — anything edited inside them (see the JDK note below)
is lost on a clean prebuild.

### 1. Generate the native project (if `android/` is missing)

```sh
npx expo prebuild --platform android
```

### 2. ⚠️ Make a JDK 17 available to Gradle

React Native 0.85 + Expo configure a **Java 17 toolchain** (`kotlin jvmToolchain(17)`). If
Gradle's active JVM is **not** JDK 17 (e.g. `JAVA_HOME` points at JDK 23), Gradle tries to
auto-download a JDK 17 via the **foojay** resolver — which is **incompatible with this
project's Gradle 9.3.1** (it references the removed `JvmVendorSpec.IBM_SEMERU`) and crashes
during configuration:

```
NoSuchFieldError: ... JvmVendorSpec ... 'IBM_SEMERU'
Could not initialize class org.gradle.toolchains.foojay.DistributionsKt
```

The fix is to give Gradle a local JDK 17 and stop it from auto-downloading. **Two options:**

**A. Per-build** — point `JAVA_HOME` at JDK 17 just for the build:

```sh
# Git Bash
JAVA_HOME=<path-to-jdk-17> ./gradlew -p android assembleRelease
```
```powershell
# PowerShell
$env:JAVA_HOME='<path-to-jdk-17>'; .\android\gradlew.bat -p android assembleRelease
```

**B. Persistent** — register the JDK and disable auto-download. Put this in
`~/.gradle/gradle.properties` (survives `expo prebuild --clean`) **or** in
`android/gradle.properties` (convenient, but wiped by a clean prebuild — re-add it after).
Use your own JDK 17 path; backslashes must be escaped in `.properties` files:

```properties
org.gradle.java.installations.paths=C:\\path\\to\\jdk-17
org.gradle.java.installations.auto-download=false
```

### 3. Build

```sh
cd android
./gradlew assembleRelease      # or: ./gradlew assembleDebug
```

A clean build takes ~15 min; incremental builds are much faster.

### Output

```
android/app/build/outputs/apk/release/app-release.apk
```

The release APK is **debug-signed** (`build.gradle` uses the debug keystore for `release`),
so it **installs via sideloading** but is **not** suitable for the Play Store. For a publishable
build you must generate your own keystore and configure release signing — see
<https://reactnative.dev/docs/signed-apk-android>.

## Installing on a phone

1. Copy the `.apk` to the phone — send it **as a file/document** (messaging "media" pickers can
   recompress or block APKs); Google Drive or a USB copy also work.
2. On the phone, allow **"Install from unknown sources"** for the app that opens the file.
3. Tap the APK → Install.

### APK size

`assembleRelease` produces a "fat" APK with **all four CPU architectures**
(`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`), ~113 MB. A real phone uses only one (almost
always `arm64-v8a`). To shrink:

- **arm64 only** (~35–45 MB, recommended for sideloading to a modern phone):
  ```sh
  ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
  ```
- The remaining ~20–25 MB is the React Native + Hermes runtime floor and is unavoidable.
