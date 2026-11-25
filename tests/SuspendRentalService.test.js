import { describe, expect, it, vi } from 'vitest';
import {
  ConflictError,
  InvalidInputError,
  ResourceNotFoundError,
} from '../src/application/errors.js';
import { SuspendRentalService } from '../src/application/SuspendRentalService.js';
import { RENTAL_ID } from './support/fixtures.js';

function setup({ rental, suspended } = {}) {
  const rentals = {
    findById: vi.fn().mockResolvedValue(rental === undefined ? { id: RENTAL_ID, status: 'active' } : rental),
    markSuspended: vi
      .fn()
      .mockResolvedValue(suspended === undefined ? { id: RENTAL_ID, status: 'suspended' } : suspended),
  };
  return { service: new SuspendRentalService(rentals), rentals };
}

describe('SuspendRentalService (CU-03)', () => {
  it('suspende un alquiler activo con la razón normalizada', async () => {
    const { service, rentals } = setup();
    const result = await service.execute(RENTAL_ID, { reason: '  Avería del vehículo  ' });

    expect(result.status).toBe('suspended');
    expect(rentals.markSuspended).toHaveBeenCalledWith(RENTAL_ID, 'Avería del vehículo');
  });

  it('rechaza una razón vacía o demasiado larga', async () => {
    const { service, rentals } = setup();

    await expect(service.execute(RENTAL_ID, { reason: '  ' })).rejects.toThrow('reason es obligatorio');
    await expect(service.execute(RENTAL_ID, { reason: 'x'.repeat(501) })).rejects.toThrow(
      'reason no puede superar 500 caracteres.',
    );
    expect(rentals.markSuspended).not.toHaveBeenCalled();
  });

  it('rechaza un identificador que no es UUID y campos no permitidos', async () => {
    const { service } = setup();

    await expect(service.execute('123', { reason: 'Lluvia' })).rejects.toBeInstanceOf(InvalidInputError);
    await expect(service.execute(RENTAL_ID, { reason: 'Lluvia', status: 'x' })).rejects.toThrow(
      'El campo status no está permitido.',
    );
  });

  it('informa cuando el alquiler no existe', async () => {
    const { service, rentals } = setup({ rental: null });

    await expect(service.execute(RENTAL_ID, { reason: 'Lluvia' })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
    expect(rentals.markSuspended).not.toHaveBeenCalled();
  });

  it('flujo alterno CU-03: no suspende un alquiler que ya finalizó', async () => {
    const { service, rentals } = setup({ rental: { id: RENTAL_ID, status: 'finished' } });

    await expect(service.execute(RENTAL_ID, { reason: 'Lluvia' })).rejects.toThrow(
      'El alquiler ya finalizó y no puede suspenderse.',
    );
    expect(rentals.markSuspended).not.toHaveBeenCalled();
  });

  it('no suspende dos veces el mismo alquiler', async () => {
    const { service } = setup({ rental: { id: RENTAL_ID, status: 'suspended' } });

    await expect(service.execute(RENTAL_ID, { reason: 'Lluvia' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('responde conflicto si el estado cambió justo antes de actualizar', async () => {
    const { service } = setup({ suspended: null });

    await expect(service.execute(RENTAL_ID, { reason: 'Lluvia' })).rejects.toBeInstanceOf(ConflictError);
  });
});
