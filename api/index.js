module.exports = async function handler(_req, res) {
  res.status(404).json({
    error: "Not Found",
    message: "API endpoint not found. Use /api/ipc/invoke for IPC requests.",
  });
};
