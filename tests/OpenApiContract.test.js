import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import {
  RENTAL_ID,
  VEHICLE_ID,
  createFakePool,
  rentalRow,
  startApi,
  stopApis,
  validRentalRequest,
  vehicleRow,
} from './support/fixtures.js';

const spec = parse(readFileSync(resolve(process.cwd(), 'docs', 'openapi.yaml'), 'utf8'));

beforeEach(() => {
  // Los escenarios 500 registran el error en consola; se silencia para no ensuciar la salida.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await stopApis();
});

const okPool = () =>
  createFakePool((sql) => {
    if (sql.startsWith('SELECT id, plate') || sql.startsWith('INSERT INTO vehicles')) return { rows: [vehicleRow()] };
    if (sql.startsWith("UPDATE vehicles SET status = 'rented'")) return { rows: [{ id: VEHICLE_ID }] };
    if (sql.startsWith('UPDATE rentals')) return { rows: [{ vehicle_id: VEHICLE_ID }] };
    if (sql.startsWith('SELECT r.id')) return { rows: [rentalRow()] };
    return { rows: [] };
  });
const emptyPool = () => createFakePool(() => ({ rows: [] }));
const failingPool = () =>
  createFakePool(() => {
    throw new Error('boom');
  });
const rentedVehiclePool = () => createFakePool(() => ({ rows: [vehicleRow({ status: 'rented' })] }));
const finishedRentalPool = () => createFakePool(() => ({ rows: [rentalRow({ status: 'finished' })] }));

const vehicleBody = { plate: 'PEF-4321', brand: 'Hyundai', model: 'Accent', year: 2023 };

/** [método, ruta OpenAPI, ruta real, cuerpo, estado esperado, pool simulado] */
const scenarios = [
  ['post', '/api/rentals', '/api/rentals', validRentalRequest, 201, okPool],
  ['post', '/api/rentals', '/api/rentals', { ...validRentalRequest, documents: {} }, 400, okPool],
  ['post', '/api/rentals', '/api/rentals', validRentalRequest, 404, emptyPool],
  ['post', '/api/rentals', '/api/rentals', validRentalRequest, 409, rentedVehiclePool],
  ['post', '/api/rentals', '/api/rentals', validRentalRequest, 500, failingPool],
  ['get', '/api/rentals', '/api/rentals', undefined, 200, okPool],
  ['get', '/api/rentals', '/api/rentals?status=x', undefined, 400, okPool],
  ['get', '/api/rentals', '/api/rentals', undefined, 500, failingPool],
  ['get', '/api/rentals/{id}', `/api/rentals/${RENTAL_ID}`, undefined, 200, okPool],
  ['get', '/api/rentals/{id}', '/api/rentals/abc', undefined, 400, okPool],
  ['get', '/api/rentals/{id}', `/api/rentals/${RENTAL_ID}`, undefined, 404, emptyPool],
  ['get', '/api/rentals/{id}', `/api/rentals/${RENTAL_ID}`, undefined, 500, failingPool],
  ['post', '/api/rentals/{id}/suspension', `/api/rentals/${RENTAL_ID}/suspension`, { reason: 'Lluvia' }, 200, okPool],
  ['post', '/api/rentals/{id}/suspension', `/api/rentals/${RENTAL_ID}/suspension`, {}, 400, okPool],
  ['post', '/api/rentals/{id}/suspension', `/api/rentals/${RENTAL_ID}/suspension`, { reason: 'Lluvia' }, 404, emptyPool],
  ['post', '/api/rentals/{id}/suspension', `/api/rentals/${RENTAL_ID}/suspension`, { reason: 'Lluvia' }, 409, finishedRentalPool],
  ['post', '/api/rentals/{id}/suspension', `/api/rentals/${RENTAL_ID}/suspension`, { reason: 'Lluvia' }, 500, failingPool],
  ['post', '/api/vehicles', '/api/vehicles', vehicleBody, 201, okPool],
  ['post', '/api/vehicles', '/api/vehicles', { ...vehicleBody, plate: '1' }, 400, okPool],
  ['post', '/api/vehicles', '/api/vehicles', vehicleBody, 409, () =>
    createFakePool(() => {
      throw Object.assign(new Error('duplicate'), { code: '23505' });
    })],
  ['post', '/api/vehicles', '/api/vehicles', vehicleBody, 500, failingPool],
  ['get', '/api/vehicles', '/api/vehicles', undefined, 200, okPool],
  ['get', '/api/vehicles', '/api/vehicles?status=x', undefined, 400, okPool],
  ['get', '/api/vehicles', '/api/vehicles', undefined, 500, failingPool],
  ['get', '/health', '/health', undefined, 200, okPool],
];

