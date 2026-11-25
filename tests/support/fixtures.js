import { vi } from 'vitest';
import { createApp } from '../../src/app.js';

export const VEHICLE_ID = '11111111-1111-4111-8111-111111111111';
export const RENTAL_ID = '5e0057b7-932f-4fd3-83d6-01d43a95ebf8';

export const validRentalRequest = {
  customerName: ' Ana Pérez ',
  customerIdNumber: '0912345678',
  customerPhone: '+593991234567',
  vehicleId: VEHICLE_ID,
  startsAt: '2026-11-25T09:00:00-05:00',
  endsAt: '2026-11-28T09:00:00-05:00',
  documents: {
    identityDocument: 'docs/ana-perez-cedula.pdf',
    driverLicense: 'docs/ana-perez-licencia.pdf',
    signedContract: 'docs/contrato-0001.pdf',
  },
};

export function vehicleRow(overrides = {}) {
  return {
    id: VEHICLE_ID,
    plate: 'PBA-1234',
    brand: 'Chevrolet',
    model: 'Spark GT',
    year: 2021,
    status: 'available',
    created_at: new Date('2026-11-01T12:00:00.000Z'),
    ...overrides,
  };
}

export function rentalRow(overrides = {}) {
  return {
    id: RENTAL_ID,
    customer_name: 'Ana Pérez',
    customer_id_number: '0912345678',
    customer_phone: '+593991234567',
    identity_document_ref: 'docs/ana-perez-cedula.pdf',
    driver_license_ref: 'docs/ana-perez-licencia.pdf',
    signed_contract_ref: 'docs/contrato-0001.pdf',
    starts_at: new Date('2026-11-25T14:00:00.000Z'),
    ends_at: new Date('2026-11-28T14:00:00.000Z'),
    status: 'active',
    suspension_reason: null,
    suspended_at: null,
    created_at: new Date('2026-11-22T12:00:00.000Z'),
    vehicle_id: VEHICLE_ID,
    vehicle_plate: 'PBA-1234',
    vehicle_brand: 'Chevrolet',
    vehicle_model: 'Spark GT',
    ...overrides,
  };
}

/**
 * Pool de PostgreSQL simulado. `handler(sql, params)` devuelve `{ rows, rowCount }`;
 * las sentencias de transacción (BEGIN/COMMIT/ROLLBACK) se aceptan siempre.
 */
export function createFakePool(handler = () => ({ rows: [], rowCount: 0 })) {
  const log = [];
  const run = vi.fn(async (sql, params) => {
    const text = String(sql).trim();
    log.push(text);
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [], rowCount: 0 };
    const result = await handler(text, params);
    return { rowCount: result.rows?.length ?? 0, ...result };
  });
  const client = { query: run, release: vi.fn() };
  return { query: run, connect: vi.fn(async () => client), client, log };
}

const servers = [];

export async function startApi(pool) {
  const server = createApp(pool).listen(0);
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

export async function stopApis() {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(() => resolve()))),
  );
}

export async function sendJson(baseUrl, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
