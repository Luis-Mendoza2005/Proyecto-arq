import {
  ConflictError,
  InvalidInputError,
  ResourceNotFoundError,
} from '../application/errors.js';

const STATUS_BY_ERROR = [
  [InvalidInputError, 400],
  [ResourceNotFoundError, 404],
  [ConflictError, 409],
];

/** Traduce errores conocidos de la aplicación a respuestas HTTP. Devuelve `true` si respondió. */
export function respondKnownError(error, response) {
  for (const [ErrorType, status] of STATUS_BY_ERROR) {
    if (error instanceof ErrorType) {
      response.status(status).json({ error: error.message });
      return true;
    }
  }
  return false;
}
