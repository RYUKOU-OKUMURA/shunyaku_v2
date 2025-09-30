# Certificate Management Guide

作成日: 2025-09-30  
対象: macOS版Shunyaku v2アプリのコード署名証明書管理  

## 1. Developer ID証明書の取得状況確認

### 1.1 必要な証明書タイプ
Electronアプリの配布には以下の証明書が必要：

1. **Developer ID Application**
   - アプリケーション署名用
   - Mac App Store外での配布に必要
   - 用途: .appバンドルの署名

2. **Developer ID Installer**
   - インストーラー署名用
   - .pkgファイルの配布時に必要
   - 用途: インストーラーパッケージの署名

### 1.2 証明書確認コマンド（macOS）

```bash
# コード署名用証明書の一覧表示
security find-identity -v -p codesigning

# キーチェーンの証明書詳細表示
security find-certificate -c "Developer ID Application" -p

# 証明書の有効期限確認
security find-certificate -c "Developer ID Application" -Z | openssl x509 -inform DER -text -noout
```

### 1.3 証明書取得手順
証明書が未取得の場合：

1. **Developer Portal でCSR作成**
   - https://developer.apple.com/account/resources/certificates/list
   - 「+」ボタンをクリック
   - 「Developer ID」セクションから適切な証明書を選択

2. **CSR（Certificate Signing Request）生成**
   ```bash
   # キーチェーンアクセス.app を開く
   # メニュー: キーチェーンアクセス > 証明書アシスタント > 認証局に証明書を要求
   ```

3. **証明書ダウンロードとインストール**
   - Developer Portalで証明書をダウンロード
   - .cerファイルをダブルクリックしてキーチェーンに追加

### 1.4 確認結果記録用テンプレート

```markdown
## Developer ID証明書確認結果

**確認日時**: YYYY-MM-DD HH:MM

### Developer ID Application
- [ ] 証明書存在
- 証明書名: "Developer ID Application: [名前] ([Team ID])"
- 有効期限: YYYY-MM-DD
- フィンガープリント: [SHA-1]
- ステータス: 有効/期限切れ/未取得

### Developer ID Installer
- [ ] 証明書存在
- 証明書名: "Developer ID Installer: [名前] ([Team ID])"
- 有効期限: YYYY-MM-DD
- フィンガープリント: [SHA-1]
- ステータス: 有効/期限切れ/未取得

### キーチェーン確認
- [ ] システムキーチェーンに保存
- [ ] 秘密キーが存在
- [ ] 証明書チェーンが完全

### 備考
[問題や特記事項があれば記載]
```

## 2. トラブルシューティング

### 2.1 証明書が見つからない場合
```bash
# キーチェーン修復
sudo security unlock-keychain -p [パスワード] ~/Library/Keychains/login.keychain

# 証明書の再インポート
security import developer_id.cer -k ~/Library/Keychains/login.keychain
```

### 2.2 署名テスト
```bash
# 簡単な署名テスト
codesign --sign "Developer ID Application: [名前]" /path/to/test.app
codesign --verify --verbose /path/to/test.app
```

## 3. セキュリティのベストプラクティス

1. **証明書のバックアップ**
   - 秘密キーを含む証明書を安全な場所にエクスポート
   - パスワード付きの.p12ファイルとして保存

2. **アクセス制限**
   - 証明書は開発チームの限定メンバーのみアクセス
   - CI/CD環境では環境変数として安全に管理

3. **定期的な更新**
   - 証明書の有効期限を定期的に確認
   - 更新が必要な場合は事前に新しい証明書を取得

---

**重要**: Developer ID証明書は年間有効です。期限切れ前に更新が必要です。