export const catchAsync = (fun)=>{
    return (req,res,next)=>{
        fun(req,res,next).catch(next)
    }
}

export const handleMongooseErrors = (err, req, res, next) => {
  try {
    const errorObj = JSON.parse(err.message);
    return res.status(400).json(errorObj);
  } catch (e) {
    return next(err);
  }
};