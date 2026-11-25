import { describe, expect, it, vi } from 'vitest';
import {
  ConflictError,
  InvalidInputError,
  ResourceNotFoundError,
} from '../src/application/errors.js';
import { RegisterRentalService } from '../src/application/RegisterRentalService.js';
import { VEHICLE_ID, validRentalRequest } from './support/fixtures.js';

function setup({ vehicle = { id: VEHICLE_ID, status: 'available' }, created } = {}) {
  const vehicles = { findById: vi.fn().mockResolvedValue(vehicle) };
  const rentals = {
    createAndReserveVehicle: vi
      .fn()
      .mockImplementation(async (rental) => (created === undefined ? rental : created)),
  };
  return { service: new RegisterRentalService(rentals, vehicles), rentals, vehicles };
}

describe('RegisterRentalService (CU-01)', () => {
  it('normaliza los datos y registra el alquiler cuando el vehículo está disponible', async () => {
    const { service, rentals } = setup();
    const result = await service.execute(validRentalRequest);

    expect(result.customerName).toBe('Ana Pérez');
    expect(result.vehicleId).toBe(VEHICLE_ID);
    expect(result.startsAt).toEqual(new Date('2026-11-25T09:00:00-05:00'));
    expect(result.documents.signedContract).toBe('docs/contrato-0001.pdf');
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(rentals.createAndReserveVehicle).toHaveBeenCalledTimes(1);
  });

  it.each(['identityDocument', 'driverLicense', 'signedContract'])(
    'R-03: rechaza el alquiler si falta el documento %s y no toca la persistencia',
    async (missing) => {
      const { service, rentals, vehicles } = setup();
      const documents = { ...validRentalRequest.documents, [missing]: '   ' };

      await expect(service.execute({ ...validRentalRequest, documents })).rejects.toThrow(
        new RegExp(`documentos faltantes \\(R-03\\).*${missing}`),
      );
      expect(vehicles.findById).not.toHaveBeenCalled();
      expect(rentals.createAndReserveVehicle).not.toHaveBeenCalled();
    },
  );

  it('R-03: rechaza el alquiler si no se envía el objeto documents', async () => {
    const { service, rentals } = setup();
    const { documents: _omitted, ...withoutDocuments } = validRentalRequest;

    await expect(service.execute(withoutDocuments)).rejects.toThrow(
      'identityDocument, driverLicense, signedContract',
    );
    expect(rentals.createAndReserveVehicle).not.toHaveBeenCalled();
  });

  it('rechaza campos no permitidos en el cuerpo y en documents', async () => {
    const { service } = setup();

    await expect(service.execute({ ...validRentalRequest, discount: 10 })).rejects.toThrow(
      'El campo discount no está permitido.',
    );
    await expect(
      service.execute({
        ...validRentalRequest,
        documents: { ...validRentalRequest.documents, extra: 'x' },
      }),
    ).rejects.toThrow('El campo documents.extra no está permitido.');
  });

  it.each([
    ['customerName', '   ', 'customerName es obligatorio'],
    ['customerName', 'N'.repeat(161), 'no puede superar 160 caracteres'],
    ['customerIdNumber', '12 34', 'customerIdNumber no es válido'],
    ['customerPhone', 'abc', 'customerPhone no es válido'],
    ['vehicleId', 'no-es-uuid', 'vehicleId debe ser un UUID válido.'],
    ['startsAt', '25/11/2026 09:00', 'startsAt debe ser una fecha ISO válida.'],
    ['endsAt', 12345, 'endsAt debe ser una fecha ISO válida.'],
  ])('rechaza %s inválido (%s) sin llamar al repositorio', async (field, value, message) => {
    const { service, rentals } = setup();

    await expect(service.execute({ ...validRentalRequest, [field]: value })).rejects.toThrow(message);
    expect(rentals.createAndReserveVehicle).not.toHaveBeenCalled();
  });

  it('rechaza cuando la fecha final es igual o anterior a la inicial', async () => {
    const { service } = setup();

    await expect(
      service.execute({ ...validRentalRequest, endsAt: validRentalRequest.startsAt }),
    ).rejects.toThrow('endsAt debe ser posterior a startsAt.');
    await expect(
      service.execute({
        ...validRentalRequest,
        startsAt: '2026-11-28T09:00:00-05:00',
        endsAt: '2026-11-25T09:00:00-05:00',
      }),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  it('rechaza un cuerpo que no es objeto', async () => {
    const { service } = setup();
    await expect(service.execute([])).rejects.toBeInstanceOf(InvalidInputError);
    await expect(service.execute(null)).rejects.toBeInstanceOf(InvalidInputError);
  });

  it('informa que el vehículo no existe', async () => {
    const { service, rentals } = setup({ vehicle: null });

    await expect(service.execute(validRentalRequest)).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(rentals.createAndReserveVehicle).not.toHaveBeenCalled();
  });

  it.each(['rented', 'maintenance'])(
    'flujo alterno CU-01: cancela el registro si el vehículo está en estado %s',
    async (status) => {
      const { service, rentals } = setup({ vehicle: { id: VEHICLE_ID, status } });

      await expect(service.execute(validRentalRequest)).rejects.toBeInstanceOf(ConflictError);
      expect(rentals.createAndReserveVehicle).not.toHaveBeenCalled();
    },
  );

  it('responde conflicto si otro alquiler toma el vehículo antes de reservarlo', async () => {
    const { service } = setup({ created: null });

    await expect(service.execute(validRentalRequest)).rejects.toBeInstanceOf(ConflictError);
  });
});
