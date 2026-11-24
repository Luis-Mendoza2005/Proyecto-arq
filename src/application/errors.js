/** Entrada que incumple el contrato o una regla de validación (HTTP 400). */
export class InvalidInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

/** El recurso solicitado no existe (HTTP 404). */
export class ResourceNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResourceNotFoundError';
  }
}

/** La operación choca con el estado actual del recurso (HTTP 409). */
export class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
  }
}
