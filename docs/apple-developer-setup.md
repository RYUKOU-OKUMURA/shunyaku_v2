# Apple Developer セットアップガイド

作成日: 2025-09-30  
対象: macOS版Shunyaku v2アプリの配布準備  

## 1. Apple Developer Program 登録確認

### 1.1 登録状況の確認
以下の方法でApple Developer Program登録状況を確認：

1. **Apple Developer ポータル確認**
   - https://developer.apple.com/ にアクセス
   - Apple IDでサインイン
   - アカウント情報を確認

2. **必要な登録タイプ**
   - **Individual Account**: 個人開発者（年間$99）
   - **Organization Account**: 組織・企業（年間$99）
   - アプリ配布には有償登録が必要

3. **登録確認項目**
   - [ ] Apple Developer Program 登録済み
   - [ ] 年間料金の支払い状況
   - [ ] アカウントの有効期限
   - [ ] Team IDの確認

### 1.2 登録が必要な場合
未登録の場合は以下を実施：

1. Apple Developer Programに登録
2. 支払い処理（通常24時間以内に承認）
3. 確認メール受信
4. Developer Portalアクセス確認

## 2. 確認結果記録用テンプレート

```markdown
## Apple Developer Program 確認結果

**確認日時**: YYYY-MM-DD HH:MM
**確認者**: [名前]

### 登録状況
- Apple ID: [メールアドレス]
- 登録タイプ: Individual / Organization
- Team ID: [Team ID]
- 登録日: YYYY-MM-DD
- 有効期限: YYYY-MM-DD

### 料金・支払い状況
- 年間料金: $99 USD
- 支払い方法: [クレジットカード/その他]
- 次回更新日: YYYY-MM-DD

### アクセス確認
- [ ] Developer Portal アクセス可能
- [ ] Certificate, Identifiers & Profiles アクセス可能
- [ ] App Store Connect アクセス可能

### 備考
[特記事項があれば記載]
```

## 3. 次のステップ
登録確認後、以下を実施：
1. Developer ID証明書の取得・確認
2. Provisioning Profileの設定
3. Code Signing設定
4. 配布準備

---

**注意**: Apple Developer Program登録には時間がかかる場合があります。  
アプリ配布予定日の少なくとも1週間前には登録を完了してください。