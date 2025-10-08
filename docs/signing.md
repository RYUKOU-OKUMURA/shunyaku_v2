# Code Signing Guide for Shunyaku v2

作成日: 2025-09-30  
対象: macOS版Shunyaku v2 Electronアプリのコード署名・配布準備  
バージョン: 1.0.0

---

## 📋 目次

1. [概要](#1-概要)
2. [前提条件](#2-前提条件)
3. [証明書セットアップ](#3-証明書セットアップ)
4. [コード署名手順](#4-コード署名手順)
5. [公証（Notarization）](#5-公証notarization)
6. [配布パッケージ作成](#6-配布パッケージ作成)
7. [自動化](#7-自動化)
8. [トラブルシューティング](#8-トラブルシューティング)

---

## 1. 概要

### 1.1 目的
Shunyaku v2 ElectronアプリをmacOSで安全に配布するため、Apple Developer証明書を使用したコード署名と公証を実施します。

### 1.2 署名が必要な理由
- **Gatekeeper**: macOS Catalinaから、署名されていないアプリは実行が困難
- **ユーザー信頼**: 署名により開発者の身元が保証される
- **セキュリティ**: 改ざん検出とマルウェア対策

### 1.3 プロセス概要
```
開発 → ビルド → 署名 → 公証 → ステープリング → 配布
```

---

## 2. 前提条件

### 2.1 必要なアカウント・証明書
- [x] Apple Developer Program登録（年間$99）
- [x] Developer ID Application証明書
- [x] Developer ID Installer証明書（.pkg配布の場合）
- [x] macOS開発環境（Xcode Command Line Tools）

### 2.2 必要なツール
```bash
# Xcode Command Line Toolsインストール確認
xcode-select --install

# 必要なツール一覧
which codesign     # コード署名
which xcrun        # 公証ツール
which hdiutil      # DMG作成
which productbuild # PKG作成（必要に応じて）
```

### 2.3 環境変数設定
```bash
# ~/.zshrc または ~/.bash_profile に追加
export APPLE_ID="your-apple-id@example.com"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
export DEVELOPER_ID_APPLICATION="Developer ID Application: Your Name (TEAM_ID)"
export DEVELOPER_ID_INSTALLER="Developer ID Installer: Your Name (TEAM_ID)"
```

---

## 3. 証明書セットアップ

### 3.1 証明書確認
```bash
# 証明書確認スクリプト実行
./scripts/check-certificates.sh

# 手動確認
security find-identity -v -p codesigning
```

### 3.2 証明書取得（未取得の場合）

#### ステップ1: CSR生成
1. **キーチェーンアクセス.app**を開く
2. **メニュー** → **キーチェーンアクセス** → **証明書アシスタント** → **認証局に証明書を要求**
3. 情報入力:
   - メールアドレス: Apple Developer アカウントのメール
   - 通称: 証明書名（例：Shunyaku Developer ID）
   - 要求の処理: **ディスクに保存**、**鍵ペア情報を指定**
4. 鍵のサイズ: **2048ビット**、アルゴリズム: **RSA**
5. **CertificateSigningRequest.certSigningRequest** を保存

#### ステップ2: Developer Portal で証明書作成
1. [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list) にアクセス
2. **「+」** ボタンをクリック
3. **Developer ID** セクションで以下を選択:
   - **Developer ID Application**（アプリ署名用）
   - **Developer ID Installer**（インストーラー署名用）
4. 作成したCSRファイルをアップロード
5. 証明書（.cer）をダウンロード

#### ステップ3: 証明書インストール
```bash
# 証明書をキーチェーンに追加
security import developer_id_application.cer -k ~/Library/Keychains/login.keychain
security import developer_id_installer.cer -k ~/Library/Keychains/login.keychain
```

---

## 4. コード署名手順

### 4.1 Electronアプリの署名

#### 基本署名コマンド
```bash
# アプリバンドル署名
codesign --force --deep --sign "$DEVELOPER_ID_APPLICATION" "dist/mac/Shunyaku v2.app"

# 署名確認
codesign --verify --verbose "dist/mac/Shunyaku v2.app"
spctl --assess --type execute --verbose "dist/mac/Shunyaku v2.app"
```

#### electron-builder での自動署名
```json
// package.json
{
  "build": {
    "appId": "com.shunyaku.v2",
    "productName": "Shunyaku v2",
    "mac": {
      "category": "public.app-category.productivity",
      "identity": "Developer ID Application: Your Name (TEAM_ID)",
      "hardenedRuntime": true,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "gatekeeperAssess": false
    },
    "afterSign": "scripts/notarize.js"
  }
}
```

#### entitlements.mac.plist作成
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Screen Recording権限（スクリーンショット機能用） -->
    <key>com.apple.security.device.camera</key>
    <false/>
    <key>com.apple.security.personal-information.photos-library</key>
    <false/>
    
    <!-- ネットワークアクセス（DeepL API用） -->
    <key>com.apple.security.network.client</key>
    <true/>
    
    <!-- JIT（tesseract.js用） -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    
    <!-- ファイルアクセス -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

### 4.2 署名検証
```bash
# 詳細検証
codesign --verify --deep --strict --verbose=2 "dist/mac/Shunyaku v2.app"

# Gatekeeper評価
spctl --assess --verbose --type execute "dist/mac/Shunyaku v2.app"

# 署名情報表示
codesign --display --verbose "dist/mac/Shunyaku v2.app"
```

---

## 5. 公証（Notarization）

### 5.1 App Store Connect APIキー設定
```bash
# APIキーファイルのダウンロード（Apple Developer Portal）
# AuthKey_XXXXXXXXXX.p8 ファイルを ~/private_keys/ に配置

# 環境変数設定
export NOTARIZE_API_KEY="XXXXXXXXXX"
export NOTARIZE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export NOTARIZE_API_KEY_FILE="~/private_keys/AuthKey_${NOTARIZE_API_KEY}.p8"
```

### 5.2 公証スクリプト作成
```bash
# scripts/notarize.js
const { notarize } = require('electron-notarize');

exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    appBundleId: 'com.shunyaku.v2',
    appPath: `${appOutDir}/${appName}.app`,
    apiKey: process.env.NOTARIZE_API_KEY,
    apiIssuer: process.env.NOTARIZE_API_ISSUER,
    apiKeyPath: process.env.NOTARIZE_API_KEY_FILE,
  });
};
```

### 5.3 手動公証
```bash
# ZIPアーカイブ作成
ditto -c -k --sequesterRsrc --keepParent "dist/mac/Shunyaku v2.app" "Shunyaku-v2.zip"

# 公証申請
xcrun notarytool submit "Shunyaku-v2.zip" \
  --api-key "$NOTARIZE_API_KEY" \
  --api-issuer "$NOTARIZE_API_ISSUER" \
  --keychain-profile "notarytool-profile" \
  --wait

# 公証結果をアプリに添付
xcrun stapler staple "dist/mac/Shunyaku v2.app"

# ステープリング確認
xcrun stapler validate "dist/mac/Shunyaku v2.app"
```

---

## 6. 配布パッケージ作成

### 6.1 DMG作成
```bash
# electron-builderによるDMG作成
npm run build:mac

# 手動DMG作成
hdiutil create -volname "Shunyaku v2" \
  -srcfolder "dist/mac" \
  -ov -format UDZO \
  "dist/Shunyaku-v2.dmg"
```

### 6.2 PKG作成（オプション）
```bash
# PKGインストーラー作成
productbuild --component "dist/mac/Shunyaku v2.app" /Applications \
  --sign "$DEVELOPER_ID_INSTALLER" \
  "dist/Shunyaku-v2.pkg"
```

---

## 7. 自動化

### 7.1 署名・公証スクリプト（推奨）

#### 完全自動化スクリプト
```bash
# 全プロセスを一括実行
./scripts/full-signing-process.sh

# 公証スキップ版
SKIP_NOTARIZATION=true ./scripts/full-signing-process.sh
```

#### 個別実行
```bash
# 1. コード署名のみ
./scripts/codesign.sh

# 2. 公証のみ
./scripts/notarize.sh

# 3. 署名検証のみ
./scripts/verify-notarization.sh

# 4. DMGテストのみ
./scripts/test-signed-dmg.sh
```

### 7.2 作成されたスクリプト一覧

| スクリプト | 機能 | 用途 |
|-----------|------|------|
| `scripts/codesign.sh` | コード署名実行 | アプリケーションにDeveloper ID署名を適用 |
| `scripts/notarize.sh` | 公証実行 | Apple公証サービスでの認証 |
| `scripts/notarize.js` | electron-builder統合 | ビルドプロセス中の自動公証 |
| `scripts/verify-notarization.sh` | 署名・公証検証 | stapler検証とGatekeeper確認 |
| `scripts/test-signed-dmg.sh` | DMG動作テスト | 署名済みDMGの包括テスト |
| `scripts/full-signing-process.sh` | 完全自動化 | ビルド→署名→公証→検証の全工程 |

### 7.3 ビルドスクリプト
```bash
# scripts/build-and-sign.sh (レガシー)
#!/bin/bash
set -e

echo "🚀 Building and signing Shunyaku v2..."

# 環境変数確認
./scripts/check-certificates.sh

# ビルド
npm run build:mac

# 署名確認
echo "✅ Build and signing complete!"
echo "📦 Output: dist/mac/Shunyaku v2.app"
```

### 7.4 新スクリプトの詳細使用方法

#### scripts/codesign.sh
```bash
# 基本実行
./scripts/codesign.sh

# 署名検証のみ
./scripts/codesign.sh --verify

# ヘルプ表示
./scripts/codesign.sh --help

# 環境変数での証明書指定
DEVELOPER_ID_APPLICATION="Developer ID Application: Your Name (TEAM_ID)" \
./scripts/codesign.sh
```

#### scripts/notarize.sh
```bash
# 必須環境変数設定
export NOTARIZE_API_KEY="XXXXXXXXXX"
export NOTARIZE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export NOTARIZE_API_KEY_FILE="~/private_keys/AuthKey_XXXXXXXXXX.p8"

# 公証実行
./scripts/notarize.sh

# 公証状態確認のみ
./scripts/notarize.sh --verify
```

#### scripts/verify-notarization.sh
```bash
# 包括的検証
./scripts/verify-notarization.sh

# クイック検証
./scripts/verify-notarization.sh --quick

# Stapler検証のみ
./scripts/verify-notarization.sh --stapler
```

#### scripts/test-signed-dmg.sh
```bash
# 包括的DMGテスト
./scripts/test-signed-dmg.sh

# クイックテスト
./scripts/test-signed-dmg.sh --quick

# マウントテストのみ
./scripts/test-signed-dmg.sh --mount
```

#### scripts/full-signing-process.sh
```bash
# 完全自動実行（推奨）
# 環境変数を設定してから実行
export NOTARIZE_API_KEY="XXXXXXXXXX"
export NOTARIZE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  
export NOTARIZE_API_KEY_FILE="~/private_keys/AuthKey_XXXXXXXXXX.p8"
./scripts/full-signing-process.sh

# 公証スキップ実行
SKIP_NOTARIZATION=true ./scripts/full-signing-process.sh

# 公証エラー時も継続
CONTINUE_ON_NOTARIZE_ERROR=true ./scripts/full-signing-process.sh
```

### 7.5 GitHub Actions設定
```yaml
# .github/workflows/build-mac.yml
name: Build macOS

on: [push, pull_request]

jobs:
  build-mac:
    runs-on: macos-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Import Code-Signing Certificates
      uses: Apple-Actions/import-codesign-certs@v1
      with:
        p12-file-base64: ${{ secrets.CERTIFICATES_P12 }}
        p12-password: ${{ secrets.CERTIFICATES_P12_PASSWORD }}
        
    - name: Build and Sign with Full Process
      env:
        NOTARIZE_API_KEY: ${{ secrets.NOTARIZE_API_KEY }}
        NOTARIZE_API_ISSUER: ${{ secrets.NOTARIZE_API_ISSUER }}
        NOTARIZE_API_KEY_FILE: ${{ secrets.NOTARIZE_API_KEY_FILE }}
      run: ./scripts/full-signing-process.sh
      
    - name: Upload DMG
      uses: actions/upload-artifact@v3
      with:
        name: Shunyaku-v2-dmg
        path: dist/*.dmg
```

---

## 8. トラブルシューティング

### 8.1 よくある問題と解決策

#### 問題1: 「xcrun: error: unable to find utility "notarytool"」
```bash
# 解決: Xcode Command Line Tools更新
sudo xcode-select --install
sudo xcode-select --reset

# macOSバージョン確認（notarytoolはmacOS 12.0+が必要）
sw_vers -productVersion
```

#### 問題2: 「The specified item could not be found in the keychain」
```bash
# 解決: キーチェーン修復
security unlock-keychain -p [パスワード] ~/Library/Keychains/login.keychain
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k [パスワード] ~/Library/Keychains/login.keychain

# 証明書の再インストール
./scripts/check-certificates.sh
```

#### 問題3: 「App is damaged and can't be opened」
```bash
# 解決: Gatekeeper属性削除
sudo xattr -rd com.apple.quarantine "/path/to/Shunyaku v2.app"

# 再署名が必要な場合
./scripts/codesign.sh
```

#### 問題4: 公証が「Invalid」で失敗
```bash
# 公証ログを確認
xcrun notarytool log [SUBMISSION_ID] \
  --key-id "$NOTARIZE_API_KEY" \
  --key "$NOTARIZE_API_KEY_FILE" \
  --issuer "$NOTARIZE_API_ISSUER"

# よくある原因と対策
# 1. Hardened Runtimeが無効 → package.jsonで"hardenedRuntime": trueを確認
# 2. Entitlementsが不適切 → assets/entitlements.mac.plistを確認  
# 3. 未署名のバイナリ → 全てのバイナリがコード署名されているか確認
```

#### 問題5: electron-notarizeでエラー
```bash
# electron-notarizeの依存関係確認
npm list electron-notarize

# パッケージ更新
npm install electron-notarize@latest

# 手動公証に切り替え
./scripts/notarize.sh
```

#### 問題6: DMGマウントエラー
```bash
# DMGファイル修復
hdiutil verify "dist/Shunyaku-v2.dmg"

# 再作成
rm -f "dist/Shunyaku-v2.dmg"
npm run build:dmg
```

### 8.2 デバッグ用検証コマンド一覧

#### 基本検証
```bash
# 署名確認
codesign --verify --deep --strict --verbose=2 "Shunyaku v2.app"

# 公証確認  
spctl --assess --verbose --type execute "Shunyaku v2.app"

# ステープリング確認
xcrun stapler validate "Shunyaku v2.app"

# 詳細情報表示
codesign --display --verbose "Shunyaku v2.app"
```

#### 詳細診断
```bash
# Entitlements確認
codesign --display --entitlements - "Shunyaku v2.app"

# 署名階層表示  
codesign --display --verbose=4 "Shunyaku v2.app"

# 公証チケット確認
codesign --display --verbose "Shunyaku v2.app" | grep -i ticket

# quarantine属性確認
xattr -l "Shunyaku v2.app"
```

#### システム状態確認
```bash
# 証明書一覧
security find-identity -v -p codesigning

# キーチェーン状態
security list-keychains

# システム情報
sw_vers
xcode-select -p
xcrun --find codesign
xcrun --find notarytool
```

### 8.3 自動化スクリプトのトラブルシューティング

#### スクリプト実行権限エラー
```bash
# 実行権限付与
chmod +x scripts/*.sh

# 権限確認
ls -la scripts/
```

#### 環境変数エラー
```bash
# 必須環境変数確認
echo "API Key: ${NOTARIZE_API_KEY:-未設定}"
echo "Issuer: ${NOTARIZE_API_ISSUER:-未設定}"
echo "Key File: ${NOTARIZE_API_KEY_FILE:-未設定}"

# APIキーファイル存在確認
ls -la "${NOTARIZE_API_KEY_FILE}"
```

#### ログファイル確認
```bash
# スクリプトのログ出力をファイルに保存
./scripts/full-signing-process.sh 2>&1 | tee signing-process.log

# エラー詳細を確認
grep -i error signing-process.log
grep -i failed signing-process.log
```

---

## 9. チェックリスト

### 署名前チェックリスト
- [ ] Apple Developer Program登録済み
- [ ] Developer ID Application証明書取得済み
- [ ] 証明書の有効期限確認済み（30日以上）
- [ ] キーチェーンに証明書と秘密キーが存在
- [ ] assets/entitlements.mac.plist作成済み
- [ ] 署名スクリプト実行権限確認済み (`chmod +x scripts/*.sh`)

### 公証前チェックリスト  
- [ ] App Store Connect APIキー取得済み
- [ ] APIキーファイル(.p8)配置済み
- [ ] 必須環境変数設定済み (NOTARIZE_API_KEY, NOTARIZE_API_ISSUER, NOTARIZE_API_KEY_FILE)
- [ ] notarytoolコマンド利用可能 (macOS 12.0+)

### 自動化実行チェックリスト
- [ ] `./scripts/check-certificates.sh` で証明書確認済み
- [ ] `npm install` で依存関係インストール済み  
- [ ] `./scripts/full-signing-process.sh --help` でヘルプ確認済み

### 署名後チェックリスト
- [ ] `./scripts/codesign.sh --verify` でエラーなし
- [ ] `./scripts/verify-notarization.sh --quick` で通過
- [ ] `spctl --assess --type execute` でAccepted
- [ ] `xcrun stapler validate` でエラーなし

### 公証後チェックリスト
- [ ] notarytool で「status: Accepted」確認
- [ ] stapler でチケット添付完了
- [ ] Gatekeeper評価で通過
- [ ] `./scripts/verify-notarization.sh` で全項目通過

### DMG配布前チェックリスト
- [ ] `./scripts/test-signed-dmg.sh` で全テスト通過
- [ ] DMGマウント・アンマウント正常動作
- [ ] DMG内アプリケーション署名確認
- [ ] 別のMac環境でのインストールテスト完了
- [ ] quarantine属性付きでの動作確認

### 最終配布前チェックリスト
- [ ] 全自動化スクリプト実行成功 (`./scripts/full-signing-process.sh`)
- [ ] DMGファイルサイズ確認（適切な範囲内）
- [ ] 第三者による動作確認完了
- [ ] リリースノート作成
- [ ] GitHub Release作成・DMGアップロード完了

### 継続メンテナンスチェックリスト
- [ ] Apple Developer証明書の有効期限監視
- [ ] App Store Connect APIキーの有効期限確認
- [ ] macOS新バージョンでの動作確認
- [ ] 署名・公証プロセスの定期テスト実行

---

## 10. 参考資料

- [Apple Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

---

**最終更新**: 2025-09-30  
**作成者**: Shunyaku v2 Development Team  
**バージョン**: 1.0.0