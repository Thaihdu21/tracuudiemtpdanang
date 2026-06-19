import { createHmac, randomUUID } from "crypto";

const RAILWAY_URL = process.env.RAILWAY_INTERNAL_URL; // KHÔNG phải public URL
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

/**
 * Vercel Serverless Function: /api/ai
 * - Nhận request từ browser
 * - Ký HMAC
 * - Chuyển tiếp sang Railway
 * - Pipe stream về browser
 */
export default async function handler(req, res) {
  // Chỉ chấp nhận POST
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  // Giới hạn request size
  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  if (contentLength > 16 * 1024) {
    return res.status(413).json({ success: false, message: "Payload quá lớn." });
  }

  // Lấy IP thực để gửi kèm sang Railway cho rate limit
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.socket?.remoteAddress ??
    "unknown";

  const { messages, max_tokens } = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ." });
  }

  // Tạo payload sạch — chỉ giữ những gì cần thiết
  const payload = {
    messages,
    max_tokens: max_tokens ?? 500,
    clientIp, // Railway dùng để rate limit theo IP gốc
  };

  const timestamp = Date.now();
  const nonce = randomUUID(); // UUID v4

  // Chuỗi ký: timestamp.nonce.payload_json
  const dataToSign = `${timestamp}.${nonce}.${JSON.stringify(payload)}`;

  const signature = createHmac("sha256", INTERNAL_SECRET)
    .update(dataToSign)
    .digest("hex");

  try {
    const railwayRes = await fetch(`${RAILWAY_URL}/api/ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Header nội bộ để Railway biết đây là Vercel
        "x-internal-caller": "vercel-serverless",
      },
      body: JSON.stringify({ payload, timestamp, nonce, signature }),
      signal: AbortSignal.timeout(35_000),
    });

    // Pipe response (kể cả stream) thẳng về browser
    res.status(railwayRes.status);
    railwayRes.headers.forEach((value, key) => {
      // Chỉ forward header an toàn
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
    console.error("[Vercel → Railway Error]", err);
    return res.status(502).json({ success: false, message: "Không thể kết nối đến máy chủ AI." });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "16kb",
    },
    // Tắt response helper mặc định của Vercel để pipe stream thủ công
    externalResolver: true,
  },
};
