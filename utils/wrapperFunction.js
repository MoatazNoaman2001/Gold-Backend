export const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      console.error('Async Error:', err);
      
      if (err.name === 'ValidationError') {
        return res.status(400).json({
          status: 'fail',
          message: 'Validation Error',
          errors: err.errors
        });
      }
      
      if (err.code === 11000) {
        return res.status(409).json({
          status: 'fail',
          message: 'Duplicate key error',
          details: err.keyValue
        });
      }
      
      if (err.name === 'CastError') {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid ID format'
        });
      }
    
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    });
  };
};

export const handleMongooseErrors = (err, req, res, next) => {
  try {
    const errorObj = JSON.parse(err.message);
    return res.status(400).json(errorObj);
  } catch (e) {
    return next(err);
  }
};