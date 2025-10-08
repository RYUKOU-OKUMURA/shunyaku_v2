#!/bin/bash
set -e

# Shunyaku v2 - App Notarization Script
# 作成日: 2025-10-08
# 目的: macOSアプリケーションの公証を実行

echo "🔒 Shunyaku v2 - App Notarization Script"
echo "========================================"

# 設定値
APP_NAME="Shunyaku v2"
APP_BUNDLE="dist/mac/${APP_NAME}.app"
ZIP_FILE="dist/${APP_NAME// /-}.zip"
DMG_FILE="dist/${APP_NAME// /-}.dmg"
BUNDLE_ID="com.shunyaku.v2"

# カラー設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}ℹ️  ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}✅ ${1}${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  ${1}${NC}"
}

log_error() {
    echo -e "${RED}❌ ${1}${NC}"
}

# エラーハンドラー
handle_error() {
    local line_number=$1
    log_error "エラーが発生しました (line: $line_number)"
    log_error "スクリプトを中断します"
    
    # クリーンアップ
    cleanup
    exit 1
}

trap 'handle_error $LINENO' ERR

# クリーンアップ関数
cleanup() {
    log_info "クリーンアップ中..."
    
    # 一時ZIPファイルを削除
    if [ -f "$ZIP_FILE" ]; then
        rm -f "$ZIP_FILE"
        log_info "一時ZIPファイルを削除: $ZIP_FILE"
    fi
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # アプリケーションバンドルの存在確認
    if [ ! -d "$APP_BUNDLE" ]; then
        log_error "アプリケーションバンドルが見つかりません: $APP_BUNDLE"
        log_info "まず './scripts/codesign.sh' を実行してください"
        exit 1
    fi
    
    # 署名確認
    if ! codesign --verify --deep "$APP_BUNDLE" 2>/dev/null; then
        log_error "アプリケーションが署名されていません"
        log_info "まず './scripts/codesign.sh' を実行してください"
        exit 1
    fi
    
    # notarytoolコマンドの存在確認
    if ! command -v xcrun &> /dev/null; then
        log_error "xcrunコマンドが見つかりません"
        log_info "Xcode Command Line Toolsをインストールしてください"
        exit 1
    fi
    
    # notarytoolの存在確認
    if ! xcrun notarytool --help &> /dev/null; then
        log_error "notarytoolが見つかりません"
        log_info "macOS 12.0+とXcode 13+が必要です"
        exit 1
    fi
    
    log_success "前提条件チェック完了"
}

# 認証情報チェック
check_credentials() {
    log_info "認証情報をチェック中..."
    
    # 環境変数チェック
    if [ -z "${NOTARIZE_API_KEY:-}" ]; then
        log_error "NOTARIZE_API_KEY環境変数が設定されていません"
        log_info "App Store Connect APIキーを設定してください"
        exit 1
    fi
    
    if [ -z "${NOTARIZE_API_ISSUER:-}" ]; then
        log_error "NOTARIZE_API_ISSUER環境変数が設定されていません"
        log_info "App Store Connect API Issuer IDを設定してください"
        exit 1
    fi
    
    if [ -z "${NOTARIZE_API_KEY_FILE:-}" ]; then
        log_error "NOTARIZE_API_KEY_FILE環境変数が設定されていません"
        log_info "APIキーファイルのパスを設定してください"
        exit 1
    fi
    
    # APIキーファイルの存在確認
    if [ ! -f "${NOTARIZE_API_KEY_FILE}" ]; then
        log_error "APIキーファイルが見つかりません: ${NOTARIZE_API_KEY_FILE}"
        log_info "App Store Connect APIキーファイル(.p8)を配置してください"
        exit 1
    fi
    
    log_success "認証情報チェック完了"
    log_info "API Key: ${NOTARIZE_API_KEY}"
    log_info "Issuer ID: ${NOTARIZE_API_ISSUER}"
    log_info "Key File: ${NOTARIZE_API_KEY_FILE}"
}

# アプリケーションのZIPアーカイブ作成
create_zip_archive() {
    log_info "ZIPアーカイブを作成中..."
    
    # 既存のZIPファイルを削除
    [ -f "$ZIP_FILE" ] && rm -f "$ZIP_FILE"
    
    # ZIPアーカイブ作成
    # ditto -c -k --sequesterRsrc --keepParent を使用
    if ditto -c -k --sequesterRsrc --keepParent "$APP_BUNDLE" "$ZIP_FILE"; then
        log_success "ZIPアーカイブ作成完了: $ZIP_FILE"
        
        # ファイルサイズ表示
        local file_size=$(ls -lh "$ZIP_FILE" | awk '{print $5}')
        log_info "ファイルサイズ: $file_size"
    else
        log_error "ZIPアーカイブ作成に失敗しました"
        exit 1
    fi
}

