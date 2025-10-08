#!/bin/bash
set -e

# Shunyaku v2 - Full Signing & Notarization Process
# 作成日: 2025-10-08
# 目的: ビルド→署名→公証→検証の全プロセスを統合実行

echo "🚀 Shunyaku v2 - Full Signing & Notarization Process"
echo "===================================================="

# カラー設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
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

log_step() {
    echo
    echo -e "${BOLD}${BLUE}🔹 ${1}${NC}"
    echo "----------------------------------------"
}

# エラーハンドラー
handle_error() {
    local line_number=$1
    log_error "プロセス中にエラーが発生しました (line: $line_number)"
    log_error "全プロセスを中断します"
    exit 1
}

trap 'handle_error $LINENO' ERR

# 前提条件チェック
check_prerequisites() {
    log_step "前提条件確認"
    
    local missing_tools=()
    
    # 必須コマンドチェック
    for cmd in npm codesign xcrun spctl hdiutil; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_tools+=("$cmd")
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "以下のコマンドが見つかりません: ${missing_tools[*]}"
        log_info "必要なツールをインストールしてください"
        exit 1
    fi
    
    # 必須環境変数チェック（公証用）
    local missing_env=()
    
    if [ -z "${NOTARIZE_API_KEY:-}" ]; then
        missing_env+=("NOTARIZE_API_KEY")
    fi
    
    if [ -z "${NOTARIZE_API_ISSUER:-}" ]; then
        missing_env+=("NOTARIZE_API_ISSUER")
    fi
    
    if [ -z "${NOTARIZE_API_KEY_FILE:-}" ]; then
        missing_env+=("NOTARIZE_API_KEY_FILE")
    fi
    
    if [ ${#missing_env[@]} -gt 0 ]; then
        log_warning "公証用環境変数が未設定: ${missing_env[*]}"
        log_info "公証をスキップするか、環境変数を設定してください"
        
        # 公証スキップオプションがある場合は継続
        if [ "${SKIP_NOTARIZATION:-}" = "true" ]; then
            log_warning "公証をスキップして続行します"
        else
            log_error "公証を実行するには環境変数の設定が必要です"
            exit 1
        fi
    fi
    
    log_success "前提条件チェック完了"
}

# ステップ1: アプリケーションビルド
step_build() {
    log_step "Step 1: アプリケーションビルド"
    
    log_info "npm dependencies を確認中..."
    if [ ! -d "node_modules" ]; then
        log_info "依存関係をインストール中..."
        npm install
    fi
    
    log_info "macOS用アプリケーションをビルド中..."
    npm run build:mac
    
    # ビルド結果確認
    if [ -d "dist/mac/Shunyaku v2.app" ]; then
        log_success "アプリケーションビルド完了"
    else
        log_error "ビルドに失敗しました"
        exit 1
    fi
}

# ステップ2: コード署名
step_codesign() {
    log_step "Step 2: コード署名"
    
    log_info "codesign スクリプトを実行中..."
    
    if ./scripts/codesign.sh; then
        log_success "コード署名完了"
    else
        log_error "コード署名に失敗しました"
        exit 1
    fi
}

# ステップ3: 公証（オプション）
step_notarize() {
    if [ "${SKIP_NOTARIZATION:-}" = "true" ]; then
        log_step "Step 3: 公証（スキップ）"
        log_warning "公証プロセスをスキップします"
        return 0
    fi
    
    log_step "Step 3: 公証"
    
    log_info "notarize スクリプトを実行中..."
    log_warning "公証プロセスは数分かかる場合があります..."
    
    if ./scripts/notarize.sh; then
        log_success "公証完了"
    else
        log_error "公証に失敗しました"
        
        # 公証失敗時の継続オプション
        if [ "${CONTINUE_ON_NOTARIZE_ERROR:-}" = "true" ]; then
            log_warning "公証エラーを無視して続行します"
        else
            exit 1
        fi
    fi
}

# ステップ4: DMG作成
step_create_dmg() {
    log_step "Step 4: DMG作成"
    
    log_info "DMGパッケージを作成中..."
    
    # 既存のDMGを削除
    if [ -f "dist/Shunyaku-v2.dmg" ]; then
        rm -f "dist/Shunyaku-v2.dmg"
        log_info "既存のDMGファイルを削除しました"
    fi
    
    # electron-builderでDMG作成
    npm run build:dmg
    
    # DMG作成確認
    if [ -f "dist/Shunyaku-v2.dmg" ]; then
        log_success "DMG作成完了"
        
        # ファイルサイズ表示
        local file_size=$(ls -lh "dist/Shunyaku-v2.dmg" | awk '{print $5}')
        log_info "DMGファイルサイズ: $file_size"
    else
        log_error "DMG作成に失敗しました"
        exit 1
    fi
}

# ステップ5: 包括検証
step_verify() {
    log_step "Step 5: 包括検証"
    
    log_info "署名・公証状態を検証中..."
    
    # アプリケーション検証
    if ./scripts/verify-notarization.sh --quick; then
        log_success "アプリケーション検証: 通過"
    else
        log_error "アプリケーション検証: 失敗"
        exit 1
    fi
    
    # DMGテスト
    log_info "DMGテストを実行中..."
    if ./scripts/test-signed-dmg.sh --quick; then
        log_success "DMGテスト: 通過"
    else
        log_error "DMGテスト: 失敗"
        exit 1
    fi
}

# 最終レポート
generate_final_report() {
    log_step "最終レポート"
    
    echo "🎉 全プロセス完了!"
    echo ""
    echo "📦 成果物:"
    echo "  アプリケーション: dist/mac/Shunyaku v2.app"
    if [ -f "dist/Shunyaku-v2.dmg" ]; then
        echo "  DMGパッケージ: dist/Shunyaku-v2.dmg"
    fi
    
    echo ""
    echo "✅ 完了した処理:"
    echo "  1. アプリケーションビルド"
    echo "  2. コード署名"
    if [ "${SKIP_NOTARIZATION:-}" != "true" ]; then
        echo "  3. 公証"
    else
        echo "  3. 公証 (スキップ)"
    fi
    echo "  4. DMG作成"
    echo "  5. 包括検証"
    
    echo ""
    echo "🚀 配布準備完了!"
    echo "  DMGファイルをダウンロードしてインストールテストを実行してください"
    
    if [ -f "dist/Shunyaku-v2.dmg" ]; then
        local file_size=$(ls -lh "dist/Shunyaku-v2.dmg" | awk '{print $5}')
        echo "  ファイルサイズ: $file_size"
    fi
    
    echo ""
    echo "⏰ 処理完了時刻: $(date)"
}

# メイン処理
main() {
    local start_time=$(date)
    
    echo
    log_info "Full Signing Process 開始: $start_time"
    echo
    
    # 各ステップを順次実行
    check_prerequisites
    step_build
    step_codesign
    step_notarize
    step_create_dmg
    step_verify
    
    generate_final_report
}

# ヘルプ表示
show_help() {
    echo "Shunyaku v2 - Full Signing & Notarization Process"
    echo "================================================="
    echo
    echo "使用方法:"
    echo "  ./scripts/full-signing-process.sh              # 全プロセス実行"
    echo "  ./scripts/full-signing-process.sh --help       # ヘルプ表示"
    echo
    echo "環境変数オプション:"
    echo "  SKIP_NOTARIZATION=true           公証をスキップ"
    echo "  CONTINUE_ON_NOTARIZE_ERROR=true  公証エラー時も継続"
    echo
    echo "必須環境変数（公証用）:"
    echo "  NOTARIZE_API_KEY        App Store Connect APIキーID"
    echo "  NOTARIZE_API_ISSUER     App Store Connect API Issuer ID"
    echo "  NOTARIZE_API_KEY_FILE   APIキーファイル(.p8)のパス"
    echo
    echo "実行例:"
    echo "  # 通常実行（公証あり）"
    echo "  export NOTARIZE_API_KEY=\"XXXXXXXXXX\""
    echo "  export NOTARIZE_API_ISSUER=\"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\""
    echo "  export NOTARIZE_API_KEY_FILE=\"~/private_keys/AuthKey_XXXXXXXXXX.p8\""
    echo "  ./scripts/full-signing-process.sh"
    echo
    echo "  # 公証スキップ実行"
    echo "  SKIP_NOTARIZATION=true ./scripts/full-signing-process.sh"
    echo
    echo "プロセス内容:"
    echo "  1. アプリケーションビルド (npm run build:mac)"
    echo "  2. コード署名 (./scripts/codesign.sh)"
    echo "  3. 公証 (./scripts/notarize.sh)"
    echo "  4. DMG作成 (npm run build:dmg)"
    echo "  5. 包括検証 (署名・公証・DMGテスト)"
    echo
}

# コマンドライン引数処理
case "${1:-}" in
    --help|-h)
        show_help
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