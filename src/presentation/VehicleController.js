import { respondKnownError } from './httpErrors.js';

export class VehicleController {
  constructor(registerVehicle, listVehicles) {
    this.registerVehicle = registerVehicle;
    this.listVehicles = listVehicles;
  }

  create = async (request, response, next) => {
    try {
      const vehicle = await this.registerVehicle.execute(request.body ?? {});
      response.status(201).json({ data: vehicle });
    } catch (error) {
      if (!respondKnownError(error, response)) next(error);
    }
  };

  list = async (request, response, next) => {
    try {
      const vehicles = await this.listVehicles.execute(request.query);
      response.status(200).json({ data: vehicles });
    } catch (error) {
      if (!respondKnownError(error, response)) next(error);
    }
  };
}
