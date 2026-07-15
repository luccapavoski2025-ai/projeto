# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend
```
API=https://educrm-10.preview.emergentagent.com/api
TOKEN=<paste session_token>
curl -X GET "$API/auth/me" -H "Authorization: Bearer $TOKEN"
```

## Step 3: Browser Testing
```
await page.context.add_cookies([{
  "name": "session_token", "value": "TOKEN",
  "domain": "educrm-10.preview.emergentagent.com",
  "path": "/", "httpOnly": True, "secure": True, "sameSite": "None"
}])
await page.goto("https://educrm-10.preview.emergentagent.com/dashboard")
```

## Cleanup
```
mongosh --eval "
use('test_database');
db.users.deleteMany({email: /test\.user\./});
db.user_sessions.deleteMany({session_token: /test_session/});
"
```
