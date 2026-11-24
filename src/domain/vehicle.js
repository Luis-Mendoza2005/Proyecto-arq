/**
 * Modelo de datos de un vehículo.
 *
 * @typedef {'available' | 'rented' | 'maintenance'} VehicleStatus
 *
 * @typedef {Object} Vehicle
 * @property {string} id
 * @property {string} plate
 * @property {string} brand
 * @property {string} model
 * @property {number} year
 * @property {VehicleStatus} status
 * @property {Date} createdAt
 */
export const VEHICLE_STATUSES = ['available', 'rented', 'maintenance'];