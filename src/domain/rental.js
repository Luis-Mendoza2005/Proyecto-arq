/**
 * Modelo de datos de un alquiler.
 *
 * `finished` no se guarda en la base de datos: se deriva cuando un alquiler
 * activo ya superó su fecha de fin (ver PostgresRentalRepository).
 *
 * @typedef {'active' | 'suspended' | 'finished'} RentalStatus
 */
export const RENTAL_STATUSES = ['active', 'suspended', 'finished'];

/** R-03: documentos obligatorios para registrar un alquiler. */
export const REQUIRED_DOCUMENTS = ['identityDocument', 'driverLicense', 'signedContract'];
