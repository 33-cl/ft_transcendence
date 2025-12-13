#!/bin/bash

# ===========================================
# SCRIPT DE TEST DE SÉCURITÉ / FUZZING API
# ===========================================
# Ce script teste les endpoints avec des données invalides
# pour vérifier que l'API ne crashe pas et retourne des erreurs propres

BASE_URL="https://localhost/api"
CURL_OPTS="-s -k -w '\nHTTP_CODE:%{http_code}'"

# Couleurs pour la sortie
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

passed=0
failed=0

# Fonction pour tester un endpoint
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local description="$4"
    
    echo -n "Testing: $description... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl $CURL_OPTS -X GET "$BASE_URL$endpoint" 2>/dev/null)
    elif [ "$method" == "POST" ]; then
        response=$(curl $CURL_OPTS -X POST "$BASE_URL$endpoint" -H "Content-Type: application/json" -d "$data" 2>/dev/null)
    elif [ "$method" == "PUT" ]; then
        response=$(curl $CURL_OPTS -X PUT "$BASE_URL$endpoint" -H "Content-Type: application/json" -d "$data" 2>/dev/null)
    elif [ "$method" == "DELETE" ]; then
        response=$(curl $CURL_OPTS -X DELETE "$BASE_URL$endpoint" 2>/dev/null)
    fi
    
    # Extraire le code HTTP
    http_code=$(echo "$response" | grep -o 'HTTP_CODE:[0-9]*' | cut -d':' -f2)
    
    # Vérifier que le serveur n'a pas crashé (500 = crash, 4xx = erreur gérée)
    if [ -z "$http_code" ]; then
        echo -e "${RED}FAIL${NC} - No response (server crashed?)"
        ((failed++))
    elif [ "$http_code" -ge 500 ]; then
        echo -e "${RED}FAIL${NC} - Server error $http_code"
        ((failed++))
    elif [ "$http_code" -ge 400 ] && [ "$http_code" -lt 500 ]; then
        echo -e "${GREEN}PASS${NC} - Rejected with $http_code (expected)"
        ((passed++))
    else
        echo -e "${YELLOW}WARN${NC} - Unexpected success $http_code"
        ((passed++))
    fi
}

echo "=============================================="
echo "   TESTS DE SÉCURITÉ / FUZZING API"
echo "=============================================="
echo ""

# ===========================================
# TESTS AUTH - REGISTER
# ===========================================
echo -e "\n${YELLOW}=== AUTH REGISTER ===${NC}"

test_endpoint "POST" "/auth/register" '{}' "Empty body"
test_endpoint "POST" "/auth/register" '{"email":""}' "Empty email"
test_endpoint "POST" "/auth/register" '{"email":"notanemail"}' "Invalid email format"
test_endpoint "POST" "/auth/register" '{"email":"<script>alert(1)</script>@test.com"}' "XSS in email"
test_endpoint "POST" "/auth/register" '{"email":"test@test.com","username":""}' "Empty username"
test_endpoint "POST" "/auth/register" '{"email":"test@test.com","username":"ab"}' "Username too short"
test_endpoint "POST" "/auth/register" '{"email":"test@test.com","username":"verylongusernamethatexceedslimit"}' "Username too long"
test_endpoint "POST" "/auth/register" '{"email":"test@test.com","username":"<script>"}' "XSS in username"
test_endpoint "POST" "/auth/register" '{"email":"test@test.com","username":"test","password":""}' "Empty password"
test_endpoint "POST" "/auth/register" '{"email":"test@test.com","username":"test","password":"short"}' "Password too short"
test_endpoint "POST" "/auth/register" '{"email":null,"username":null,"password":null}' "Null values"
test_endpoint "POST" "/auth/register" '{"email":123,"username":456,"password":789}' "Number values instead of strings"
test_endpoint "POST" "/auth/register" '{"email":[],"username":{},"password":true}' "Wrong types"
test_endpoint "POST" "/auth/register" "not json at all" "Invalid JSON"

# ===========================================
# TESTS AUTH - LOGIN
# ===========================================
echo -e "\n${YELLOW}=== AUTH LOGIN ===${NC}"

test_endpoint "POST" "/auth/login" '{}' "Empty body"
test_endpoint "POST" "/auth/login" '{"email":"","password":""}' "Empty credentials"
test_endpoint "POST" "/auth/login" '{"email":"nonexistent@test.com","password":"wrongpassword"}' "Invalid credentials"
test_endpoint "POST" "/auth/login" '{"email":"test@test.com"}' "Missing password"
test_endpoint "POST" "/auth/login" '{"password":"test"}' "Missing email"
test_endpoint "POST" "/auth/login" '{"email":"' OR 1=1 --","password":"test"}' "SQL injection in email"
test_endpoint "POST" "/auth/login" '{"email":"test","password":"' OR 1=1 --"}' "SQL injection in password"

# ===========================================
# TESTS USERS
# ===========================================
echo -e "\n${YELLOW}=== USERS ===${NC}"

