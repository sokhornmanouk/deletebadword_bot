const BAD_WORDS = [
  // Add one prohibited word or phrase per item.
  // Keep the comma after every item except the final item.
  "fuck",
  "fxck",
  "sex",
  "sej",
  "joy",
  "kdor",
  "sab",
  "ចុយ",
  "ក្ដ",
  "ក្ត",
  "ពង",
  "pong",
  "jea knoy",
  "sor kdab",
  "លឹង្គ",
  "លិង្គ",
  "beam",
  "ខ្លុយជៀន",
  "kloy jean",
  "Beam",
  "💦","រួមភេទ","មេជីវិត","tver knea","ធ្វើគ្នា","រួមដំណេក","dak jol","ដាក់ចូល","វៃ","banh terk","kikilu","ers","គី គី លូ","ស ក្ដាប់","rg 6","wtf","fck",



  // Khmer examples:
  "ចុយ",
  "ក្ដ",
  "ខ្មួយ"
];

function normalizeText(value = "") {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replaceAll("0", "o")
    .replaceAll("1", "i")
    .replaceAll("3", "e")
    .replaceAll("4", "a")
    .replaceAll("5", "s")
    .replaceAll("7", "t")
    .replaceAll("@", "a")
    .replaceAll("$", "s")
    // Keep letters/numbers from all languages; remove spaces and symbols.
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const NORMALIZED_BAD_WORDS = BAD_WORDS
  .map(normalizeText)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

function containsBadWord(value) {
  const normalized = normalizeText(value);
  return normalized.length > 0 &&
    NORMALIZED_BAD_WORDS.some((word) => normalized.includes(word));
}

async function telegramApi(env, method, body = {}) {
  const response = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const result = await response.json();

  if (!result.ok) {
    console.error(`Telegram ${method} error:`, JSON.stringify(result));
  }

  return result;
}

async function deleteBadMessage(update, env) {
  const message = update.message ?? update.edited_message;

  if (!message) return;

  const chatType = message.chat?.type;

  if (chatType !== "group" && chatType !== "supergroup") {
    return;
  }

  const content = message.text ?? message.caption ?? "";

  if (!content || !containsBadWord(content)) {
    return;
  }

  const chatId = message.chat?.id;
  const userId = message.from?.id;

  if (!chatId || !userId) {
    console.error("Missing chat_id or user_id");
    return;
  }

  // លុបសារ
  const deleteResult = await telegramApi(env, "deleteMessage", {
    chat_id: chatId,
    message_id: message.message_id,
  });

  console.log("Delete result:", JSON.stringify(deleteResult));

  // ពិនិត្យថាអ្នកផ្ញើជា Admin ឬអត់
  const memberResult = await telegramApi(env, "getChatMember", {
    chat_id: chatId,
    user_id: userId,
  });

  console.log("Member result:", JSON.stringify(memberResult));

  const memberStatus = memberResult?.result?.status;

  if (
    memberStatus === "creator" ||
    memberStatus === "administrator"
  ) {
    console.log("Cannot restrict owner or administrator");
    return;
  }

  // Mute 1 នាទី
  const untilDate = Math.floor(Date.now() / 1000) + 60;

  const restrictResult = await telegramApi(
    env,
    "restrictChatMember",
    {
      chat_id: chatId,
      user_id: userId,
      permissions: {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
      },
      use_independent_chat_permissions: true,
      until_date: untilDate,
    }
  );

  console.log("Restrict result:", JSON.stringify(restrictResult));
}
async function setWebhook(request, env) {
  const url = new URL(request.url);
  const suppliedKey = url.searchParams.get("key");

  if (!env.SETUP_KEY || suppliedKey !== env.SETUP_KEY) {
    return Response.json(
      { ok: false, error: "Invalid setup key" },
      { status: 403 }
    );
  }

  const webhookUrl =
    `${url.origin}/webhook/${encodeURIComponent(env.WEBHOOK_SECRET)}`;

  const result = await telegramApi(env, "setWebhook", {
    url: webhookUrl,
    secret_token: env.WEBHOOK_SECRET,
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: true,
  });

  return Response.json({
    ...result,
    webhook_url: webhookUrl,
  });
}

async function webhookInfo(env) {
  const result = await telegramApi(env, "getWebhookInfo");
  return Response.json(result);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(
        "Telegram Auto Delete Bot is online.",
        { headers: { "content-type": "text/plain; charset=UTF-8" } }
      );
    }

    if (request.method === "GET" && url.pathname === "/set-webhook") {
      return setWebhook(request, env);
    }

    if (request.method === "GET" && url.pathname === "/webhook-info") {
      return webhookInfo(env);
    }

    const expectedPath =
      `/webhook/${encodeURIComponent(env.WEBHOOK_SECRET ?? "")}`;

    if (request.method === "POST" && url.pathname === expectedPath) {
      const telegramSecret =
        request.headers.get("X-Telegram-Bot-Api-Secret-Token");

      if (
        !env.WEBHOOK_SECRET ||
        telegramSecret !== env.WEBHOOK_SECRET
      ) {
        return new Response("Unauthorized", { status: 401 });
      }

      let update;
      try {
        update = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      // Return quickly to Telegram; deletion continues in the background.
      ctx.waitUntil(deleteBadMessage(update, env));
      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  },
};
