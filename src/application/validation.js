import { InvalidInputError } from './errors.js';
//Crear funciones de validación genericas que serán reutilizadas en todo el proyecto

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertPlainObject(value, message = 'El cuerpo debe ser un objeto JSON.') {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidInputError(message);
  }
}

export function rejectUnknownFields(input, allowedFields, prefix = '') {
  const allowed = new Set(allowedFields);
  const unexpected = Object.keys(input).find((field) => !allowed.has(field));
  if (unexpected) {
    throw new InvalidInputError(`El campo ${prefix}${unexpected} no está permitido.`);
  }
}

export function requiredText(value, field, maxLength = 160) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidInputError(`${field} es obligatorio y debe ser texto.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new InvalidInputError(`${field} no puede superar ${maxLength} caracteres.`);
  }
  return normalized;
}

export function textMatching(value, field, pattern, hint) {
  const normalized = requiredText(value, field, 40);
  if (!pattern.test(normalized)) {
    throw new InvalidInputError(`${field} no es válido: ${hint}.`);
  }
  return normalized;
}

export function validDate(value, field) {
  if (typeof value !== 'string' || !ISO_DATE_TIME.test(value)) {
    throw new InvalidInputError(`${field} debe ser una fecha ISO válida.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidInputError(`${field} debe ser una fecha ISO válida.`);
  }
  return parsed;
}

export function validUuid(value, field) {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new InvalidInputError(`${field} debe ser un UUID válido.`);
  }
  return value.toLowerCase();
}

export function oneOf(value, field, allowedValues) {
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    throw new InvalidInputError(`${field} debe ser uno de: ${allowedValues.join(', ')}.`);
  }
  return value;
}

export function integerInRange(value, field, min, max) {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d+$/.test(text)) {
    throw new InvalidInputError(`${field} debe ser un entero entre ${min} y ${max}.`);
  }
  const parsed = Number(text);
  if (parsed < min || parsed > max) {
    throw new InvalidInputError(`${field} debe ser un entero entre ${min} y ${max}.`);
  }
  return parsed;
}
