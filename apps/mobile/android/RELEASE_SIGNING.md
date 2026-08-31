# Android release signing

No release keystore exists yet. `./gradlew assembleRelease` and
`bundleRelease` will refuse to run until one is configured — see
`checkReleaseSigningConfigured` in `app/build.gradle`. Nothing on this page
is committed anywhere in this repo; it only documents the mechanism already
wired into the build.

## 1. Generate a keystore (do this yourself, once)

```bash
keytool -genkeypair -v -keystore facto-release.jks -alias facto -keyalg RSA -keysize 2048 -validity 10000
```

Store the resulting `.jks` file and its passwords somewhere durable and
private (a password manager, a secrets vault) — **losing this keystore
means you can never publish an update to an app already live on Google Play
under this package name.** There is no recovery path.

## 2. Local builds: `keystore.properties`

Copy `keystore.properties.example` (this directory) to `keystore.properties`
— already gitignored — and fill in the real values:

```properties
storeFile=/absolute/path/to/facto-release.jks
storePassword=...
keyAlias=facto
keyPassword=...
```

## 3. CI: environment variables (no file needed)

```
FACTO_ANDROID_KEYSTORE_PATH
FACTO_ANDROID_KEYSTORE_PASSWORD
FACTO_ANDROID_KEY_ALIAS
FACTO_ANDROID_KEY_PASSWORD
```

Environment variables take priority over `keystore.properties` when both are
present, so a CI runner never needs the properties file at all.

## What's still missing right now

Nobody has generated a keystore yet, so step 1 above hasn't happened. Until
it does, both `assembleRelease` and `bundleRelease` will fail immediately
with a clear message — that's `checkReleaseSigningConfigured` doing its job,
not a bug.
