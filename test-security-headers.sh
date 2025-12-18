#!/bin/bash

# Script pour tester les headers de sécurité
# Usage: ./test-security-headers.sh

echo "=== Testing Security Headers on https://localhost:3000 ==="
echo ""

# Test headers sur la page principale
echo "📋 Headers on main page (/):"
curl -sSk -I https://localhost:3000/ 2>&1 | grep -E "(Cross-Origin|X-Frame|X-Content-Type|Referrer-Policy)"
echo ""

# Test headers sur l'API backend
echo "📋 Headers on backend (/users):"
curl -sSk -I https://localhost:3000/users 2>&1 | grep -E "(Cross-Origin|X-Frame|X-Content-Type|Referrer-Policy)"
echo ""

# Test headers OAuth
echo "📋 Headers on OAuth endpoint (/auth/google):"
curl -sSk -I https://localhost:3000/auth/google 2>&1 | grep -E "(Cross-Origin|X-Frame|X-Content-Type|Referrer-Policy)"
echo ""

echo "✅ Expected headers:"
echo "   - Cross-Origin-Opener-Policy: same-origin-allow-popups"
echo "   - Cross-Origin-Embedder-Policy: require-corp"
echo "   - X-Frame-Options: DENY or SAMEORIGIN"
echo "   - X-Content-Type-Options: nosniff"
echo "   - Referrer-Policy: strict-origin-when-cross-origin"
