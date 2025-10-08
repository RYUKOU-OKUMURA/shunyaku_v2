#!/bin/bash
set -e

# Shunyaku v2 - Code Signing Script
# 作成日: 2025-10-08
# 目的: macOSアプリケーションのコード署名を実行

echo "🔐 Shunyaku v2 - Code Signing Script"
echo "===================================="

# 設定値
APP_NAME="Shunyaku v2"
APP_BUNDLE="dist/mac/${APP_NAME}.app"
ENTITLEMENTS_FILE="assets/entitlements.mac.plist"
DEVELOPER_ID_APPLICATION="${DEVELOPER_ID_APPLICATION:-Developer ID Application}"

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
    exit 1
}

trap 'handle_error $LINENO' ERR

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # アプリケーションバンドルの存在確認
    if [ ! -d "$APP_BUNDLE" ]; then
        log_error "アプリケーションバンドルが見つかりません: $APP_BUNDLE"
        log_info "まず 'npm run build:mac' を実行してください"
        exit 1
    fi
    
    # Entitlementsファイルの存在確認
    if [ ! -f "$ENTITLEMENTS_FILE" ]; then
        log_error "Entitlementsファイルが見つかりません: $ENTITLEMENTS_FILE"
        exit 1
    fi
    
    # codesignコマンドの存在確認
    if ! command -v codesign &> /dev/null; then
        log_error "codesignコマンドが見つかりません"
        log_info "Xcode Command Line Toolsをインストールしてください"
        exit 1
    fi
    
    # spctlコマンドの存在確認
    if ! command -v spctl &> /dev/null; then
        log_error "spctlコマンドが見つかりません"
        exit 1
    fi
    
    log_success "前提条件チェック完了"
}

# 証明書チェック
check_certificates() {
    log_info "コード署名証明書をチェック中..."
    
    # 利用可能な証明書一覧を取得
    AVAILABLE_CERTS=$(security find-identity -v -p codesigning)
    
    if [ -z "$AVAILABLE_CERTS" ]; then
        log_error "コード署名証明書が見つかりません"
        log_info "Apple Developer Programの証明書をキーチェーンに追加してください"
        exit 1
    fi
    
    log_info "利用可能な証明書:"
    echo "$AVAILABLE_CERTS"
    
    # Developer ID Application証明書を検索
    if echo "$AVAILABLE_CERTS" | grep -q "Developer ID Application"; then
        # 最初に見つかったDeveloper ID Application証明書を使用
        CERT_NAME=$(echo "$AVAILABLE_CERTS" | grep "Developer ID Application" | head -n1 | sed 's/.*") \(.*\)/\1/')
        log_success "使用する証明書: $CERT_NAME"
        export DEVELOPER_ID_APPLICATION="$CERT_NAME"
    else
        log_error "Developer ID Application証明書が見つかりません"
        log_info "Apple Developer Portalから証明書を取得してください"
        exit 1
    fi
}

# アプリケーション署名
sign_application() {
    log_info "アプリケーションに署名中..."
    
    # 既存の署名を削除
    log_info "既存の署名を削除中..."
    codesign --remove-signature "$APP_BUNDLE" 2>/dev/null || true
    
    # ディープ署名を実行
    log_info "ディープ署名を実行中..."
    codesign \
        --force \
        --deep \
        --sign "$DEVELOPER_ID_APPLICATION" \
        --entitlements "$ENTITLEMENTS_FILE" \
        --options runtime \
        --timestamp \
        --verbose \
        "$APP_BUNDLE"
    
    log_success "署名完了"
}

# 署名検証
verify_signature() {
    log_info "署名を検証中..."
    
    # 基本検証
    log_info "基本署名検証..."
    codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"
    log_success "基本検証: OK"
    
    # 詳細表示
    log_info "署名詳細情報:"
    codesign --display --verbose "$APP_BUNDLE"
    
    # Gatekeeper評価
    log_info "Gatekeeper評価..."
    if spctl --assess --type execute --verbose "$APP_BUNDLE"; then
        log_success "Gatekeeper評価: 通過"
    else
        log_warning "Gatekeeper評価: 失敗（公証が必要の可能性）"
        log_info "公証プロセスを実行してください"
    fi
}

# メイン処理
main() {
    echo
    log_info "処理開始: $(date)"
    echo
    
    check_prerequisites
    echo
    
    check_certificates
    echo
    
    sign_application
    echo
    
    verify_signature
    echo
    
    log_success "コード署名プロセス完了!"
    log_info "次のステップ: 公証プロセス (scripts/notarize.sh)"
    echo
    
    # サマリ表示
    echo "📋 サマリ"
    echo "========"
    echo "アプリケーション: $APP_BUNDLE"
    echo "証明書: $DEVELOPER_ID_APPLICATION"
    echo "Entitlements: $ENTITLEMENTS_FILE"
    echo "処理完了時刻: $(date)"
    echo
}

# ヘルプ表示
show_help() {
    echo "Shunyaku v2 - Code Signing Script"
    echo "=================================="
    echo
    echo "使用方法:"
    echo "  ./scripts/codesign.sh              # 署名実行"
    echo "  ./scripts/codesign.sh --help       # ヘルプ表示"
    echo "  ./scripts/codesign.sh --verify     # 署名検証のみ"
    echo
    echo "前提条件:"
    echo "  - npm run build:mac でアプリケーションビルド済み"
    echo "  - Apple Developer証明書がキーチェーンに登録済み"
    echo "  - Xcode Command Line Toolsインストール済み"
    echo
    echo "環境変数（オプション）:"
    echo "  DEVELOPER_ID_APPLICATION   使用する証明書名"
    echo
}

# コマンドライン引数処理
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --verify|-v)
        log_info "署名検証のみ実行..."
        check_prerequisites
        verify_signature
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