import { VEHICLE_STATUSES } from '../domain/vehicle.js';
import { InvalidInputError } from './errors.js';
import { oneOf, rejectUnknownFields } from './validation.js';

//Lista los vehiculos
export class ListVehiclesService {
  constructor(vehicles) {
    this.vehicles = vehicles;
  }

  execute(query = {}) {
    rejectUnknownFields(query, ['status'], '');
    let status;
    if (query.status !== undefined) {
      if (typeof query.status !== 'string') {
        throw new InvalidInputError('status debe indicarse una sola vez.');
      }
      status = oneOf(query.status, 'status', VEHICLE_STATUSES);
    }
    return this.vehicles.findAll({ status });
  }
}
