import { describe, expect, it, vi } from 'vitest';
import { ConflictError } from '../src/application/errors.js';
import { ListVehiclesService } from '../src/application/ListVehiclesService.js';
import { RegisterVehicleService } from '../src/application/RegisterVehicleService.js';

const validVehicle = { plate: 'pef4321', brand: ' Hyundai ', model: 'Accent', year: 2023 };
const clock = () => new Date('2026-11-22T12:00:00Z');

function setup(created) {
  const vehicles = {
    create: vi.fn().mockImplementation(async (vehicle) => (created === undefined ? vehicle : created)),
    findAll: vi.fn().mockResolvedValue([]),
  };
  return { service: new RegisterVehicleService(vehicles, clock), vehicles };
}

describe('RegisterVehicleService', () => {
  it('normaliza la placa y registra el vehículo como disponible', async () => {
    const { service, vehicles } = setup();
    const result = await service.execute(validVehicle);

    expect(result).toMatchObject({ plate: 'PEF-4321', brand: 'Hyundai', year: 2023, status: 'available' });
    expect(vehicles.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ plate: '1234-ABC' }, 'plate no es válido'],
    [{ plate: '' }, 'plate es obligatorio'],
    [{ brand: '  ' }, 'brand es obligatorio'],
    [{ year: 1980 }, 'year debe ser un entero entre 1990 y 2027.'],
    [{ year: 2028 }, 'year debe ser un entero entre 1990 y 2027.'],
    [{ year: 'dos mil' }, 'year debe ser un entero'],
    [{ color: 'rojo' }, 'El campo color no está permitido.'],
  ])('rechaza datos inválidos %j sin llamar al repositorio', async (override, message) => {
    const { service, vehicles } = setup();

    await expect(service.execute({ ...validVehicle, ...override })).rejects.toThrow(message);
    expect(vehicles.create).not.toHaveBeenCalled();
  });

  it('informa conflicto cuando la placa ya existe', async () => {
    const { service } = setup(null);
    await expect(service.execute(validVehicle)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('ListVehiclesService', () => {
  it('filtra por estado válido y rechaza estados desconocidos', async () => {
    const vehicles = { findAll: vi.fn().mockResolvedValue([]) };
    const service = new ListVehiclesService(vehicles);

    await service.execute({ status: 'available' });
    expect(vehicles.findAll).toHaveBeenCalledWith({ status: 'available' });
    expect(() => service.execute({ status: 'volando' })).toThrow('status debe ser uno de');
  });
});
