import { RENTAL_STATUSES } from '../domain/rental.js';
import { InvalidInputError, ResourceNotFoundError } from './errors.js';
import {
  integerInRange,
  oneOf,
  rejectUnknownFields,
  requiredText,
  validDate,
  validUuid,
} from './validation.js';

export const SORT_FIELDS = ['startsAt', 'customerName', 'duration', 'createdAt'];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** CU-02: consultar alquileres, con filtros y orden, o uno por identificador. */
export class ConsultRentalsService {
  constructor(rentals) {
    this.rentals = rentals;
  }

  async list(query = {}) {
    rejectUnknownFields(query, [
      'status',
      'customerName',
      'vehicleId',
      'from',
      'to',
      'sortBy',
      'order',
      'limit',
      'offset',
    ]);
    for (const [field, value] of Object.entries(query)) {
      if (typeof value !== 'string') {
        throw new InvalidInputError(`${field} debe indicarse una sola vez.`);
      }
    }

    const filters = {};
    if (query.status !== undefined) filters.status = oneOf(query.status, 'status', RENTAL_STATUSES);
    if (query.customerName !== undefined) {
      filters.customerName = requiredText(query.customerName, 'customerName', 160);
    }
    if (query.vehicleId !== undefined) filters.vehicleId = validUuid(query.vehicleId, 'vehicleId');
    if (query.from !== undefined) filters.from = validDate(query.from, 'from');
    if (query.to !== undefined) filters.to = validDate(query.to, 'to');
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new InvalidInputError('from no puede ser posterior a to.');
    }

    const sortBy = query.sortBy === undefined ? 'startsAt' : oneOf(query.sortBy, 'sortBy', SORT_FIELDS);
    const order = query.order === undefined ? 'desc' : oneOf(query.order, 'order', ['asc', 'desc']);
    const limit = query.limit === undefined ? DEFAULT_LIMIT : integerInRange(query.limit, 'limit', 1, MAX_LIMIT);
    const offset = query.offset === undefined ? 0 : integerInRange(query.offset, 'offset', 0, 1_000_000);

    const rentals = await this.rentals.findMany({ ...filters, sortBy, order, limit, offset });
    return { rentals, meta: { limit, offset, count: rentals.length } };
  }

  async getById(id) {
    const rentalId = validUuid(id, 'id');
    const rental = await this.rentals.findById(rentalId);
    if (rental === null) {
      throw new ResourceNotFoundError('El alquiler indicado no existe.');
    }
    return rental;
  }
}
