# Guide de Test de Sécurité - ft_transcendence

## 🧪 Tests Rapides de Sécurité

Ce guide contient des tests manuels simples pour vérifier que les protections sont actives.

---

## 1. Test XSS (Cross-Site Scripting)

### Test Backend - Registration
```bash
# Essayer d'injecter du code dans le username
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "<script>alert(\"XSS\")</script>",
    "email": "test@test.com",
    "password": "Test1234!"
  }'

# ✅ Résultat attendu: Username sera nettoyé (scriptalertXSSscript ou vide)
```

### Test Backend - Search
```bash
# Essayer d'injecter du HTML dans la recherche
curl -X GET "http://localhost:3000/users/search?q=<img src=x onerror=alert(1)>" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN"

# ✅ Résultat attendu: Query sera nettoyée, pas d'exécution de code
```

### Test Frontend - Affichage de nom d'utilisateur
1. Créer un utilisateur avec un nom contenant des caractères spéciaux
2. Vérifier dans la liste d'amis que les `<` et `>` sont affichés comme `&lt;` et `&gt;`
3. ✅ Résultat attendu: Aucun code JavaScript ne s'exécute

---

## 2. Test SQL Injection

### Test sur Login
```bash
# Essayer une injection SQL classique
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "login": "admin\" OR \"1\"=\"1",
    "password": "anything"
  }'

# ✅ Résultat attendu: 401 Invalid credentials (pas d'accès)
```

### Test sur Search
```bash
# Essayer une injection dans la recherche
curl -X GET "http://localhost:3000/users/search?q=test' OR '1'='1" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN"

# ✅ Résultat attendu: Recherche normale, pas d'injection
```

---

## 3. Test Rate Limiting

### Test Login Brute Force
```bash
# Faire 6 tentatives de login rapidement
for i in {1..6}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"login": "test", "password": "wrong"}' \
    -w "\nAttempt $i: HTTP %{http_code}\n"
done

# ✅ Résultat attendu: 
# Attempts 1-5: 401 (Invalid credentials)
# Attempt 6: 429 (Too many requests)
```

### Test Room Creation Spam
```bash
# Créer 11 rooms rapidement
for i in {1..11}; do
  curl -X POST http://localhost:3000/rooms \
    -H "Content-Type: application/json" \
    -d '{"maxPlayers": 2}' \
    -w "\nRoom $i: HTTP %{http_code}\n"
done

# ✅ Résultat attendu:
# Rooms 1-10: 200 (Success)
# Room 11: 429 (Too many requests)
```

---

## 4. Test Validation d'ID

### Test ID Négatif
```bash
# Essayer un ID négatif
curl -X GET http://localhost:3000/users/-1/rank

# ✅ Résultat attendu: 400 Invalid user ID
```

### Test ID Non-Numérique
```bash
# Essayer un ID qui n'est pas un nombre
curl -X GET http://localhost:3000/users/abc/rank

# ✅ Résultat attendu: 400 Invalid user ID
```

### Test ID Avec Injection
```bash
# Essayer un ID avec tentative d'injection
curl -X GET "http://localhost:3000/users/1%20OR%201=1/rank"

# ✅ Résultat attendu: 400 Invalid user ID
```

---

## 5. Test Upload de Fichier

### Test Fichier Trop Grand (> 5MB)
```bash
# Créer un fichier de 6MB
dd if=/dev/zero of=big.jpg bs=1M count=6

# Essayer de l'uploader
curl -X POST http://localhost:3000/auth/avatar/upload \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -F "avatar=@big.jpg"

# ✅ Résultat attendu: 400 File too large (max 5MB)
```

### Test Fichier Non-Image
```bash
# Créer un fichier .exe déguisé en .jpg
echo "fake exe content" > malicious.jpg

curl -X POST http://localhost:3000/auth/avatar/upload \
  -H "Cookie: jwt=YOUR_JWT_TOKEN" \
  -F "avatar=@malicious.jpg"

# ✅ Résultat attendu: 400 Invalid file type
```

---

## 6. Test Validation de Room Name

### Test Caractères Invalides
```bash
# Essayer un nom avec caractères spéciaux
curl -X POST http://localhost:3000/rooms \
  -H "Content-Type: application/json" \
  -d '{"maxPlayers": 2, "roomPrefix": "../etc/passwd"}'

# ✅ Résultat attendu: 400 Invalid room prefix
```

