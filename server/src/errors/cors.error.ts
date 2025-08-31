export class CorsError extends Error {
  public error: string;

  constructor(message: string) {
    super(message);
    this.name = 'CorsError';
    this.error = 'CORS_ERROR';
  }
}