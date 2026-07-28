const RAILWAY_SEARCH_URL = process.env.RAILWAY_SEARCH_URL;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const { q, offset = "0", limit = "50" } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: "Tên tìm kiếm phải có ít nhất 2 ký tự."
    });
  }

  try {
    const params = new URLSearchParams({
      q: q.trim(),
      offset: parseInt(offset),
      limit: Math.min(parseInt(limit), 50), // giới hạn tối đa 50
    });

    const railwayRes = await fetch(
      `${RAILWAY_SEARCH_URL}/api/search/name?${params}`,
      {
        method: "GET",
        headers: {
          "x-internal-caller": "vercel-serverless",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );

    const data = await railwayRes.json();
    res.status(railwayRes.status).json(data);

  } catch (err) {
    if (err.name === "TimeoutError") {
      return res.status(504).json({
        success: false,
        message: "Máy chủ phản hồi quá chậm."
      });
    }
    console.error("Search error:", err.message);
    return res.status(502).json({
      success: false,
      message: "Không thể kết nối đến máy chủ tìm kiếm."
    });
  }
};

module.exports.config = {
  api: { bodyParser: false },
};
