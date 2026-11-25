import { randomUUID } from 'node:crypto';
import { ConflictError, InvalidInputError } from './errors.js'; //Importa las clases de errores de errors.js
import {
  assertPlainObject,
  integerInRange,
  rejectUnknownFields,
  requiredText,
} from './validation.js';

const PLATE = /^([A-Z]{3})-?(\d{3,4})$/;

/** Registra un vehículo disponible para alquilar **/
export class RegisterVehicleService {
  constructor(vehicles, clock = () => new Date()) {
    this.vehicles = vehicles;
    this.clock = clock;
  }

  async execute(input) {
    assertPlainObject(input);
    rejectUnknownFields(input, ['plate', 'brand', 'model', 'year']);

    const plate = this.normalizePlate(input.plate);
    const brand = requiredText(input.brand, 'brand', 80);
    const model = requiredText(input.model, 'model', 80);
    const maxYear = this.clock().getUTCFullYear() + 1;
    const year = integerInRange(input.year, 'year', 1990, maxYear);

    const created = await this.vehicles.create({
      id: randomUUID(),
      plate,
      brand,
      model,
      year,
      status: 'available',
    });
    if (created === null) {
      throw new ConflictError(`Ya existe un vehículo con la placa ${plate}.`);
    }
    return created;
  }

  normalizePlate(value) {
    const text = requiredText(value, 'plate', 10).toUpperCase();
    const match = PLATE.exec(text);
    if (!match) {
      throw new InvalidInputError('plate no es válido: use el formato ABC-1234.');
    }
    return `${match[1]}-${match[2]}`;
  }
}
