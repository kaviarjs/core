const STANDARD_ERROR_MESSAGE = "An error has occured";

export abstract class Exception<T = any> extends Error {
  public readonly data: T;
  public static readonly code: string;

  constructor(data?: T) {
    super();
    if (data) {
      this.data = data;
    }
    this.name = this.constructor.name;
    const code = (this.constructor as typeof Exception).code;
    const prefix = code ? `(${code}) ` : "";
    super.message = prefix + this.getMessage();
  }

  getMessage(): string {
    return STANDARD_ERROR_MESSAGE;
  }
}
