# Tencent Cloud IM Channel Plugin for OpenClaw

Maintainer: longyuqi@tencent.com

Status: Tencent Cloud IM intelligent bot via webhooks + REST API.

**We've published a full integration tutorial on our WeChat Official Account (微信公众号): [Full integration guide](https://mp.weixin.qq.com/s/6iq-w023LGuYr6N9SR_kvw)**

## Install

### Option A: Install from npm
```bash
openclaw plugins install timbot
```

### Option B: Local development (link)
```bash
git clone <repo-url> && cd timbot
pnpm install && pnpm build
bash install-timbot.sh
```

## Quick Start

### Step 1: Create IM App and Get Credentials

1. Go to [Tencent Cloud IM Console](https://console.cloud.tencent.com/im)
2. Click **Create Application**, enter a name, select **China** data center
3. In the app detail page, record:
   - **SDKAppID** — unique app identifier
   - **SecretKey** — key for generating UserSig

### Step 2: Create Bot Account and Configure Callbacks

1. In the IM console sidebar, click **REST API Debug**
2. Select your app → **Bot → Create Bot**, set UserID / Nick / FaceUrl, then submit
3. In the sidebar, click **Callback Configuration → Chat**:
   - **URL**: `http://<your-server-ip>:18789/timbot`
   - Check **Enable Authentication**
   - **Token**: a custom string (e.g. `mysecrettoken`)
   - Check **Bot Event Callback** under Bot Events

### Step 3: Configure and Activate

#### Interactive Setup (Recommended)

```bash
openclaw onboard
```

Select **Tencent IM (plugin)** in the channel list, then follow the prompts to enter SDKAppID, SecretKey, and Token.

### Step 4: Open Network Access

```bash
openclaw config set gateway.bind lan
openclaw gateway restart
```

Ensure port **18789** is open in your server firewall.

### Step 5: Verify

Send a message to the bot through your IM client. If the bot responds, the integration is working.

## Configuration Options

| Option | Description |
|--------|-------------|
| `webhookPath` | Webhook endpoint path (default: `/timbot`) |
| `sdkAppId` | Tencent Cloud IM SDK App ID |
| `secretKey` | Secret key for generating UserSig |
| `botAccount` | Bot account ID |
| `apiDomain` | Tencent IM API domain (default: `console.tim.qq.com`) |
| `token` | Callback token for signature verification |
| `welcomeText` | Welcome message for new conversations |
| `dm.policy` | DM policy: `pairing`, `allowlist`, `open`, or `disabled` |

## Notes

- Webhooks require public HTTPS or HTTP with firewall rules. Only expose the webhook path.
- `sdkAppId` and `secretKey` are obtained from the [Tencent Cloud IM Console](https://console.cloud.tencent.com/im).
- Supports multiple accounts via the `accounts` configuration.
