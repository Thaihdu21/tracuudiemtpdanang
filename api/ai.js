module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Method not allowed." });
    }

    // Test gọi Railway không cần HMAC
    const railwayURL = process.env.RAILWAY_INTERNAL_URL + "/health";
    console.log("Testing Railway health:", railwayURL);

    const r = await fetch(railwayURL, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });

    const text = await r.text();
    console.log("Railway health status:", r.status, text);

    return res.status(200).json({
      railway_status: r.status,
      railway_body: text,
    });

  } catch (err) {
    console.error("ERROR:", err.name, err.message);
    return res.status(500).json({
      error_name: err.name,
      error_message: err.message,
    });
  }
};
