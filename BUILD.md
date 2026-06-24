# Building & running

This covers running the app in development and producing an installable **Android APK**.
For the product spec see [PLAN.md](PLAN.md); for the tech stack and code layout see
[CLAUDE.md](CLAUDE.md).

> **`npm`/`npx` gotcha (this machine).** The user's global `~/.npmrc` sets `workspaces=true`,
> which breaks `npm`/`npx` in this non-workspace repo (ENOENT for a missing root
> `package.json`). If a command fails that way, prefix it:
> `npm_config_workspaces=false npx expo ...` — or in PowerShell:
> `$env:npm_config_workspaces='false'; npx expo ...`

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | LTS (18+) | for npm / Expo CLI |
| **JDK 17** | 17.x | **required for the Android build** — see warning below |
| Android SDK | platform 35 + build-tools 37 | via Android Studio; `ANDROID_HOME` must be set |

On the current dev machine: Android SDK at `C:\Users\petru\AppData\Local\Android\Sdk`,
JDK 17 at `C:\devel\_jdk17\jdk-17.0.19+10`.

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
JAVA_HOME=/c/devel/_jdk17/jdk-17.0.19+10 ./gradlew -p android assembleRelease
```
```powershell
# PowerShell
$env:JAVA_HOME='C:\devel\_jdk17\jdk-17.0.19+10'; .\android\gradlew.bat -p android assembleRelease
```

**B. Persistent** — register the JDK and disable auto-download. Put this in
`~/.gradle/gradle.properties` (survives `expo prebuild --clean`) **or** in
`android/gradle.properties` (convenient, but wiped by a clean prebuild — re-add it after):

```properties
org.gradle.java.installations.paths=C:\\devel\\_jdk17\\jdk-17.0.19+10
org.gradle.java.installations.auto-download=false
```

Adjust the path to wherever your JDK 17 lives.

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
