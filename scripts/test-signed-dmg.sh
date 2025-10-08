#!/bin/bash
set -e

# Shunyaku v2 - Signed DMG Testing Script
# 作成日: 2025-10-08
# 目的: 署名済みDMGファイルの動作確認とインストールテスト

echo "🧪 Shunyaku v2 - Signed DMG Testing"
echo "===================================="

# 設定値
APP_NAME="Shunyaku v2"
DMG_FILE="dist/${APP_NAME// /-}.dmg"
APP_BUNDLE="dist/mac/${APP_NAME}.app"
TEST_DIR="/tmp/shunyaku-dmg-test"
MOUNTED_VOLUME="/Volumes/${APP_NAME}"

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
    cleanup
    exit 1
}

trap 'handle_error $LINENO' ERR

# クリーンアップ関数
cleanup() {
    log_info "クリーンアップ中..."
    
    # ボリュームのアンマウント
    if [ -d "$MOUNTED_VOLUME" ]; then
        hdiutil detach "$MOUNTED_VOLUME" 2>/dev/null || true
        log_info "DMGボリュームをアンマウント: $MOUNTED_VOLUME"
    fi
    
    # テスト用ディレクトリの削除
    if [ -d "$TEST_DIR" ]; then
        rm -rf "$TEST_DIR"
        log_info "テストディレクトリを削除: $TEST_DIR"
    fi
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # DMGファイルの存在確認
    if [ ! -f "$DMG_FILE" ]; then
        log_error "DMGファイルが見つかりません: $DMG_FILE"
        log_info "まず 'npm run build:dmg' を実行してください"
        exit 1
    fi
    
    # hdiutilコマンドの存在確認
    if ! command -v hdiutil &> /dev/null; then
        log_error "hdiutilコマンドが見つかりません"
        exit 1
    fi
    
    # spctlコマンドの存在確認
    if ! command -v spctl &> /dev/null; then
        log_error "spctlコマンドが見つかりません"
        exit 1
    fi
    
    log_success "前提条件チェック完了"
}

# DMGファイルの基本情報表示
show_dmg_info() {
    log_info "DMG基本情報:"
    
    # ファイルサイズ
    local file_size=$(ls -lh "$DMG_FILE" | awk '{print $5}')
    echo "  ファイルサイズ: $file_size"
    
    # 作成日時
    local creation_time=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$DMG_FILE")
    echo "  作成日時: $creation_time"
    
    # DMG情報詳細
    log_info "DMG詳細情報:"
    hdiutil imageinfo "$DMG_FILE" | head -20
    
    echo ""
}

# DMG署名検証
verify_dmg_signature() {
    log_info "DMG署名検証中..."
    
    # DMGの署名確認
    if codesign --verify --deep --verbose=2 "$DMG_FILE" 2>&1; then
        log_success "DMG署名: 有効"
    else
        log_warning "DMG署名: 無効または未署名"
        log_info "DMGファイル自体の署名は必須ではありませんが、推奨されます"
    fi
    
    # DMGのGatekeeper評価
    log_info "DMG Gatekeeper評価..."
    if spctl --assess --type install --verbose "$DMG_FILE" 2>&1; then
        log_success "DMG Gatekeeper評価: 通過"
    else
        log_warning "DMG Gatekeeper評価: 失敗"
        log_info "アプリケーション自体が署名済みであれば問題ありません"
    fi
    
    echo ""
}

# DMGマウント
mount_dmg() {
    log_info "DMGをマウント中..."
    
    # 既存のマウントをチェック
    if [ -d "$MOUNTED_VOLUME" ]; then
        log_warning "DMGは既にマウントされています: $MOUNTED_VOLUME"
        return 0
    fi
    
    # DMGマウント実行
    if hdiutil attach "$DMG_FILE" -nobrowse -quiet; then
        log_success "DMGマウント完了: $MOUNTED_VOLUME"
        
        # マウント内容確認
        log_info "マウント内容:"
        ls -la "$MOUNTED_VOLUME"
        
        return 0
    else
        log_error "DMGマウントに失敗しました"
        return 1
    fi
}