test_endpoint "GET" "/users/-1" "N/A" "Negative user ID"
test_endpoint "GET" "/users/0" "N/A" "Zero user ID"
test_endpoint "GET" "/users/999999999" "N/A" "Non-existent user ID"
test_endpoint "GET" "/users/abc" "N/A" "String instead of ID"
test_endpoint "GET" "/users/<script>" "N/A" "XSS in user ID"
test_endpoint "GET" "/users/1; DROP TABLE users;" "N/A" "SQL injection in URL"
test_endpoint "GET" "/users/search?q=" "N/A" "Empty search query"
test_endpoint "GET" "/users/search?q=<script>alert(1)</script>" "N/A" "XSS in search"
test_endpoint "GET" "/users/search?q=' OR 1=1 --" "N/A" "SQL injection in search"

# ===========================================
# TESTS FRIEND REQUESTS
# ===========================================
echo -e "\n${YELLOW}=== FRIEND REQUESTS ===${NC}"

test_endpoint "POST" "/users/-1/friend" '{}' "Negative friend ID"
test_endpoint "POST" "/users/abc/friend" '{}' "Invalid friend ID"
test_endpoint "POST" "/users/friend-requests/abc/accept" '{}' "Invalid request ID accept"
test_endpoint "POST" "/users/friend-requests/-1/reject" '{}' "Negative request ID reject"

# ===========================================
# TESTS TOURNAMENTS
# ===========================================
echo -e "\n${YELLOW}=== TOURNAMENTS ===${NC}"

test_endpoint "POST" "/tournaments" '{}' "Empty tournament body"
test_endpoint "POST" "/tournaments" '{"name":""}' "Empty tournament name"
test_endpoint "POST" "/tournaments" '{"name":"<script>alert(1)</script>"}' "XSS in tournament name"
test_endpoint "POST" "/tournaments" '{"name":"test","maxPlayers":-1}' "Negative max players"
test_endpoint "POST" "/tournaments" '{"name":"test","maxPlayers":"abc"}' "String max players"
test_endpoint "GET" "/tournaments/abc" "N/A" "Invalid tournament ID"
test_endpoint "GET" "/tournaments/-1" "N/A" "Negative tournament ID"
test_endpoint "POST" "/tournaments/abc/join" '{}' "Invalid tournament ID join"
test_endpoint "POST" "/tournaments/1/join" '{"userId":"<script>"}' "XSS in join body"

# ===========================================
# TESTS MATCHES
# ===========================================
echo -e "\n${YELLOW}=== MATCHES ===${NC}"

test_endpoint "GET" "/matches/history/-1" "N/A" "Negative user ID"
test_endpoint "GET" "/matches/history/abc" "N/A" "Invalid user ID"
test_endpoint "GET" "/matches/history/<script>" "N/A" "XSS in match history"

# ===========================================
# TESTS 2FA
# ===========================================
echo -e "\n${YELLOW}=== 2FA ===${NC}"

test_endpoint "POST" "/auth/2fa/verify" '{}' "Empty 2FA body"
test_endpoint "POST" "/auth/2fa/verify" '{"code":""}' "Empty 2FA code"
test_endpoint "POST" "/auth/2fa/verify" '{"code":"<script>"}' "XSS in 2FA code"
test_endpoint "POST" "/auth/2fa/verify" '{"code":"123456789012345"}' "Too long 2FA code"
test_endpoint "POST" "/auth/2fa/verify" '{"code":123456}' "Number instead of string"

# ===========================================
# TESTS AVATAR
# ===========================================
echo -e "\n${YELLOW}=== AVATAR ===${NC}"

test_endpoint "POST" "/auth/avatar/save" '{}' "Empty avatar body"
test_endpoint "POST" "/auth/avatar/save" '{"avatar":"not-a-base64"}' "Invalid base64"
test_endpoint "POST" "/auth/avatar/save" '{"avatar":"<script>alert(1)</script>"}' "XSS in avatar"

# ===========================================
# TESTS WEBSOCKET MESSAGES (via console du navigateur)
# ===========================================
echo -e "\n${YELLOW}=== WEBSOCKET TESTS (manual) ===${NC}"
echo "Pour tester les WebSockets, ouvrez la console du navigateur et exécutez :"
echo ""
echo "// Test messages invalides"
echo "socket.emit('keydown', null);"
echo "socket.emit('keydown', {});"
echo "socket.emit('keydown', {player: 'INVALID', direction: 'WRONG'});"
echo "socket.emit('keydown', {player: '<script>', direction: 'up'});"
echo "socket.emit('joinRoom', null);"
echo "socket.emit('joinRoom', {roomName: '<script>alert(1)</script>'});"
echo "socket.emit('createRoom', {maxPlayers: -1});"
echo "socket.emit('createRoom', {maxPlayers: 999999});"
echo ""

# ===========================================
# RÉSUMÉ
# ===========================================
echo ""
echo "=============================================="
echo "   RÉSUMÉ DES TESTS"
echo "=============================================="
echo -e "Tests passés: ${GREEN}$passed${NC}"
echo -e "Tests échoués: ${RED}$failed${NC}"
echo ""

if [ $failed -gt 0 ]; then
    echo -e "${RED}⚠️  Certains tests ont échoué ! Vérifiez les erreurs ci-dessus.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Tous les tests sont passés ! L'API gère correctement les entrées invalides.${NC}"
    exit 0
fi
