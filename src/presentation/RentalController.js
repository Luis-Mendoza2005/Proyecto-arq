import { respondKnownError } from './httpErrors.js';

export class RentalController {
  constructor(registerRental, consultRentals, suspendRental) {
    this.registerRental = registerRental;
    this.consultRentals = consultRentals;
    this.suspendRental = suspendRental;
  }

  create = async (request, response, next) => {
    try {
      const rental = await this.registerRental.execute(request.body ?? {});
      response.status(201).json({ data: rental });
    } catch (error) {
      if (!respondKnownError(error, response)) next(error);
    }
  };

  list = async (request, response, next) => {
    try {
      const { rentals, meta } = await this.consultRentals.list(request.query);
      response.status(200).json({ data: rentals, meta });
    } catch (error) {
      if (!respondKnownError(error, response)) next(error);
    }
  };

  get = async (request, response, next) => {
    try {
      const rental = await this.consultRentals.getById(request.params.id);
      response.status(200).json({ data: rental });
    } catch (error) {
      if (!respondKnownError(error, response)) next(error);
    }
  };

  suspend = async (request, response, next) => {
    try {
      const rental = await this.suspendRental.execute(request.params.id, request.body ?? {});
      response.status(200).json({ data: rental });
    } catch (error) {
      if (!respondKnownError(error, response)) next(error);
    }
  };
}
