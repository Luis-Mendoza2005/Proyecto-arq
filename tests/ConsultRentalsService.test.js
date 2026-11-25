import { describe, expect, it, vi } from 'vitest';
import { ConsultRentalsService } from '../src/application/ConsultRentalsService.js';
import { InvalidInputError, ResourceNotFoundError } from '../src/application/errors.js';
import { RENTAL_ID, VEHICLE_ID } from './support/fixtures.js';

function setup(found = []) {
  const rentals = {
    findMany: vi.fn().mockResolvedValue(found),
    findById: vi.fn().mockResolvedValue(found[0] ?? null),
  };
  return { service: new ConsultRentalsService(rentals), rentals };
}

describe('ConsultRentalsService (CU-02)', () => {
  it('aplica valores por defecto: más recientes primero, límite 50', async () => {
    const { service, rentals } = setup([{ id: RENTAL_ID }]);
    const result = await service.list({});

    expect(rentals.findMany).toHaveBeenCalledWith({
      sortBy: 'startsAt',
      order: 'desc',
      limit: 50,
      offset: 0,
    });
    expect(result.meta).toEqual({ limit: 50, offset: 0, count: 1 });
  });

  it('convierte y valida los filtros antes de consultar', async () => {
    const { service, rentals } = setup();
    await service.list({
      status: 'suspended',
      customerName: ' ana ',
      vehicleId: VEHICLE_ID.toUpperCase(),
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-30T00:00:00Z',
      sortBy: 'duration',
      order: 'asc',
      limit: '10',
      offset: '20',
    });

    expect(rentals.findMany).toHaveBeenCalledWith({
      status: 'suspended',
      customerName: 'ana',
      vehicleId: VEHICLE_ID,
      from: new Date('2026-11-01T00:00:00Z'),
      to: new Date('2026-11-30T00:00:00Z'),
      sortBy: 'duration',
      order: 'asc',
      limit: 10,
      offset: 20,
    });
  });

  it('devuelve una lista vacía cuando nada coincide', async () => {
    const { service } = setup([]);
    const result = await service.list({ customerName: 'Inexistente' });

    expect(result.rentals).toEqual([]);
    expect(result.meta.count).toBe(0);
  });

  it.each([
    [{ status: 'cancelado' }, 'status debe ser uno de'],
    [{ sortBy: 'password' }, 'sortBy debe ser uno de'],
    [{ order: 'sideways' }, 'order debe ser uno de'],
    [{ limit: '0' }, 'limit debe ser un entero entre 1 y 200.'],
    [{ limit: '201' }, 'limit debe ser un entero entre 1 y 200.'],
    [{ offset: '-1' }, 'offset debe ser un entero'],
    [{ from: 'ayer' }, 'from debe ser una fecha ISO válida.'],
    [{ vehicleId: 'abc' }, 'vehicleId debe ser un UUID válido.'],
    [{ unknown: '1' }, 'El campo unknown no está permitido.'],
    [{ status: ['active', 'suspended'] }, 'status debe indicarse una sola vez.'],
    [
      { from: '2026-12-01T00:00:00Z', to: '2026-11-01T00:00:00Z' },
      'from no puede ser posterior a to.',
    ],
  ])('rechaza filtros inválidos %j sin consultar la persistencia', async (query, message) => {
    const { service, rentals } = setup();

    await expect(service.list(query)).rejects.toThrow(message);
    expect(rentals.findMany).not.toHaveBeenCalled();
  });

  it('obtiene un alquiler por id', async () => {
    const { service } = setup([{ id: RENTAL_ID }]);
    await expect(service.getById(RENTAL_ID)).resolves.toEqual({ id: RENTAL_ID });
  });

  it('informa cuando el alquiler no existe o el id es inválido', async () => {
    const { service } = setup([]);

    await expect(service.getById(RENTAL_ID)).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(service.getById('x')).rejects.toBeInstanceOf(InvalidInputError);
  });
});