# 公証申請
submit_for_notarization() {
    log_info "公証申請を開始..."
    
    log_info "申請パラメータ:"
    log_info "  Bundle ID: $BUNDLE_ID"
    log_info "  ZIP File: $ZIP_FILE"
    log_info "  API Key: $NOTARIZE_API_KEY"
    log_info "  Issuer: $NOTARIZE_API_ISSUER"
    
    # 公証申請実行
    log_info "notarytool submit を実行中..."
    
    local submit_output
    if submit_output=$(xcrun notarytool submit "$ZIP_FILE" \
        --key-id "$NOTARIZE_API_KEY" \
        --key "$NOTARIZE_API_KEY_FILE" \
        --issuer "$NOTARIZE_API_ISSUER" \
        --wait 2>&1); then
        
        log_success "公証申請完了"
        
        # 結果詳細を表示
        echo "$submit_output"
        
        # 申請IDを抽出
        local submission_id
        if submission_id=$(echo "$submit_output" | grep "id:" | awk '{print $2}'); then
            log_info "申請ID: $submission_id"
            export NOTARIZE_SUBMISSION_ID="$submission_id"
        fi
        
        # ステータス確認
        if echo "$submit_output" | grep -q "status: Accepted"; then
            log_success "公証が承認されました!"
            return 0
        else
            log_error "公証が拒否されました"
            
            # ログの詳細を取得
            if [ -n "${submission_id:-}" ]; then
                log_info "詳細ログを取得中..."
                xcrun notarytool log "$submission_id" \
                    --key-id "$NOTARIZE_API_KEY" \
                    --key "$NOTARIZE_API_KEY_FILE" \
                    --issuer "$NOTARIZE_API_ISSUER"
            fi
            
            exit 1
        fi
        
    else
        log_error "公証申請に失敗しました"
        echo "$submit_output"
        exit 1
    fi
}

# ステープリング
staple_notarization() {
    log_info "公証結果をアプリケーションに添付中..."
    
    # ステープリング実行
    if xcrun stapler staple "$APP_BUNDLE"; then
        log_success "ステープリング完了"
    else
        log_error "ステープリングに失敗しました"
        exit 1
    fi
    
    # ステープリング検証
    log_info "ステープリング検証中..."
    if xcrun stapler validate "$APP_BUNDLE"; then
        log_success "ステープリング検証: OK"
    else
        log_warning "ステープリング検証に失敗"
    fi
}

# 最終検証
final_verification() {
    log_info "最終検証を実行中..."
    
    # Gatekeeper評価
    log_info "Gatekeeper最終評価..."
    if spctl --assess --type execute --verbose "$APP_BUNDLE"; then
        log_success "Gatekeeper評価: 完全に通過!"
    else
        log_error "Gatekeeper評価: 失敗"
        exit 1
    fi
    
    # 詳細署名情報表示
    log_info "署名詳細情報:"
    codesign --display --verbose "$APP_BUNDLE"
}

# メイン処理
main() {
    echo
    log_info "処理開始: $(date)"
    echo
    
    check_prerequisites
    echo
    
    check_credentials
    echo
    
    create_zip_archive
    echo
    
    submit_for_notarization
    echo
    
    staple_notarization
    echo
    
    final_verification
    echo
    
    # クリーンアップ
    cleanup
    
    log_success "公証プロセス完了!"
    log_info "アプリケーションは配布準備完了です"
    echo
    
    # サマリ表示
    echo "📋 サマリ"
    echo "========"
    echo "アプリケーション: $APP_BUNDLE"
    echo "Bundle ID: $BUNDLE_ID"
    echo "処理完了時刻: $(date)"
    echo
    
    log_info "次のステップ: DMGパッケージ作成 (npm run build:dmg)"
}

# ヘルプ表示
show_help() {
    echo "Shunyaku v2 - App Notarization Script"
    echo "====================================="
    echo
    echo "使用方法:"
    echo "  ./scripts/notarize.sh              # 公証実行"
    echo "  ./scripts/notarize.sh --help       # ヘルプ表示"
    echo "  ./scripts/notarize.sh --verify     # 公証状態確認のみ"
    echo
    echo "前提条件:"
    echo "  - アプリケーションが署名済み (./scripts/codesign.sh実行済み)"
    echo "  - App Store Connect APIキー取得済み"
    echo "  - 必要な環境変数が設定済み"
    echo
    echo "必須環境変数:"
    echo "  NOTARIZE_API_KEY        App Store Connect APIキーID"
    echo "  NOTARIZE_API_ISSUER     App Store Connect API Issuer ID"
    echo "  NOTARIZE_API_KEY_FILE   APIキーファイル(.p8)のパス"
    echo
    echo "例:"
    echo "  export NOTARIZE_API_KEY=\"XXXXXXXXXX\""
    echo "  export NOTARIZE_API_ISSUER=\"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\""
    echo "  export NOTARIZE_API_KEY_FILE=\"~/private_keys/AuthKey_XXXXXXXXXX.p8\""
    echo "  ./scripts/notarize.sh"
    echo
}

# コマンドライン引数処理
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --verify|-v)
        log_info "公証状態確認のみ実行..."
        check_prerequisites
        final_verification
        exit 0
        ;;
    "")
        main
        ;;
    *)
        log_error "不明なオプション: $1"
        show_help
        exit 1
        ;;
esac