import { Request, Response, NextFunction } from "express";

const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  req.log.error({
    err,
    stack: err.stack,
    query: req.query,
    params: req.params,
    body: req.body,
  });

  if (res.headersSent) return;

  res.status(err.status || 500).json({
    message: err.error || "Server error",
    status: err.status || 500,
  });
};

export default errorHandler;
