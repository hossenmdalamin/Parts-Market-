# Parts Market Android release signing

This guide creates the long-lived release keystore on your own device and stores its values as GitHub Actions repository secrets.

## Important security rules

- Keep `parts-market-release.jks` private. Never commit it, upload it to a public location, or send it in chat.
- Back up the JKS file in at least two secure places. The same key must be reused for future updates to this app.
- Keep the keystore password and key password private. Do not put them in source code, workflow files, or shell command arguments.
- A signature confirms the APK's publisher identity; it does not guarantee that Play Protect will never warn about the app.
- Pull Request builds are intentionally unsigned. Signing secrets are provided only to builds on `main` or manually dispatched workflows.

## Option A: create the key on Android with Termux

1. Install Termux from its official source: https://termux.dev/
2. Open Termux and run:

```sh
pkg update
pkg install openjdk-21 coreutils
```

3. Generate the keystore. The command will prompt you to enter passwords; type them privately when prompted. Do not append passwords to the command.

```sh
keytool -genkeypair -v -keystore parts-market-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias parts-market-release
```

Choose strong passwords and keep them in a password manager. When asked for the key password, you may use a different strong password from the keystore password. The key alias is exactly `parts-market-release`.

4. Confirm the key exists:

```sh
keytool -list -v -keystore parts-market-release.jks -alias parts-market-release
```

5. Make a one-line Base64 copy for GitHub:

```sh
base64 -w 0 parts-market-release.jks > parts-market-release.jks.base64
```

Open the local text file `parts-market-release.jks.base64` and copy its full single-line contents. Treat this encoded value as sensitive; it contains the private keystore.

6. Back up `parts-market-release.jks` securely in two places before deleting temporary copies. Do not delete the only copy.

## Add four GitHub repository secrets

Open the repository's Actions secrets page:

https://github.com/hossenmdalamin/Parts-Market-/settings/secrets/actions

For each item, choose **New repository secret**, enter the exact name, paste its value, and save:

| Secret name | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Full one-line contents of `parts-market-release.jks.base64` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password entered during key generation |
| `ANDROID_KEY_ALIAS` | `parts-market-release` |
| `ANDROID_KEY_PASSWORD` | Password for the key alias |

Never share these values with anyone. Do not add them to a GitHub Issue, Pull Request comment, or repository file.

After all four secrets are saved, open **Actions → Android APK Build → Run workflow**. Until Pull Request #26 is merged, select the `feature/android-release-build-signing` branch in the branch dropdown; after it is merged, select `main`. The run should upload `parts-market-release-signed` and verify the APK signature. A build triggered by a Pull Request is deliberately unsigned.

## If you already created a release key

Do not create a second one. Use the same existing JKS file, alias, and passwords. Replacing the signing key later can prevent Android from accepting an update over an already installed copy of the app.
