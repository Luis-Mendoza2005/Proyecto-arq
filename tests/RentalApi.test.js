import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RENTAL_ID,
  VEHICLE_ID,
  createFakePool,
  rentalRow,
  sendJson,
  startApi,
  stopApis,
  validRentalRequest,
  vehicleRow,
} from './support/fixtures.js';

beforeEach(() => {
  // Los escenarios 500 registran el error en consola; se silencia para no ensuciar la salida.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await stopApis();
});

/** Base de datos simulada con un vehículo y, opcionalmente, un alquiler existente. */
function fakeDatabase({ vehicle = vehicleRow(), rental = null, reservable = true } = {}) {
  return createFakePool((sql) => {
    if (sql.startsWith('SELECT id, plate')) return { rows: vehicle ? [vehicle] : [] };
    if (sql.startsWith('UPDATE vehicles SET status = \'rented\'')) {
      return { rows: reservable ? [{ id: VEHICLE_ID }] : [] };
    }
    if (sql.startsWith('UPDATE rentals')) {
      return { rows: rental?.status === 'active' ? [{ vehicle_id: VEHICLE_ID }] : [] };
    }
    if (sql.startsWith('SELECT r.id')) return { rows: [rental ?? rentalRow()] };
    return { rows: [] };
  });
}

describe('API HTTP — CU-01 registrar un alquiler', () => {
  it('201: registra el alquiler y responde con la forma documentada', async () => {
    const pool = fakeDatabase();
    const baseUrl = await startApi(pool);
    const { status, body } = await sendJson(baseUrl, 'POST', '/api/rentals', validRentalRequest);

    expect(status).toBe(201);
    expect(Object.keys(body.data).sort()).toEqual(
      ['createdAt', 'customerIdNumber', 'customerName', 'customerPhone', 'documents', 'endsAt', 'id',
        'startsAt', 'status', 'suspendedAt', 'suspensionReason', 'vehicle'].sort(),
    );
    expect(body.data.status).toBe('active');
    expect(body.data.vehicle.plate).toBe('PBA-1234');
    expect(pool.log).toContain('COMMIT');
  });

  it('400 (R-03): rechaza un alquiler sin documentos y no consulta la base de datos', async () => {
    const pool = fakeDatabase();
    const baseUrl = await startApi(pool);
    const { documents: _omitted, ...withoutDocuments } = validRentalRequest;
    const { status, body } = await sendJson(baseUrl, 'POST', '/api/rentals', withoutDocuments);

    expect(status).toBe(400);
    expect(body.error).toContain('documentos faltantes (R-03)');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('400: rechaza datos inválidos y un JSON mal formado', async () => {
    const pool = fakeDatabase();
    const baseUrl = await startApi(pool);

    const invalid = await sendJson(baseUrl, 'POST', '/api/rentals', { ...validRentalRequest, vehicleId: 'x' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toContain('vehicleId');

    const malformed = await fetch(`${baseUrl}/api/rentals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"customerName": ',
    });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toContain('JSON válido');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('404: el vehículo no existe', async () => {
    const baseUrl = await startApi(fakeDatabase({ vehicle: null }));
    const { status } = await sendJson(baseUrl, 'POST', '/api/rentals', validRentalRequest);
    expect(status).toBe(404);
  });

  it('409: vehículo no disponible, el registro se cancela sin crear alquiler', async () => {
    const pool = fakeDatabase({ vehicle: vehicleRow({ status: 'rented' }) });
    const baseUrl = await startApi(pool);
    const { status, body } = await sendJson(baseUrl, 'POST', '/api/rentals', validRentalRequest);

    expect(status).toBe(409);
    expect(body.error).toContain('no está disponible');
    expect(pool.log.some((sql) => sql.startsWith('INSERT'))).toBe(false);
  });

  it('500: un fallo de base de datos no expone detalles internos', async () => {
    const pool = createFakePool(() => {
      throw new Error('password authentication failed');
    });
    const baseUrl = await startApi(pool);
    const { status, body } = await sendJson(baseUrl, 'POST', '/api/rentals', validRentalRequest);

    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Ocurrió un error interno.' });
  });
});

describe('API HTTP — CU-02 consultar alquileres', () => {
  it('200: lista con filtros, orden y paginación', async () => {
    const pool = fakeDatabase();
    const baseUrl = await startApi(pool);
    const response = await fetch(
      `${baseUrl}/api/rentals?status=active&customerName=ana&sortBy=customerName&order=asc&limit=5`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.meta).toEqual({ limit: 5, offset: 0, count: 1 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('ILIKE $2');
    expect(params).toEqual(['active', '%ana%', 5, 0]);
  });

  it('200: sin coincidencias devuelve una lista vacía con meta.count = 0', async () => {
    const pool = createFakePool(() => ({ rows: [] }));
    const baseUrl = await startApi(pool);
    const response = await fetch(`${baseUrl}/api/rentals?customerName=Inexistente`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ data: [], meta: { count: 0 } });
  });

  it('400: filtros inválidos no llegan a la base de datos', async () => {
    const pool = fakeDatabase();
    const baseUrl = await startApi(pool);

    for (const query of ['status=cancelado', 'sortBy=password', 'limit=9999', 'from=ayer', 'foo=1']) {
      const response = await fetch(`${baseUrl}/api/rentals?${query}`);
      expect(response.status, query).toBe(400);
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('200 / 404 / 400: consulta de un alquiler por id', async () => {
    const baseUrl = await startApi(fakeDatabase());
    const found = await fetch(`${baseUrl}/api/rentals/${RENTAL_ID}`);
    expect(found.status).toBe(200);
    expect((await found.json()).data.id).toBe(RENTAL_ID);

    const emptyUrl = await startApi(createFakePool(() => ({ rows: [] })));
    expect((await fetch(`${emptyUrl}/api/rentals/${RENTAL_ID}`)).status).toBe(404);
    expect((await fetch(`${emptyUrl}/api/rentals/no-es-uuid`)).status).toBe(400);
  });
});

describe('API HTTP — CU-03 suspender un alquiler', () => {
  const suspended = rentalRow({
    status: 'suspended',
    suspension_reason: 'Avería del vehículo',
    suspended_at: new Date('2026-11-26T10:00:00.000Z'),
  });

  it('200: suspende el alquiler vigente y registra la razón', async () => {
    let suspendedYet = false;
    const pool = createFakePool((sql) => {
      if (sql.startsWith('UPDATE rentals')) {
        suspendedYet = true;
        return { rows: [{ vehicle_id: VEHICLE_ID }] };
      }
      if (sql.startsWith('SELECT r.id')) return { rows: [suspendedYet ? suspended : rentalRow()] };
      return { rows: [] };
    });
    const baseUrl = await startApi(pool);
    const { status, body } = await sendJson(baseUrl, 'POST', `/api/rentals/${RENTAL_ID}/suspension`, {
      reason: 'Avería del vehículo',
    });

    expect(status).toBe(200);
    expect(body.data).toMatchObject({ status: 'suspended', suspensionReason: 'Avería del vehículo' });
    expect(body.data.suspendedAt).toBe('2026-11-26T10:00:00.000Z');
    expect(pool.log.some((sql) => sql.startsWith("UPDATE vehicles SET status = 'available'"))).toBe(true);
  });

  it('409: no suspende un alquiler finalizado ni uno ya suspendido', async () => {
    for (const rental of [rentalRow({ status: 'finished' }), suspended]) {
      const pool = fakeDatabase({ rental });
      const baseUrl = await startApi(pool);
      const { status } = await sendJson(baseUrl, 'POST', `/api/rentals/${RENTAL_ID}/suspension`, { reason: 'Lluvia' });

      expect(status).toBe(409);
      expect(pool.log.some((sql) => sql.startsWith('UPDATE rentals'))).toBe(false);
    }
  });

  it('404 / 400: alquiler inexistente, razón faltante o id inválido', async () => {
    const emptyUrl = await startApi(createFakePool(() => ({ rows: [] })));
    expect((await sendJson(emptyUrl, 'POST', `/api/rentals/${RENTAL_ID}/suspension`, { reason: 'Lluvia' })).status).toBe(404);

    const baseUrl = await startApi(fakeDatabase());
    expect((await sendJson(baseUrl, 'POST', `/api/rentals/${RENTAL_ID}/suspension`, {})).status).toBe(400);
    expect((await sendJson(baseUrl, 'POST', '/api/rentals/abc/suspension', { reason: 'Lluvia' })).status).toBe(400);
  });
});

describe('API HTTP — sistema', () => {
  it('responde /health y 404 para rutas desconocidas', async () => {
    const baseUrl = await startApi(createFakePool());
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });

    const unknown = await fetch(`${baseUrl}/api/no-existe`);
    expect(unknown.status).toBe(404);
  });
});
