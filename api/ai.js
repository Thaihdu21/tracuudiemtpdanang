module.exports = async function handler(req, res) {
  console.log("ENV CHECK:");
  console.log("RAILWAY_URL:", process.env.RAILWAY_INTERNAL_URL ?? "NOT SET");
  console.log("SECRET:", process.env.INTERNAL_SECRET ? "SET" : "NOT SET");

  return res.status(200).json({
    railway_url: process.env.RAILWAY_INTERNAL_URL ?? "NOT SET",
    secret: process.env.INTERNAL_SECRET ? "SET" : "NOT SET",
  });
};
