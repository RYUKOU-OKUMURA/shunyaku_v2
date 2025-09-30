#!/bin/bash

# Certificate Expiry Checker for Shunyaku v2
# 証明書の有効期限確認スクリプト
# 作成日: 2025-09-30

set -e

echo "🔐 Shunyaku v2 - Certificate Expiry Checker"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ Error: This script must be run on macOS${NC}"
    echo "   Current OS: $OSTYPE"
    exit 1
fi

echo -e "${BLUE}📋 Checking Developer ID certificates...${NC}"
echo ""

# Function to check certificate expiry
check_certificate() {
    local cert_name="$1"
    local cert_type="$2"
    
    echo -e "${YELLOW}🔍 Checking: $cert_type${NC}"
    
    # Find certificate
    if security find-certificate -c "$cert_name" -p > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Certificate found: $cert_name${NC}"
        
        # Get certificate details
        local cert_info=$(security find-certificate -c "$cert_name" -p | openssl x509 -text -noout 2>/dev/null)
        
        if [ $? -eq 0 ]; then
            # Extract expiry date
            local not_after=$(echo "$cert_info" | grep "Not After" | sed 's/.*Not After : //')
            local expiry_timestamp=$(date -j -f "%b %d %H:%M:%S %Y %Z" "$not_after" +%s 2>/dev/null)
            local current_timestamp=$(date +%s)
            
            if [ $? -eq 0 ]; then
                echo "   📅 Expires: $not_after"
                
                # Calculate days until expiry
                local days_diff=$(( ($expiry_timestamp - $current_timestamp) / 86400 ))
                
                if [ $days_diff -lt 0 ]; then
                    echo -e "   ${RED}⚠️  EXPIRED ($((0 - $days_diff)) days ago)${NC}"
                elif [ $days_diff -lt 30 ]; then
                    echo -e "   ${YELLOW}⚠️  Expires soon ($days_diff days)${NC}"
                elif [ $days_diff -lt 90 ]; then
                    echo -e "   ${YELLOW}⏰ Expires in $days_diff days${NC}"
                else
                    echo -e "   ${GREEN}✅ Valid for $days_diff days${NC}"
                fi
            else
                echo -e "   ${YELLOW}⚠️  Could not parse expiry date${NC}"
            fi
        else
            echo -e "   ${YELLOW}⚠️  Could not read certificate details${NC}"
        fi
    else
        echo -e "${RED}❌ Certificate not found: $cert_name${NC}"
    fi
    echo ""
}

# Check Developer ID Application certificate
check_certificate "Developer ID Application" "Application Signing Certificate"

# Check Developer ID Installer certificate  
check_certificate "Developer ID Installer" "Installer Signing Certificate"

# Summary
echo -e "${BLUE}📊 Summary${NC}"
echo "=========="

# Count certificates
app_cert_count=$(security find-identity -v -p codesigning | grep "Developer ID Application" | wc -l | tr -d ' ')
installer_cert_count=$(security find-identity -v -p codesigning | grep "Developer ID Installer" | wc -l | tr -d ' ')

echo "Developer ID Application certificates: $app_cert_count"
echo "Developer ID Installer certificates: $installer_cert_count"

if [ "$app_cert_count" -gt 0 ] && [ "$installer_cert_count" -gt 0 ]; then
    echo -e "${GREEN}✅ All required certificates are present${NC}"
else
    echo -e "${RED}❌ Missing required certificates${NC}"
    echo ""
    echo "Required for Electron app distribution:"
    echo "- Developer ID Application (for .app signing)"
    echo "- Developer ID Installer (for .pkg signing)"
fi

echo ""
echo "💡 To obtain certificates, visit:"
echo "   https://developer.apple.com/account/resources/certificates/list"
echo ""
echo -e "${BLUE}📝 For detailed setup instructions, see docs/signing.md${NC}"