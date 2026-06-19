const { createHmac, randomUUID } = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const RAILWAY_INTERNAL_URL = process.env.RAILWAY_INTERNAL_URL;
  const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

  const { messages, max_tokens } = req.body ?? {};

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

  const railwayURL = `${RAILWAY_INTERNAL_URL}/api/ai`;
  console.log("Calling Railway:", railwayURL);

  try {
    const railwayRes = await fetch(railwayURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-caller": "vercel-serverless",
      },
      body: JSON.stringify({ payload, timestamp, nonce, signature }),
      signal: AbortSignal.timeout(35_000),
    });

    console.log("Railway responded:", railwayRes.status);

    // Đọc body dù thành công hay thất bại
    const responseText = await railwayRes.text();
    console.log("Railway body:", responseText);

    // Forward về browser
    res.status(railwayRes.status);
    res.setHeader("Content-Type", railwayRes.headers.get("content-type") ?? "application/json");
    res.send(responseText);

  } catch (err) {
    console.error("Fetch error:", err.name, err.message);
    return res.status(502).json({
      success: false,
      message: "Không thể kết nối đến máy chủ AI.",
      error: err.message,
    });
  }
};

module.exports.config = {
  api: {
    bodyParser: { sizeLimit: "16kb" },
    externalResolver: true,
  },
};