### Test Caractères SQL
```bash
curl -X POST http://localhost:3000/rooms \
  -H "Content-Type: application/json" \
  -d '{"maxPlayers": 2, "roomPrefix": "room\"; DROP TABLE users--"}'

# ✅ Résultat attendu: 400 Invalid room prefix
```

---

## 7. Test Validation de MaxPlayers

### Test Nombre Invalide
```bash
# Essayer avec 3 joueurs (non permis)
curl -X POST http://localhost:3000/rooms \
  -H "Content-Type: application/json" \
  -d '{"maxPlayers": 3}'

# ✅ Résultat attendu: 400 Invalid maxPlayers (must be 2 or 4)
```

### Test Nombre Négatif
```bash
curl -X POST http://localhost:3000/rooms \
  -H "Content-Type: application/json" \
  -d '{"maxPlayers": -5}'

# ✅ Résultat attendu: 400 Invalid maxPlayers (must be 2 or 4)
```

---

## 8. Test Length Validation

### Test Username Trop Long
```bash
# Créer un username de 100 caractères
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "email": "test@test.com",
    "password": "Test1234!"
  }'

# ✅ Résultat attendu: 400 ou username tronqué
```

### Test Search Query Trop Longue
```bash
# Query de 200 caractères
curl -X GET "http://localhost:3000/users/search?q=$(python3 -c 'print(\"a\"*200)')" \
  -H "Cookie: jwt=YOUR_JWT_TOKEN"

# ✅ Résultat attendu: 400 Query too long
```

---

## 9. Test Match Score Validation

### Test Score Invalide (Winner < Loser)
```bash
curl -X POST http://localhost:3000/matches \
  -H "Content-Type: application/json" \
  -d '{
    "winnerUsername": "player1",
    "loserUsername": "player2",
    "winnerScore": 3,
    "loserScore": 5
  }'

# ✅ Résultat attendu: 400 Winner score must be higher than loser score
```

### Test Score Négatif
```bash
curl -X POST http://localhost:3000/matches \
  -H "Content-Type: application/json" \
  -d '{
    "winnerUsername": "player1",
    "loserUsername": "player2",
    "winnerScore": -5,
    "loserScore": 3
  }'

# ✅ Résultat attendu: 400 Invalid scores
```

---

## 10. Test Tournament Validation

### Test Nom avec HTML
```bash
curl -X POST http://localhost:3000/tournaments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<h1>Pwned</h1>",
    "maxPlayers": 8
  }'

# ✅ Résultat attendu: Nom sera nettoyé (h1Pwnedh1 ou Pwned)
```

### Test MaxPlayers Invalide
```bash
curl -X POST http://localhost:3000/tournaments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Tournament",
    "maxPlayers": 10
  }'

# ✅ Résultat attendu: 400 Max players must be 4, 6, or 8
```

---

## 📋 Checklist Rapide

Tester chaque catégorie et cocher :

- [ ] XSS Protection (Backend + Frontend)
- [ ] SQL Injection Protection
- [ ] Rate Limiting (Login + Room Creation)
- [ ] ID Validation (négatifs, strings, injection)
- [ ] File Upload Validation
- [ ] Room Name Validation
- [ ] MaxPlayers Validation
- [ ] Length Validation
- [ ] Match Score Validation
- [ ] Tournament Validation

---

## 🔍 Outils Automatisés Recommandés

Pour des tests plus approfondis, utiliser :

### OWASP ZAP
```bash
# Scanner automatique de vulnérabilités
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3000
```

### SQLMap
```bash
# Test automatique d'injection SQL
sqlmap -u "http://localhost:3000/users/search?q=test" \
  --cookie="jwt=YOUR_JWT" \
  --level=5 --risk=3
```

### Burp Suite
- Intercepter les requêtes
- Fuzzer les paramètres
- Tester les injections

---

## ✅ Résultats Attendus

Si tous les tests passent avec les résultats attendus :
- ✅ Le projet est bien protégé contre XSS
- ✅ Le projet est bien protégé contre SQL Injection
- ✅ Le rate limiting fonctionne
- ✅ Les validations d'input fonctionnent
- ✅ Les uploads de fichiers sont sécurisés

---

**Note**: Remplacer `YOUR_JWT_TOKEN` par un vrai token JWT obtenu après login.
**Note**: Adapter `localhost:3000` au port et host de votre environnement.