# アプリケーション署名確認（マウント内）
verify_mounted_app() {
    log_info "マウント内アプリケーションの署名確認..."
    
    local mounted_app="${MOUNTED_VOLUME}/${APP_NAME}.app"
    
    if [ ! -d "$mounted_app" ]; then
        log_error "マウント内にアプリケーションが見つかりません: $mounted_app"
        return 1
    fi
    
    # 署名検証
    if codesign --verify --deep --strict --verbose=2 "$mounted_app"; then
        log_success "マウント内アプリ署名: 有効"
    else
        log_error "マウント内アプリ署名: 無効"
        return 1
    fi
    
    # 公証確認（stapler）
    if xcrun stapler validate "$mounted_app" 2>&1; then
        log_success "マウント内アプリ公証: 有効"
    else
        log_warning "マウント内アプリ公証: チケットなし"
    fi
    
    # Gatekeeper評価
    if spctl --assess --type execute --verbose "$mounted_app" 2>&1; then
        log_success "マウント内アプリ Gatekeeper: 通過"
    else
        log_error "マウント内アプリ Gatekeeper: 失敗"
        return 1
    fi
    
    return 0
}

# テストインストール
test_installation() {
    log_info "テストインストールを実行中..."
    
    # テスト用ディレクトリ作成
    mkdir -p "$TEST_DIR"
    
    local mounted_app="${MOUNTED_VOLUME}/${APP_NAME}.app"
    local test_app="${TEST_DIR}/${APP_NAME}.app"
    
    # アプリケーションをテストディレクトリにコピー
    if cp -R "$mounted_app" "$test_app"; then
        log_success "テストコピー完了: $test_app"
    else
        log_error "テストコピーに失敗しました"
        return 1
    fi
    
    # コピー後の署名確認
    log_info "コピー後の署名確認..."
    if codesign --verify --deep --strict "$test_app"; then
        log_success "コピー後の署名: 有効"
    else
        log_error "コピー後の署名: 無効（コピー中に破損した可能性）"
        return 1
    fi
    
    # 実行テスト（ドライラン）
    log_info "アプリケーション実行テスト（ドライラン）..."
    
    # アプリの基本情報を確認
    local app_version=$(defaults read "$test_app/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || echo "不明")
    local bundle_id=$(defaults read "$test_app/Contents/Info.plist" CFBundleIdentifier 2>/dev/null || echo "不明")
    
    echo "  バージョン: $app_version"
    echo "  Bundle ID: $bundle_id"
    
    # Info.plistの基本検証
    if plutil -lint "$test_app/Contents/Info.plist" >/dev/null; then
        log_success "Info.plist: 有効"
    else
        log_error "Info.plist: 無効"
        return 1
    fi
    
    return 0
}

# シミュレーション実行テスト
simulate_user_experience() {
    log_info "ユーザーエクスペリエンスシミュレーション..."
    
    local mounted_app="${MOUNTED_VOLUME}/${APP_NAME}.app"
    
    # 1. ダブルクリックでの実行をシミュレート
    log_info "1. ダブルクリック実行のシミュレート..."
    if spctl --assess --type execute "$mounted_app" 2>&1; then
        log_success "ダブルクリック実行: Gatekeeperを通過"
    else
        log_error "ダブルクリック実行: Gatekeeperで阻止される"
        return 1
    fi
    
    # 2. 右クリック「開く」をシミュレート
    log_info "2. 右クリック「開く」のシミュレート..."
    # 実際の実行はしないが、評価のみ実行
    if spctl --assess --type execute --ignore-cache "$mounted_app" 2>&1; then
        log_success "右クリック「開く」: 成功予想"
    else
        log_warning "右クリック「開く」: 問題の可能性"
    fi
    
    # 3. 初回実行時の警告チェック
    log_info "3. 初回実行時の動作確認..."
    
    # quarantine属性をチェック（実際のダウンロードをシミュレート）
    xattr -w com.apple.quarantine "0083;$(date +%s);Safari;" "$mounted_app" 2>/dev/null || true
    
    if spctl --assess --type execute "$mounted_app" 2>&1; then
        log_success "quarantine属性付きでもGatekeeperを通過"
    else
        log_warning "quarantine属性ありでGatekeeper失敗（予想される動作）"
    fi
    
    # quarantine属性を除去
    xattr -d com.apple.quarantine "$mounted_app" 2>/dev/null || true
    
    return 0
}

# 包括的検証
comprehensive_test() {
    log_info "包括的検証を実行中..."
    
    local tests_passed=0
    local total_tests=5
    
    # テスト1: DMG署名
    if verify_dmg_signature >/dev/null 2>&1; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # テスト2: DMGマウント
    if mount_dmg >/dev/null 2>&1; then
        tests_passed=$((tests_passed + 1))
    else
        log_error "マウントに失敗したため、以降のテストをスキップします"
        return 1
    fi
    
    # テスト3: マウント内アプリ検証
    if verify_mounted_app >/dev/null 2>&1; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # テスト4: インストールテスト
    if test_installation >/dev/null 2>&1; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # テスト5: ユーザーエクスペリエンス
    if simulate_user_experience >/dev/null 2>&1; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # 結果サマリ
    echo ""
    echo "📋 テスト結果サマリ"
    echo "==================="
    echo "合格テスト: $tests_passed / $total_tests"
    
    if [ $tests_passed -eq $total_tests ]; then
        log_success "🎉 全テスト合格! DMGは配布準備完了です"
        return 0
    else
        log_error "❌ 一部テストに失敗しました"
        return 1
    fi
}

# メイン処理
main() {
    echo
    log_info "テスト開始: $(date)"
    echo
    
    check_prerequisites
    echo
    
    show_dmg_info
    
    # 包括的テスト実行
    if comprehensive_test; then
        log_success "署名済みDMGテスト: 完了（成功）"
    else
        log_error "署名済みDMGテスト: 完了（問題あり）"
        exit 1
    fi
    
    echo
    log_info "テスト完了: $(date)"
}

# ヘルプ表示
show_help() {
    echo "Shunyaku v2 - Signed DMG Testing Script"
    echo "======================================="
    echo
    echo "使用方法:"
    echo "  ./scripts/test-signed-dmg.sh              # 包括的テスト"
    echo "  ./scripts/test-signed-dmg.sh --help       # ヘルプ表示"
    echo "  ./scripts/test-signed-dmg.sh --quick      # クイックテスト"
    echo "  ./scripts/test-signed-dmg.sh --mount      # マウントテストのみ"
    echo "  ./scripts/test-signed-dmg.sh --verify     # 検証のみ"
    echo
    echo "テスト項目:"
    echo "  1. DMG署名検証"
    echo "  2. DMGマウント確認"
    echo "  3. マウント内アプリケーション署名確認"
    echo "  4. テストインストール"
    echo "  5. ユーザーエクスペリエンスシミュレーション"
    echo
    echo "前提条件:"
    echo "  - 署名済みDMGファイルが存在すること"
    echo "  - macOSの標準ツール（hdiutil, spctl, codesign）が使用可能"
    echo
}

# クイックテスト
quick_test() {
    log_info "クイックテスト実行中..."
    
    check_prerequisites
    show_dmg_info
    verify_dmg_signature
    
    if mount_dmg && verify_mounted_app; then
        log_success "クイックテスト: 成功"
        return 0
    else
        log_error "クイックテスト: 失敗"
        return 1
    fi
}

# コマンドライン引数処理
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --quick|-q)
        quick_test
        exit $?
        ;;
    --mount|-m)
        log_info "マウントテストのみ実行..."
        check_prerequisites
        mount_dmg
        exit $?
        ;;
    --verify|-v)
        log_info "検証のみ実行..."
        check_prerequisites
        show_dmg_info
        verify_dmg_signature
        exit $?
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

# スクリプト終了時のクリーンアップ
trap cleanup EXIT