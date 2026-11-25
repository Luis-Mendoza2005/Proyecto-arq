import { describe, expect, it } from 'vitest';
import { PostgresVehicleRepository } from '../src/persistence/PostgresVehicleRepository.js';
import { VEHICLE_ID, createFakePool, vehicleRow } from './support/fixtures.js';

const vehicle = { id: VEHICLE_ID, plate: 'PBA-1234', brand: 'Chevrolet', model: 'Spark GT', year: 2021, status: 'available' };

describe('PostgresVehicleRepository', () => {
  it('parametriza el INSERT y mapea la fila al modelo', async () => {
    const pool = createFakePool(() => ({ rows: [vehicleRow()] }));
    const result = await new PostgresVehicleRepository(pool).create(vehicle);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('VALUES ($1, $2, $3, $4, $5, $6)'),
      [VEHICLE_ID, 'PBA-1234', 'Chevrolet', 'Spark GT', 2021, 'available'],
    );
    expect(result).toMatchObject({ id: VEHICLE_ID, plate: 'PBA-1234', status: 'available' });
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('devuelve null cuando la placa viola la restricción de unicidad', async () => {
    const pool = createFakePool(() => {
      throw Object.assign(new Error('duplicate key'), { code: '23505' });
    });
    await expect(new PostgresVehicleRepository(pool).create(vehicle)).resolves.toBeNull();
  });

  it('propaga otros errores de base de datos', async () => {
    const pool = createFakePool(() => {
      throw Object.assign(new Error('conexión caída'), { code: '08006' });
    });
    await expect(new PostgresVehicleRepository(pool).create(vehicle)).rejects.toThrow('conexión caída');
  });

  it('findById devuelve null si no existe y findAll filtra por estado con parámetro', async () => {
    const empty = createFakePool(() => ({ rows: [] }));
    await expect(new PostgresVehicleRepository(empty).findById(VEHICLE_ID)).resolves.toBeNull();

    const pool = createFakePool(() => ({ rows: [vehicleRow()] }));
    const result = await new PostgresVehicleRepository(pool).findAll({ status: 'available' });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE status = $1'), ['available']);
    expect(result).toHaveLength(1);
  });
});
