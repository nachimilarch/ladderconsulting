module.exports = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  const status = err.statusCode || 500;

  console.error(`[Error] ${err.message}`, isDev ? err.stack : '');

  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
};