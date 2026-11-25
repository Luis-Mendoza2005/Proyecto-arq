import express from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConsultRentalsService } from './application/ConsultRentalsService.js';
import { ListVehiclesService } from './application/ListVehiclesService.js';
import { RegisterRentalService } from './application/RegisterRentalService.js';
import { RegisterVehicleService } from './application/RegisterVehicleService.js';
import { SuspendRentalService } from './application/SuspendRentalService.js';
import { PostgresRentalRepository } from './persistence/PostgresRentalRepository.js';
import { PostgresVehicleRepository } from './persistence/PostgresVehicleRepository.js';
import { RentalController } from './presentation/RentalController.js';
import { VehicleController } from './presentation/VehicleController.js';
import { createRoutes } from './presentation/routes.js';

/** Raíz de composición: conecta presentación → aplicación → persistencia. */
export function createApp(pool) {
  const app = express();

  const rentals = new PostgresRentalRepository(pool);
  const vehicles = new PostgresVehicleRepository(pool);

  const rentalController = new RentalController(
    new RegisterRentalService(rentals, vehicles),
    new ConsultRentalsService(rentals),
    new SuspendRentalService(rentals),
  );
  const vehicleController = new VehicleController(
    new RegisterVehicleService(vehicles),
    new ListVehiclesService(vehicles),
  );

  app.use(express.json());
  app.get('/health', (_request, response) => response.status(200).json({ status: 'ok' }));
  app.get('/openapi.yaml', (_request, response, next) => {
    try {
      const document = readFileSync(resolve(process.cwd(), 'docs', 'openapi.yaml'), 'utf8');
      response.type('application/yaml').send(document);
    } catch (error) {
      next(error);
    }
  });
  app.use('/api', createRoutes({ rentalController, vehicleController }));

  app.use((_request, response) => response.status(404).json({ error: 'Ruta no encontrada.' }));

  app.use((error, _request, response, _next) => {
    if (error?.type === 'entity.parse.failed') {
      response.status(400).json({ error: 'El cuerpo de la solicitud no es un JSON válido.' });
      return;
    }
    console.error('Error no controlado en la solicitud:', error);
    response.status(500).json({ error: 'Ocurrió un error interno.' });
  });

  return app;
}
