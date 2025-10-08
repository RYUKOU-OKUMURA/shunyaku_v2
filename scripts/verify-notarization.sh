#!/bin/bash
set -e

# Shunyaku v2 - Notarization Verification Script
# 作成日: 2025-10-08
# 目的: 公証状態の確認とstapler検証

echo "🔍 Shunyaku v2 - Notarization Verification"
echo "========================================="

# 設定値
APP_NAME="Shunyaku v2"
APP_BUNDLE="dist/mac/${APP_NAME}.app"
DMG_FILE="dist/${APP_NAME// /-}.dmg"

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

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # アプリケーションバンドルの存在確認
    if [ ! -d "$APP_BUNDLE" ]; then
        log_error "アプリケーションバンドルが見つかりません: $APP_BUNDLE"
        exit 1
    fi
    
    # stapler コマンドの存在確認
    if ! command -v xcrun &> /dev/null; then
        log_error "xcrunコマンドが見つかりません"
        exit 1
    fi
    
    # stapler サブコマンドの確認
    if ! xcrun stapler --help &> /dev/null 2>&1; then
        log_error "staplerが使用できません"
        exit 1
    fi
    
    log_success "前提条件チェック完了"
}

# 署名状態確認
check_signature() {
    log_info "署名状態を確認中..."
    
    # コード署名検証
    if codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE" 2>&1; then
        log_success "コード署名: 有効"
    else
        log_error "コード署名: 無効または未署名"
        return 1
    fi
    
    # 署名詳細情報
    log_info "署名詳細情報:"
    codesign --display --verbose "$APP_BUNDLE" 2>&1 | head -20
    
    echo ""
}

# Stapler検証
verify_stapler() {
    log_info "Stapler検証を実行中..."
    
    # stapler validate実行
    local stapler_output
    if stapler_output=$(xcrun stapler validate "$APP_BUNDLE" 2>&1); then
        log_success "Stapler検証: 通過"
        
        # 詳細出力
        if [[ "$stapler_output" == *"validated"* ]]; then
            log_info "公証チケットが正常にステープリングされています"
        fi
        
        return 0
    else
        log_warning "Stapler検証: 失敗"
        log_info "出力: $stapler_output"
        
        # 公証未実行の可能性を示唆
        if [[ "$stapler_output" == *"does not have a ticket stapled to it"* ]]; then
            log_warning "公証チケットがステープリングされていません"
            log_info "公証プロセス (scripts/notarize.sh) を実行してください"
        fi
        
        return 1
    fi
}

# Gatekeeper評価
check_gatekeeper() {
    log_info "Gatekeeper評価を実行中..."
    
    # spctl評価
    local spctl_output
    if spctl_output=$(spctl --assess --type execute --verbose "$APP_BUNDLE" 2>&1); then
        log_success "Gatekeeper評価: 通過"
        log_info "出力: $spctl_output"
        return 0
    else
        log_error "Gatekeeper評価: 失敗"
        log_info "出力: $spctl_output"
        
        # エラー内容に応じたアドバイス
        if [[ "$spctl_output" == *"rejected"* ]]; then
            if [[ "$spctl_output" == *"Notarized Developer ID"* ]]; then
                log_warning "公証が必要です"
            else
                log_warning "有効なDeveloper ID署名が必要です"
            fi
        fi
        
        return 1
    fi
}

# システム情報確認
check_system_info() {
    log_info "システム情報確認..."
    
    echo "macOSバージョン: $(sw_vers -productVersion)"
    echo "Xcode Command Line Tools: $(xcode-select -p 2>/dev/null || echo 'インストールされていません')"
    
    # 公証チケット情報
    local ticket_info
    if ticket_info=$(codesign --display --verbose "$APP_BUNDLE" 2>&1 | grep -i ticket); then
        log_info "チケット情報: $ticket_info"
    else
        log_warning "公証チケット情報が見つかりません"
    fi
    
    echo ""
}