function resolveRef(node) {
  if (node?.$ref) {
    return node.$ref.replace('#/', '').split('/').reduce((current, key) => current[key], spec);
  }
  return node;
}

/** Comprueba las propiedades obligatorias del esquema (resolviendo $ref y allOf). */
function requiredKeys(schema) {
  const resolved = resolveRef(schema);
  const own = resolved.required ?? [];
  const inherited = (resolved.allOf ?? []).flatMap(requiredKeys);
  return [...own, ...inherited];
}

describe('contrato OpenAPI y comportamiento implementado', () => {
  it('declara OpenAPI 3.0.3 y cada operación tiene operationId único', () => {
    expect(spec.openapi).toBe('3.0.3');
    const ids = Object.values(spec.paths).flatMap((methods) => Object.values(methods).map((op) => op.operationId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(scenarios)('%s %s → %i está documentado y se cumple (%#)', async (method, specPath, realPath, body, expected, makePool) => {
    const baseUrl = await startApi(makePool());
    const response = await fetch(`${baseUrl}${realPath}`, {
      method: method.toUpperCase(),
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    expect(response.status).toBe(expected);

    const operation = spec.paths[specPath][method];
    const documented = operation.responses[String(expected)];
    expect(documented, `${method} ${specPath} no documenta ${expected}`).toBeDefined();

    const schema = resolveRef(documented).content?.['application/json']?.schema;
    if (schema) {
      const json = await response.json();
      for (const key of requiredKeys(schema)) expect(json).toHaveProperty(key);
      if (json.data && !Array.isArray(json.data) && schema.properties?.data) {
        for (const key of requiredKeys(schema.properties.data)) expect(json.data).toHaveProperty(key);
      }
      if (Array.isArray(json.data) && json.data[0] && schema.properties?.data?.items) {
        for (const key of requiredKeys(schema.properties.data.items)) expect(json.data[0]).toHaveProperty(key);
      }
    }
  });

  it('todas las operaciones documentadas (salvo /openapi.yaml) tienen un escenario probado', () => {
    const tested = new Set(scenarios.map(([method, path]) => `${method} ${path}`));
    const documented = Object.entries(spec.paths)
      .filter(([path]) => path !== '/openapi.yaml')
      .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method} ${path}`));

    expect([...tested].sort()).toEqual(documented.sort());
  });

  it('todo código de estado de las operaciones principales está cubierto por un escenario', () => {
    for (const [path, methods] of Object.entries(spec.paths)) {
      if (path === '/health' || path === '/openapi.yaml') continue;
      for (const [method, operation] of Object.entries(methods)) {
        const covered = scenarios.filter(([m, p]) => m === method && p === path).map(([, , , , status]) => String(status));
        expect(Object.keys(operation.responses).sort(), `${method} ${path}`).toEqual([...new Set(covered)].sort());
      }
    }
  });

  it('el documento se sirve como YAML en /openapi.yaml', async () => {
    const baseUrl = await startApi(emptyPool());
    const response = await fetch(`${baseUrl}/openapi.yaml`);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/yaml');
    expect(text).toContain('/api/rentals/{id}/suspension:');
  });
});
