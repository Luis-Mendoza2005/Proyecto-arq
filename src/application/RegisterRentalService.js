import { randomUUID } from 'node:crypto';
import { REQUIRED_DOCUMENTS } from '../domain/rental.js';
import { ConflictError, InvalidInputError, ResourceNotFoundError } from './errors.js';
import {
  assertPlainObject,
  rejectUnknownFields,
  requiredText,
  textMatching,
  validDate,
  validUuid,
} from './validation.js';

const ID_NUMBER = /^[A-Za-z0-9]{5,20}$/;
const PHONE = /^\+?\d{7,15}$/;

/**
 * CU-01: registrar un alquiler.
 * Reglas: R-03 (no se permiten documentos faltantes) y disponibilidad del vehículo.
 */
export class RegisterRentalService {
  constructor(rentals, vehicles) {
    this.rentals = rentals;
    this.vehicles = vehicles;
  }

  async execute(input) {
    assertPlainObject(input);
    rejectUnknownFields(input, [
      'customerName',
      'customerIdNumber',
      'customerPhone',
      'vehicleId',
      'startsAt',
      'endsAt',
      'documents',
    ]);

    const customerName = requiredText(input.customerName, 'customerName', 160);
    const customerIdNumber = textMatching(
      input.customerIdNumber,
      'customerIdNumber',
      ID_NUMBER,
      'use de 5 a 20 letras o números, sin espacios',
    );
    const customerPhone = textMatching(
      input.customerPhone,
      'customerPhone',
      PHONE,
      'use de 7 a 15 dígitos, con "+" opcional al inicio',
    );
    const vehicleId = validUuid(input.vehicleId, 'vehicleId');
    const startsAt = validDate(input.startsAt, 'startsAt');
    const endsAt = validDate(input.endsAt, 'endsAt');
    if (startsAt >= endsAt) {
      throw new InvalidInputError('endsAt debe ser posterior a startsAt.');
    }
    const documents = this.validDocuments(input.documents);

    const vehicle = await this.vehicles.findById(vehicleId);
    if (vehicle === null) {
      throw new ResourceNotFoundError('El vehículo indicado no existe.');
    }
    if (vehicle.status !== 'available') {
      throw new ConflictError('El vehículo no está disponible; el alquiler no fue registrado.');
    }

    const created = await this.rentals.createAndReserveVehicle({
      id: randomUUID(),
      vehicleId,
      customerName,
      customerIdNumber,
      customerPhone,
      documents,
      startsAt,
      endsAt,
    });
    if (created === null) {
      // Otro alquiler tomó el vehículo entre la consulta y la reserva.
      throw new ConflictError('El vehículo no está disponible; el alquiler no fue registrado.');
    }
    return created;
  }

  /** R-03: los tres documentos son obligatorios. */
  validDocuments(documents) {
    if (documents !== undefined && documents !== null) {
      assertPlainObject(documents, 'documents debe ser un objeto.');
      rejectUnknownFields(documents, REQUIRED_DOCUMENTS, 'documents.');
    }

    const source = documents ?? {};
    const missing = REQUIRED_DOCUMENTS.filter(
      (name) => typeof source[name] !== 'string' || source[name].trim().length === 0,
    );
    if (missing.length > 0) {
      throw new InvalidInputError(
        `No se permiten alquileres con documentos faltantes (R-03): ${missing.join(', ')}.`,
      );
    }

    return Object.fromEntries(
      REQUIRED_DOCUMENTS.map((name) => [name, requiredText(source[name], `documents.${name}`, 255)]),
    );
  }
}
