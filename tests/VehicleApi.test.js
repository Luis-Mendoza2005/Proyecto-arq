import { afterEach, describe, expect, it } from 'vitest';
import { createFakePool, sendJson, startApi, stopApis, vehicleRow } from './support/fixtures.js';

afterEach(stopApis);

describe('API HTTP — vehículos', () => {
  it('201: registra un vehículo con la placa normalizada', async () => {
    const pool = createFakePool(() => ({ rows: [vehicleRow({ plate: 'PEF-4321', brand: 'Hyundai' })] }));
    const baseUrl = await startApi(pool);
    const { status, body } = await sendJson(baseUrl, 'POST', '/api/vehicles', {
      plate: 'pef4321',
      brand: 'Hyundai',
      model: 'Accent',
      year: 2023,
    });

    expect(status).toBe(201);
    expect(body.data.plate).toBe('PEF-4321');
    expect(pool.query.mock.calls[0][1][1]).toBe('PEF-4321');
  });

  it('400 y 409: datos inválidos y placa repetida', async () => {
    const pool = createFakePool(() => {
      throw Object.assign(new Error('duplicate'), { code: '23505' });
    });
    const baseUrl = await startApi(pool);

    const invalid = await sendJson(baseUrl, 'POST', '/api/vehicles', { plate: 'XX', brand: 'a', model: 'b', year: 2020 });
    expect(invalid.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();

    const duplicate = await sendJson(baseUrl, 'POST', '/api/vehicles', {
      plate: 'PBA-1234', brand: 'Chevrolet', model: 'Spark GT', year: 2021,
    });
    expect(duplicate.status).toBe(409);
  });

  it('200 y 400: lista vehículos y valida el filtro de estado', async () => {
    const pool = createFakePool(() => ({ rows: [vehicleRow()] }));
    const baseUrl = await startApi(pool);

    const ok = await fetch(`${baseUrl}/api/vehicles?status=available`);
    expect(ok.status).toBe(200);
    expect((await ok.json()).data[0].plate).toBe('PBA-1234');

    const bad = await fetch(`${baseUrl}/api/vehicles?status=volando`);
    expect(bad.status).toBe(400);
  });
});
