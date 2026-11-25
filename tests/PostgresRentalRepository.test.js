import { describe, expect, it } from 'vitest';
import { PostgresRentalRepository } from '../src/persistence/PostgresRentalRepository.js';
import { RENTAL_ID, VEHICLE_ID, createFakePool, rentalRow, validRentalRequest } from './support/fixtures.js';

const rental = {
  id: RENTAL_ID,
  vehicleId: VEHICLE_ID,
  customerName: 'Ana Pérez',
  customerIdNumber: '0912345678',
  customerPhone: '+593991234567',
  documents: validRentalRequest.documents,
  startsAt: new Date('2026-11-25T14:00:00.000Z'),
  endsAt: new Date('2026-11-28T14:00:00.000Z'),
};

describe('PostgresRentalRepository', () => {
  it('reserva el vehículo y crea el alquiler dentro de una transacción', async () => {
    const pool = createFakePool((sql) => {
      if (sql.startsWith('UPDATE vehicles')) return { rows: [{ id: VEHICLE_ID }] };
      if (sql.startsWith('SELECT')) return { rows: [rentalRow()] };
      return { rows: [] };
    });
    const result = await new PostgresRentalRepository(pool).createAndReserveVehicle(rental);

    expect(pool.log[0]).toBe('BEGIN');
    expect(pool.log.some((sql) => sql.startsWith('INSERT INTO rentals'))).toBe(true);
    expect(pool.log).toContain('COMMIT');
    expect(pool.client.release).toHaveBeenCalledTimes(1);
    expect(pool.client.query).toHaveBeenCalledWith(
      expect.stringContaining('VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)'),
      expect.arrayContaining([RENTAL_ID, VEHICLE_ID, 'docs/contrato-0001.pdf']),
    );
    expect(result).toMatchObject({
      id: RENTAL_ID,
      status: 'active',
      vehicle: { plate: 'PBA-1234' },
      documents: { signedContract: 'docs/contrato-0001.pdf' },
    });
  });

  it('hace ROLLBACK y devuelve null si el vehículo ya no está disponible', async () => {
    const pool = createFakePool(() => ({ rows: [] }));
    const result = await new PostgresRentalRepository(pool).createAndReserveVehicle(rental);

    expect(result).toBeNull();
    expect(pool.log).toContain('ROLLBACK');
    expect(pool.log.some((sql) => sql.startsWith('INSERT'))).toBe(false);
    expect(pool.client.release).toHaveBeenCalledTimes(1);
  });

  it('hace ROLLBACK, libera la conexión y propaga el error si falla el INSERT', async () => {
    const pool = createFakePool((sql) => {
      if (sql.startsWith('UPDATE vehicles')) return { rows: [{ id: VEHICLE_ID }] };
      throw new Error('fallo de base de datos');
    });

    await expect(new PostgresRentalRepository(pool).createAndReserveVehicle(rental)).rejects.toThrow(
      'fallo de base de datos',
    );
    expect(pool.log).toContain('ROLLBACK');
    expect(pool.log).not.toContain('COMMIT');
    expect(pool.client.release).toHaveBeenCalledTimes(1);
  });

  it('findMany parametriza los filtros y usa solo columnas de la lista blanca', async () => {
    const pool = createFakePool(() => ({ rows: [rentalRow()] }));
    const from = new Date('2026-11-01T00:00:00Z');
    const to = new Date('2026-11-30T00:00:00Z');

    const result = await new PostgresRentalRepository(pool).findMany({
      status: 'active',
      customerName: '50%_ana',
      vehicleId: VEHICLE_ID,
      from,
      to,
      sortBy: 'customerName',
      order: 'asc',
      limit: 10,
      offset: 5,
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('LOWER(r.customer_name) ASC, r.id ASC');
    expect(sql).toContain('LIMIT $6 OFFSET $7');
    expect(sql).not.toContain('50%_ana');
    expect(params).toEqual(['active', '%50\\%\\_ana%', VEHICLE_ID, from, to, 10, 5]);
    expect(result).toHaveLength(1);
    expect(result[0].customerName).toBe('Ana Pérez');
  });

  it('findMany ignora un sortBy desconocido en lugar de inyectarlo en el SQL', async () => {
    const pool = createFakePool(() => ({ rows: [] }));
    await new PostgresRentalRepository(pool).findMany({
      sortBy: 'id; DROP TABLE rentals',
      order: 'desc',
      limit: 50,
      offset: 0,
    });

    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).toContain('ORDER BY r.starts_at DESC, r.id ASC');
  });

  it('findById devuelve null cuando no hay fila', async () => {
    const pool = createFakePool(() => ({ rows: [] }));
    await expect(new PostgresRentalRepository(pool).findById(RENTAL_ID)).resolves.toBeNull();
  });

  it('markSuspended actualiza el alquiler, libera el vehículo y confirma la transacción', async () => {
    const pool = createFakePool((sql) => {
      if (sql.startsWith('UPDATE rentals')) return { rows: [{ vehicle_id: VEHICLE_ID }] };
      if (sql.startsWith('SELECT')) {
        return { rows: [rentalRow({ status: 'suspended', suspension_reason: 'Avería', suspended_at: new Date() })] };
      }
      return { rows: [] };
    });
    const result = await new PostgresRentalRepository(pool).markSuspended(RENTAL_ID, 'Avería');

    expect(pool.client.query).toHaveBeenCalledWith(expect.stringContaining("ends_at > NOW()"), [RENTAL_ID, 'Avería']);
    expect(pool.log.some((sql) => sql.startsWith('UPDATE vehicles SET status = \'available\''))).toBe(true);
    expect(pool.log).toContain('COMMIT');
    expect(result).toMatchObject({ status: 'suspended', suspensionReason: 'Avería' });
  });

  it('markSuspended devuelve null y hace ROLLBACK si el alquiler ya no está activo', async () => {
    const pool = createFakePool(() => ({ rows: [] }));
    const result = await new PostgresRentalRepository(pool).markSuspended(RENTAL_ID, 'Avería');

    expect(result).toBeNull();
    expect(pool.log).toContain('ROLLBACK');
    expect(pool.client.release).toHaveBeenCalledTimes(1);
  });
});
