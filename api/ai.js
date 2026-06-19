// api/ai.js — THAY TOÀN BỘ FILE
const { createHmac, randomUUID } = require("crypto");

const RAILWAY_INTERNAL_URL = process.env.RAILWAY_INTERNAL_URL;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const { messages, max_tokens } = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ." });
  }

  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  const payload = {
    messages,
    max_tokens: max_tokens ?? 500,
    clientIp,
  };

  const timestamp = Date.now();
  const nonce = randomUUID();
  const dataToSign = `${timestamp}.${nonce}.${JSON.stringify(payload)}`;

  const signature = createHmac("sha256", INTERNAL_SECRET)
    .update(dataToSign)
    .digest("hex");

  try {
    const railwayRes = await fetch(`${RAILWAY_INTERNAL_URL}/api/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-caller": "vercel-serverless",
      },
      body: JSON.stringify({ payload, timestamp, nonce, signature }),
      signal: AbortSignal.timeout(35_000),
    });

    res.status(railwayRes.status);

    railwayRes.headers.forEach((value, key) => {
      if (["content-type", "cache-control", "retry-after"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    if (railwayRes.body) {
      const reader = railwayRes.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(Buffer.from(value));
        return pump();
      };
      await pump();
    } else {
      const text = await railwayRes.text();
      res.send(text);
    }
  } catch (err) {
    if (err.name === "TimeoutError") {
      return res.status(504).json({ success: false, message: "AI phản hồi quá chậm." });
    }
    console.error("[Vercel → Railway Error]", err.message);
    return res.status(502).json({ success: false, message: "Không thể kết nối đến máy chủ AI." });
  }
};

module.exports.config = {
  api: {
    bodyParser: { sizeLimit: "16kb" },
    externalResolver: true,
  },
};
