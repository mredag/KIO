# n8n Credentials

## n8n Admin Access

| Field | Value |
|-------|-------|
| URL | http://192.168.1.5:5678 |
| Email | admin@spa-kiosk.local |
| Password | Admin123! |

## Pi SSH Access

| Field | Value |
|-------|-------|
| Host | 192.168.1.5 |
| User | eform-kio |

## Backend API Key

```
dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=
```

## WhatsApp Business API Token

```
EAA9xzHZBdKVUBQHDw2PZBHTV9pD6cZAZAYCiWnQXWvazBxxUdUBgi8Tqq5RZBduzKYhF9BZBixZAj5eATHrAoEZClh5jhgmYtwBQRCJUC1ayFku4Etvp9zZBiR3UtF2tToRcPYhziaoZAa7ySrDffCDskivZAkMXq3S6aAQYtMx9mDTvuuX6KvrgYg7T8aDF7XMninQKAZDZD
```

---

## Imported Workflows

| Workflow | ID | Status |
|----------|-----|--------|
| WhatsApp Balance Check | Z7hznAe9tf5TzyGC | inactive |
| WhatsApp Claim Redemption | Ncgg7lbKWFUd00GT | inactive |
| WhatsApp Coupon Capture | MM0rlnDn2xOZQSbA | inactive |
| WhatsApp Opt-Out | qiCdgSvgQVnz5C3Z | inactive |

## Next Steps

1. Login to n8n at http://192.168.1.5:5678
2. Create credentials:
   - **Backend API Key** (Header Auth): `Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=`
   - **WhatsApp Business API** (Header Auth): `Authorization: Bearer <token>`
3. Link credentials to workflows
4. Activate workflows

---

**Last Updated:** 2025-11-29
**Status:** ✅ Workflows Imported
