# Telegram Bad Word Cleaner — Cloudflare Worker

Runs continuously using a Telegram webhook and Cloudflare Workers.

## What it does

- Deletes group text messages containing prohibited words.
- Deletes photos/videos/documents when the prohibited word is in the caption.
- Detects simple disguises such as `f*u*c*k` and `f u c k`.
- Sends no warning.
- Does not mute or ban users.

## Important limitation

This version does **not** read words drawn inside an image. Reading text inside
an image requires OCR or a vision service.

## Edit prohibited words

Open `src/index.js` and edit the `BAD_WORDS` array:

```js
const BAD_WORDS = [
  "word one",
  "word two",
  "ឧទាហរណ៍"
];
```

## Required Cloudflare secrets

Add these three secrets in the Cloudflare dashboard:

- `BOT_TOKEN` — token from `@BotFather`
- `WEBHOOK_SECRET` — create a private random value, for example
  `beckie_cleaner_2026_x8k29`
- `SETUP_KEY` — create another private random value, for example
  `setup_9f2k7m4p`

Never place the Bot Token directly in GitHub.

## Cloudflare GitHub deployment

1. Upload all files to a new GitHub repository.
2. Open Cloudflare Dashboard.
3. Go to **Workers & Pages**.
4. Select **Create application**.
5. Next to **Import a repository**, select **Get started**.
6. Connect GitHub and choose this repository.
7. Make sure the Worker name is `telegram-badword-cleaner`, matching
   `wrangler.jsonc`.
8. Deploy command: `npx wrangler deploy`
9. Save and deploy.

## Add secrets

After deployment:

1. Open the Worker.
2. Go to **Settings → Variables and Secrets**.
3. Add `BOT_TOKEN` as encrypted/secret.
4. Add `WEBHOOK_SECRET` as encrypted/secret.
5. Add `SETUP_KEY` as encrypted/secret.
6. Deploy again if Cloudflare asks.

## Register the Telegram webhook

Suppose the Worker URL is:

```text
https://telegram-badword-cleaner.YOUR-SUBDOMAIN.workers.dev
```

Open this address in a browser, replacing `YOUR_SETUP_KEY`:

```text
https://telegram-badword-cleaner.YOUR-SUBDOMAIN.workers.dev/set-webhook?key=YOUR_SETUP_KEY
```

A successful response contains:

```json
{"ok":true,"result":true}
```

Check webhook status:

```text
https://telegram-badword-cleaner.YOUR-SUBDOMAIN.workers.dev/webhook-info
```

## Telegram setup

In `@BotFather`:

1. Send `/setprivacy`.
2. Select the bot.
3. Choose **Disable**.

In the Telegram group:

1. Add the bot.
2. Make it an administrator.
3. Enable **Delete Messages**.

## Updating bad words

Edit `src/index.js` in GitHub and commit the change. Cloudflare's Git
integration automatically builds and deploys each push to the production
branch.

## Troubleshooting

### Text does not delete

- Confirm `/setprivacy` is disabled.
- Confirm the bot is an administrator.
- Confirm **Delete Messages** is enabled.
- Check `/webhook-info`.
- Open Cloudflare Worker **Logs** and test again.

### Caption deletes but words inside the picture do not

This is expected. Image text needs OCR, which is not included in this version.

### Token was exposed

Use `/revoke` in `@BotFather`, generate a new token, and replace the
`BOT_TOKEN` secret in Cloudflare.
