const COLUMNS = 'id, plate, brand, model, year, status, created_at';

export class PostgresVehicleRepository {
  constructor(pool) {
    this.pool = pool;
  }

  /** Devuelve el vehículo creado, o `null` si la placa ya existe. */
  async create(vehicle) {
    try {
      const result = await this.pool.query(
        `INSERT INTO vehicles (id, plate, brand, model, year, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNS}`,
        [vehicle.id, vehicle.plate, vehicle.brand, vehicle.model, vehicle.year, vehicle.status],
      );
      return this.toVehicle(result.rows[0]);
    } catch (error) {
      if (error?.code === '23505') {
        return null;
      }
      throw error;
    }
  }

  async findById(id) {
    const result = await this.pool.query(`SELECT ${COLUMNS} FROM vehicles WHERE id = $1`, [id]);
    return result.rows.length === 0 ? null : this.toVehicle(result.rows[0]);
  }

  async findAll({ status } = {}) {
    const result =
      status === undefined
        ? await this.pool.query(`SELECT ${COLUMNS} FROM vehicles ORDER BY plate ASC`)
        : await this.pool.query(
            `SELECT ${COLUMNS} FROM vehicles WHERE status = $1 ORDER BY plate ASC`,
            [status],
          );
    return result.rows.map((row) => this.toVehicle(row));
  }

  toVehicle(row) {
    return {
      id: row.id,
      plate: row.plate,
      brand: row.brand,
      model: row.model,
      year: row.year,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
