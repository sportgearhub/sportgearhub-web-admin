# Sportgearhub Admin Web Integration

This is the single structured API integration file for the admin web console.

Use this file for endpoint wiring and admin-specific auth payloads. Keep deployment details in `docs/deployment.md`.

## App Identity

The admin web console is hosted at:

```text
https://admin.sportgearhub.ru
```

When an admin auth flow asks the API to send an email link, use:

```json
{
  "app": "admin"
}
```

The API maps this app value to its backend-owned `Email:AdminConsoleBaseUrl` setting. Do not send arbitrary return URLs from the web app.

## Password Reset

```http
POST /api/v1/auth/password/forgot
```

Request:

```json
{
  "email": "admin@example.com",
  "app": "admin"
}
```

Frontend behavior:

- always show generic success copy
- expect email links to land on `/auth/reset-password?token=...`
- complete the reset with `POST /api/v1/auth/password/reset`

## Email Verification

Admin users are normally bootstrapped by backend configuration, not registered by the admin web app.

If an admin verification resend screen is ever needed, use:

```http
POST /api/v1/auth/email/verification
```

Request:

```json
{
  "email": "admin@example.com",
  "app": "admin"
}
```

Expected callback route:

```text
/auth/verify-email?token=...
```
