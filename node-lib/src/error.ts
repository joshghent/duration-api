export class AppError extends Error {
  public readonly statusCode: number;

  constructor(
    message: string,
    public readonly kind: "BadRequest" | "InternalError" | "UnsupportedFileType"
  ) {
    super(message);
    this.name = "AppError";
    switch (kind) {
      case "BadRequest":
      case "UnsupportedFileType":
        this.statusCode = 400;
        break;
      case "InternalError":
        this.statusCode = 500;
        break;
    }
  }

  static badRequest(msg: string): AppError {
    return new AppError(msg, "BadRequest");
  }

  static internal(msg: string): AppError {
    return new AppError(msg, "InternalError");
  }

  static unsupportedFileType(msg: string): AppError {
    return new AppError(msg, "UnsupportedFileType");
  }

  toJSON() {
    return { error: this.message };
  }
}
