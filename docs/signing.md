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

### 7.1 ビルドスクリプト
```bash
# scripts/build-and-sign.sh
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

### 7.2 GitHub Actions設定
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
        
    - name: Build and Sign
      env:
        NOTARIZE_API_KEY: ${{ secrets.NOTARIZE_API_KEY }}
        NOTARIZE_API_ISSUER: ${{ secrets.NOTARIZE_API_ISSUER }}
      run: npm run build:mac
      
    - name: Upload artifact
      uses: actions/upload-artifact@v3
      with:
        name: Shunyaku-v2-mac
        path: dist/mac/
```

---

## 8. トラブルシューティング

### 8.1 よくある問題

#### 問題1: 「xcrun: error: unable to find utility "notarytool"」
```bash
# 解決: Xcode Command Line Tools更新
sudo xcode-select --install
sudo xcode-select --reset
```

#### 問題2: 「The specified item could not be found in the keychain」
```bash
# 解決: キーチェーン修復
security unlock-keychain -p [パスワード] ~/Library/Keychains/login.keychain
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k [パスワード] ~/Library/Keychains/login.keychain
```

#### 問題3: 「App is damaged and can't be opened」
```bash
# 解決: Gatekeeper属性削除
sudo xattr -rd com.apple.quarantine "/path/to/Shunyaku v2.app"
```

### 8.2 検証コマンド一覧
```bash
# 署名確認
codesign --verify --deep --strict --verbose=2 "Shunyaku v2.app"

# 公証確認  
spctl --assess --verbose --type execute "Shunyaku v2.app"

# ステープリング確認
stapler validate "Shunyaku v2.app"

# 詳細情報表示
codesign --display --verbose "Shunyaku v2.app"
```

---

## 9. チェックリスト

### 署名前チェックリスト
- [ ] Apple Developer Program登録済み
- [ ] Developer ID Application証明書取得済み
- [ ] 証明書の有効期限確認済み（30日以上）
- [ ] キーチェーンに証明書と秘密キーが存在
- [ ] entitlements.mac.plist作成済み

### 署名後チェックリスト
- [ ] codesign --verify でエラーなし
- [ ] spctl --assess でAccepted
- [ ] 公証完了（notarytool）
- [ ] stapler validateでエラーなし
- [ ] 別のMacでアプリ起動確認

### 配布前チェックリスト
- [ ] DMG/PKGパッケージ作成完了
- [ ] パッケージの署名確認
- [ ] 第三者による動作確認
- [ ] リリースノート作成
- [ ] GitHub Releaseアップロード

---

## 10. 参考資料

- [Apple Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

---

**最終更新**: 2025-09-30  
**作成者**: Shunyaku v2 Development Team  
**バージョン**: 1.0.0