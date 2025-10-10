# Testing Guide: Session Takeover Feature

## Prerequisites
- Docker environment running (`make` or `docker-compose up`)
- Two different browsers or browser instances (e.g., Chrome and Firefox, or two Chrome windows in normal/incognito)

## Test Case 1: Basic Session Takeover

### Steps:
1. **Browser 1 - Initial Login:**
   - Navigate to the app
   - Register or login with a test account (e.g., `testuser`)
   - Verify you reach the main menu
   - Note: Keep this browser window open

2. **Browser 2 - New Login (Takeover):**
   - Navigate to the app in a different browser
   - Login with the SAME account (`testuser`)
   - Verify you reach the main menu successfully

3. **Browser 1 - Check Force Disconnect:**
   - Switch back to Browser 1
   - You should see the "SESSION DISCONNECTED" overlay
   - Verify the overlay displays:
     - Title: "SESSION DISCONNECTED"
     - Message explaining what happened
     - "RECONNECT" button

4. **Browser 1 - Reconnect:**
   - Click the "RECONNECT" button
   - Page should reload
   - **Expected Result:** You should be redirected to the **main menu** (NOT the login page)
   - Verify your username is displayed correctly

### ✅ Success Criteria:
- [ ] Browser 1 shows overlay immediately after Browser 2 logs in
- [ ] Overlay is blocking (cannot interact with app behind it)
- [ ] RECONNECT button reloads the page
- [ ] After reload, user is on main menu (not login page)
- [ ] All user data (username, avatar, stats) is correct

## Test Case 2: Multiple Rapid Logins

### Steps:
1. Have 3 browsers ready (or tabs in incognito mode)
2. Login from Browser 1 with `testuser`
3. Quickly login from Browser 2 with `testuser`
4. Quickly login from Browser 3 with `testuser`

### Expected Results:
- Browser 1: Shows disconnect overlay
- Browser 2: Shows disconnect overlay
- Browser 3: Remains connected and functional

### ✅ Success Criteria:
- [ ] No crashes or errors
- [ ] Only the most recent session remains active
- [ ] All previous sessions show the overlay

## Test Case 3: Reconnect with Expired Session

### Steps:
1. Login in Browser 1
2. Login in Browser 2 (Browser 1 shows overlay)
3. In Browser 2, manually logout
4. In Browser 1, click RECONNECT

### Expected Results:
- After clicking RECONNECT, session check should fail
- User should be redirected to the login page

### ✅ Success Criteria:
- [ ] User is redirected to login page
- [ ] No errors in console
- [ ] Login page displays correctly

## Test Case 4: Friend List Refresh Stop

### Steps:
1. Login in Browser 1
2. Add some friends (if you have friend list functionality)
3. Verify friend list is auto-refreshing (check network tab for periodic requests)
4. Login from Browser 2 with the same account
5. Check Browser 1

### Expected Results:
- Friend list auto-refresh should stop when overlay appears
- No more periodic friend list requests in network tab

### ✅ Success Criteria:
- [ ] Friend list refresh stops immediately
- [ ] No memory leaks or hanging requests

## Test Case 5: Cookie Persistence

### Steps:
1. Login in Browser 1
2. Open Developer Tools → Application → Cookies
3. Note the `jwt` cookie value
4. Login from Browser 2 (Browser 1 shows overlay)
5. Click RECONNECT in Browser 1
6. After reload, check cookies again

### Expected Results:
- JWT cookie should still be present after reload
- Cookie should have `SameSite=Lax` attribute
- Session should validate successfully

### ✅ Success Criteria:
- [ ] JWT cookie persists through reload
- [ ] Cookie settings are correct
- [ ] Session validation succeeds

## Test Case 6: Websocket Reconnection

### Steps:
1. Login in Browser 1
2. Open Developer Tools → Network → WS (WebSocket)
3. Verify websocket is connected
4. Login from Browser 2 (Browser 1 shows overlay)
5. Click RECONNECT in Browser 1
6. Check WS tab in Developer Tools

### Expected Results:
- Old websocket disconnects when overlay appears
- New websocket connects after page reload
- No duplicate connections

### ✅ Success Criteria:
- [ ] Only one websocket connection at a time
- [ ] Proper disconnect/reconnect cycle
- [ ] No websocket errors

## Common Issues and Solutions

### Issue: User redirected to login after RECONNECT
**Cause:** Session cookies not persisting
**Solution:** Verify `SameSite=lax` in `auth.ts` (not `strict`)

### Issue: Overlay not appearing
**Cause:** `forceDisconnect` event not received
**Solution:** Check backend socket handling in `socketAuth.ts`

### Issue: Can still interact with app behind overlay
**Cause:** CSS z-index issue
**Solution:** Verify overlay has high z-index in `components.css`

### Issue: Multiple websocket connections
**Cause:** Event listeners not cleaned up
**Solution:** Check `cleanupGameEventListeners()` is called

## Browser DevTools Console Commands

Test these in the browser console:

```javascript
// Check current user
window.currentUser

// Check websocket connection
window.socket.connected

// Manually trigger reconnect (for testing)
window.location.reload()

// Check cookies
document.cookie
```

## Success Summary

All tests should pass with the following expected behavior:
1. ✅ Old sessions get disconnected automatically
2. ✅ Clear overlay informs the user what happened
3. ✅ RECONNECT button works smoothly
4. ✅ Session persists through page reload
5. ✅ User returns to main menu (not login)
6. ✅ No errors, crashes, or weird behavior

## Performance Notes

- Session takeover should happen **instantly** (< 500ms)
- Page reload should complete in 1-2 seconds
- No noticeable lag or delays in the UI

## Next Steps After Testing

If all tests pass:
1. Commit the changes with a descriptive message
2. Update the main README.md if needed
3. Consider adding automated E2E tests for this flow
4. Deploy to staging for further testing

If any tests fail:
1. Check the browser console for errors
2. Review the implementation documentation
3. Verify all file changes were applied correctly
4. Test in a clean environment (clear cache, new DB)
