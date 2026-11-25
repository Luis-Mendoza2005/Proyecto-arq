import { Router } from 'express';

export function createRoutes({ rentalController, vehicleController }) {
  const router = Router();

  router.get('/vehicles', vehicleController.list);
  router.post('/vehicles', vehicleController.create);

  router.get('/rentals', rentalController.list);
  router.post('/rentals', rentalController.create);
  router.get('/rentals/:id', rentalController.get);
  router.post('/rentals/:id/suspension', rentalController.suspend);

  return router;
}