# DMGファイルの検証（存在する場合）
verify_dmg() {
    if [ -f "$DMG_FILE" ]; then
        log_info "DMGファイルの検証..."
        
        # DMGの署名確認
        if codesign --verify --deep "$DMG_FILE" 2>/dev/null; then
            log_success "DMG署名: 有効"
        else
            log_warning "DMG署名: 無効または未署名"
        fi
        
        # DMGのGatekeeper評価
        if spctl --assess --type install --verbose "$DMG_FILE" 2>&1; then
            log_success "DMG Gatekeeper評価: 通過"
        else
            log_warning "DMG Gatekeeper評価: 失敗"
        fi
        
        echo ""
    fi
}

# 包括的な検証結果をまとめる
generate_report() {
    local signature_ok=0
    local stapler_ok=0
    local gatekeeper_ok=0
    
    # 各検証を実行して結果を記録
    check_signature && signature_ok=1
    verify_stapler && stapler_ok=1
    check_gatekeeper && gatekeeper_ok=1
    
    echo "📋 検証結果サマリ"
    echo "=================="
    
    if [ $signature_ok -eq 1 ]; then
        echo "✅ コード署名: 有効"
    else
        echo "❌ コード署名: 問題あり"
    fi
    
    if [ $stapler_ok -eq 1 ]; then
        echo "✅ 公証ステープリング: 有効"
    else
        echo "❌ 公証ステープリング: 問題あり"
    fi
    
    if [ $gatekeeper_ok -eq 1 ]; then
        echo "✅ Gatekeeper: 通過"
    else
        echo "❌ Gatekeeper: 失敗"
    fi
    
    echo ""
    
    # 総合判定
    if [ $signature_ok -eq 1 ] && [ $stapler_ok -eq 1 ] && [ $gatekeeper_ok -eq 1 ]; then
        log_success "🎉 全ての検証に合格! アプリケーションは配布準備完了です"
        return 0
    else
        log_error "❌ 一部の検証に失敗しました"
        
        # 推奨アクション
        echo "🛠️  推奨アクション:"
        if [ $signature_ok -eq 0 ]; then
            echo "  1. コード署名を実行: ./scripts/codesign.sh"
        fi
        if [ $stapler_ok -eq 0 ] || [ $gatekeeper_ok -eq 0 ]; then
            echo "  2. 公証プロセスを実行: ./scripts/notarize.sh"
        fi
        
        return 1
    fi
}

# メイン処理
main() {
    echo
    log_info "検証開始: $(date)"
    echo
    
    check_prerequisites
    echo
    
    check_system_info
    
    verify_dmg
    
    # 包括的検証とレポート生成
    if generate_report; then
        log_success "検証プロセス完了: 成功"
    else
        log_error "検証プロセス完了: 問題あり"
        exit 1
    fi
    
    echo
    log_info "検証完了: $(date)"
}

# ヘルプ表示
show_help() {
    echo "Shunyaku v2 - Notarization Verification Script"
    echo "=============================================="
    echo
    echo "使用方法:"
    echo "  ./scripts/verify-notarization.sh           # 包括的検証"
    echo "  ./scripts/verify-notarization.sh --help    # ヘルプ表示"
    echo "  ./scripts/verify-notarization.sh --quick   # 基本検証のみ"
    echo "  ./scripts/verify-notarization.sh --stapler # Stapler検証のみ"
    echo
    echo "検証項目:"
    echo "  - コード署名の有効性"
    echo "  - 公証チケットのステープリング"
    echo "  - Gatekeeperによる評価"
    echo "  - DMGファイルの検証（存在する場合）"
    echo
}

# クイック検証（基本項目のみ）
quick_verification() {
    log_info "クイック検証を実行中..."
    
    check_prerequisites
    
    if check_signature && verify_stapler && check_gatekeeper; then
        log_success "クイック検証: 全て通過"
        return 0
    else
        log_error "クイック検証: 問題あり"
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
        quick_verification
        exit $?
        ;;
    --stapler|-s)
        log_info "Stapler検証のみ実行..."
        check_prerequisites
        verify_stapler
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