import { ConflictError, InvalidInputError, ResourceNotFoundError } from './errors.js';
import { assertPlainObject, rejectUnknownFields, requiredText, validUuid } from './validation.js';

/**
 * CU-03: suspender un alquiler en medio de su término.
 * Regla alterna: si el alquiler ya finalizó no puede suspenderse (se informa con un conflicto).
 */
export class SuspendRentalService {
  constructor(rentals) {
    this.rentals = rentals;
  }

  async execute(id, input) {
    const rentalId = validUuid(id, 'id');
    assertPlainObject(input);
    rejectUnknownFields(input, ['reason']);
    const reason = requiredText(input.reason, 'reason', 500);

    const rental = await this.rentals.findById(rentalId);
    if (rental === null) {
      throw new ResourceNotFoundError('El alquiler indicado no existe.');
    }
    if (rental.status === 'finished') {
      throw new ConflictError('El alquiler ya finalizó y no puede suspenderse.');
    }
    if (rental.status === 'suspended') {
      throw new ConflictError('El alquiler ya está suspendido.');
    }

    const suspended = await this.rentals.markSuspended(rentalId, reason);
    if (suspended === null) {
      // El estado cambió entre la lectura y la actualización (finalizó o se suspendió).
      throw new ConflictError('El alquiler cambió de estado y ya no puede suspenderse.');
    }
    return suspended;
  }
}
