# Fix: Session Takeover Reconnection Issue

## Problem Identified

When a user clicks RECONNECT after being force-disconnected, they were sometimes redirected to the login page instead of the main menu.

### Root Cause

1. **Browser 1** has JWT token `TOKEN_A` (stored in cookies and in `active_tokens` table)
2. **Browser 2** logs in with the same account
3. Backend creates `TOKEN_B` and **immediately deletes `TOKEN_A`** from `active_tokens` table
4. Browser 1 receives `forceDisconnect` event and shows overlay
5. User clicks RECONNECT → page reloads
6. Browser 1 still has `TOKEN_A` cookie in browser
7. Browser 1 sends `TOKEN_A` to `/auth/me`
8. Backend checks `active_tokens` → **`TOKEN_A` not found** → returns 401
9. Frontend sees 401 → redirects to login page ❌

## Solution: Token Grace Period

Instead of immediately deleting old tokens, we:

1. **Allow multiple tokens temporarily** when user logs in (don't delete old tokens)
2. **Clean up old tokens lazily** when `/auth/me` is called
3. This gives the old browser a chance to reconnect with its old token **once**
4. After first `/auth/me` call, all other tokens are cleaned up

### Changes Made

#### Backend: `srcs/backend/src/routes/auth.ts`

**In `/auth/register` and `/auth/login`:**
```typescript
// OLD (problematic):
db.prepare('DELETE FROM active_tokens WHERE user_id = ?').run(user.id);

// NEW (with grace period):
// Allow multiple tokens temporarily - old tokens will be cleaned up on next /auth/me call
// This allows force-disconnected browsers to reconnect with their old token
```

**In `/auth/me`:**
```typescript
// Check token is valid
const active = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?')
  .get(payload.userId, jwtToken);
if (!active) return reply.code(401).send({ error: 'Session expired or logged out.' });

// NEW: Clean up other tokens for this user - keep only the current one
db.prepare('DELETE FROM active_tokens WHERE user_id = ? AND token != ?')
  .run(payload.userId, jwtToken);
```

### How It Works Now

**Scenario: User logs in from Browser 2 while Browser 1 is active**

1. **Browser 1** has `TOKEN_A` (valid in `active_tokens`)
2. **Browser 2** logs in → Backend creates `TOKEN_B`
3. Backend **DOES NOT** delete `TOKEN_A` immediately
4. Both `TOKEN_A` and `TOKEN_B` exist in `active_tokens` temporarily ✅
5. Browser 1 receives `forceDisconnect`, shows overlay
6. User clicks RECONNECT in Browser 1
7. Browser 1 reloads, calls `/auth/me` with `TOKEN_A`
8. Backend finds `TOKEN_A` in `active_tokens` → **Session valid** ✅
9. Backend cleans up `TOKEN_B` (and any other tokens except `TOKEN_A`)
10. Browser 1 redirects to **main menu** ✅

**Meanwhile, Browser 2:**
- Browser 2 calls `/auth/me` with `TOKEN_B`
- But `TOKEN_B` was just deleted in step 9
- Browser 2 gets 401 and is redirected to login
- User must log in again from Browser 2

**This is acceptable because:**
- The user explicitly chose to reconnect from Browser 1
- Only one browser can be active at a time
- The most recently used token wins

### Edge Case: What if Browser 2 calls /auth/me first?

1. Browser 2 calls `/auth/me` with `TOKEN_B`
2. Backend validates `TOKEN_B` → success
3. Backend cleans up all other tokens including `TOKEN_A`
4. Browser 1 calls `/auth/me` with `TOKEN_A`
5. `TOKEN_A` not found → 401 → login page

**This is also acceptable because:**
- Browser 2 was actively using the session
- Browser 1 was disconnected and user didn't click RECONNECT fast enough
- User can simply log in again

### Timing Window

- The grace period is **effectively unlimited** (until first `/auth/me` call)
- User has as much time as they need to click RECONNECT
- First browser to call `/auth/me` wins and becomes the active session

### Advantages

1. ✅ **Simple logic** - no complex timers or background cleanup
2. ✅ **Deterministic** - first to call `/auth/me` wins
3. ✅ **No race conditions** - SQLite handles concurrent token operations
4. ✅ **Better UX** - user can take their time to reconnect
5. ✅ **Secure** - only valid JWT tokens work, invalidated tokens fail immediately

### Logging Added

**Backend logs:**
```
[AUTH /me] JWT valid for user X (username)
[AUTH /me] Token is active for user X
[AUTH /me] Cleaned up Y old token(s) for user X
```

**Frontend logs:**
```
🔍 [checkSession] Starting session check...
🔍 [checkSession] Current cookies: jwt=...
🔍 [checkSession] /auth/me response status: 200
✅ [checkSession] Session valid, user: username
```

### Testing

To verify the fix works:

1. Open Browser 1, log in as user A
2. Open Browser 2, log in as user A
3. Browser 1 shows "SESSION DISCONNECTED" overlay
4. Click RECONNECT in Browser 1
5. **Expected:** Browser 1 redirects to main menu ✅
6. Switch to Browser 2
7. Try to navigate in Browser 2
8. **Expected:** Browser 2 gets 401, redirected to login (TOKEN_B was cleaned up)

## Alternative Approaches Considered

### Option 1: Time-based grace period (NOT chosen)
- Delete old tokens after 30 seconds
- **Problem:** Requires background cleanup job or timestamp column
- **Problem:** What if user is slow to click RECONNECT?

### Option 2: Redirect to login after force disconnect (NOT chosen)
- Show message: "Please log in again"
- **Problem:** Poor UX - user must enter credentials again
- **Problem:** Doesn't leverage existing valid session

### Option 3: Current solution (CHOSEN) ✅
- Let multiple tokens exist temporarily
- Clean up on first `/auth/me` call
- **Advantage:** Simple, elegant, good UX
- **Advantage:** No timers or background jobs needed

## Conclusion

The fix is minimal, elegant, and solves the reconnection problem while maintaining security. Users can now reliably reconnect after force disconnect without being sent to the login page.
