/** El estado "finished" se deriva: un alquiler activo cuyo fin ya pasó. */
const EFFECTIVE_STATUS = `(CASE WHEN r.status = 'active' AND r.ends_at <= NOW()
                                THEN 'finished' ELSE r.status END)`;

const SELECT_RENTAL = `
  SELECT r.id, r.customer_name, r.customer_id_number, r.customer_phone,
         r.identity_document_ref, r.driver_license_ref, r.signed_contract_ref,
         r.starts_at, r.ends_at, ${EFFECTIVE_STATUS} AS status,
         r.suspension_reason, r.suspended_at, r.created_at,
         v.id AS vehicle_id, v.plate AS vehicle_plate,
         v.brand AS vehicle_brand, v.model AS vehicle_model
  FROM rentals r
  JOIN vehicles v ON v.id = r.vehicle_id`;

/** Lista blanca: el nombre de columna nunca proviene directamente del cliente. */
const SORT_EXPRESSIONS = {
  startsAt: 'r.starts_at',
  customerName: 'LOWER(r.customer_name)',
  duration: '(r.ends_at - r.starts_at)',
  createdAt: 'r.created_at',
};

export class PostgresRentalRepository {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Reserva el vehículo y crea el alquiler en una sola transacción.
   * Devuelve `null` si el vehículo ya no está disponible.
   */
  async createAndReserveVehicle(rental) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const reserved = await client.query(
        `UPDATE vehicles SET status = 'rented'
         WHERE id = $1 AND status = 'available'
         RETURNING id`,
        [rental.vehicleId],
      );
      if (reserved.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `INSERT INTO rentals (id, vehicle_id, customer_name, customer_id_number, customer_phone,
                              identity_document_ref, driver_license_ref, signed_contract_ref,
                              starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          rental.id,
          rental.vehicleId,
          rental.customerName,
          rental.customerIdNumber,
          rental.customerPhone,
          rental.documents.identityDocument,
          rental.documents.driverLicense,
          rental.documents.signedContract,
          rental.startsAt,
          rental.endsAt,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    return this.findById(rental.id);
  }

  async findById(id) {
    const result = await this.pool.query(`${SELECT_RENTAL} WHERE r.id = $1`, [id]);
    return result.rows.length === 0 ? null : this.toRental(result.rows[0]);
  }

  async findMany(filters) {
    const conditions = [];
    const values = [];
    const param = (value) => {
      values.push(value);
      return `$${values.length}`;
    };

    if (filters.status !== undefined) conditions.push(`${EFFECTIVE_STATUS} = ${param(filters.status)}`);
    if (filters.customerName !== undefined) {
      const escaped = filters.customerName.replace(/[\\%_]/g, (char) => `\\${char}`);
      conditions.push(`r.customer_name ILIKE ${param(`%${escaped}%`)}`);
    }
    if (filters.vehicleId !== undefined) conditions.push(`r.vehicle_id = ${param(filters.vehicleId)}`);
    if (filters.from !== undefined) conditions.push(`r.starts_at >= ${param(filters.from)}`);
    if (filters.to !== undefined) conditions.push(`r.starts_at <= ${param(filters.to)}`);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortExpression = SORT_EXPRESSIONS[filters.sortBy] ?? SORT_EXPRESSIONS.startsAt;
    const direction = filters.order === 'asc' ? 'ASC' : 'DESC';
    const limit = param(filters.limit);
    const offset = param(filters.offset);

    const result = await this.pool.query(
      `${SELECT_RENTAL} ${where} ORDER BY ${sortExpression} ${direction}, r.id ASC
       LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return result.rows.map((row) => this.toRental(row));
  }

  /**
   * Suspende un alquiler vigente y libera el vehículo.
   * Devuelve `null` si el alquiler ya no está activo (finalizó o ya estaba suspendido).
   */
  async markSuspended(id, reason) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE rentals
         SET status = 'suspended', suspension_reason = $2, suspended_at = NOW()
         WHERE id = $1 AND status = 'active' AND ends_at > NOW()
         RETURNING vehicle_id`,
        [id, reason],
      );
      if (updated.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `UPDATE vehicles SET status = 'available' WHERE id = $1 AND status = 'rented'`,
        [updated.rows[0].vehicle_id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    return this.findById(id);
  }

  toRental(row) {
    return {
      id: row.id,
      customerName: row.customer_name,
      customerIdNumber: row.customer_id_number,
      customerPhone: row.customer_phone,
      vehicle: {
        id: row.vehicle_id,
        plate: row.vehicle_plate,
        brand: row.vehicle_brand,
        model: row.vehicle_model,
      },
      documents: {
        identityDocument: row.identity_document_ref,
        driverLicense: row.driver_license_ref,
        signedContract: row.signed_contract_ref,
      },
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      suspensionReason: row.suspension_reason,
      suspendedAt: row.suspended_at,
      createdAt: row.created_at,
    };
  }
}
