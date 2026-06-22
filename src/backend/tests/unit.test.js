// Pruebas unitarias rápidas (sin infraestructura): lógica pura de D&D.
const test = require('node:test');
const assert = require('node:assert');
const { abilityMod, rollDie, randomCode } = require('../src/helpers');

test('abilityMod calcula el modificador de característica', () => {
  assert.strictEqual(abilityMod(10), 0);
  assert.strictEqual(abilityMod(12), 1);
  assert.strictEqual(abilityMod(8), -1);
  assert.strictEqual(abilityMod(20), 5);
});

test('rollDie devuelve un valor dentro del rango', () => {
  for (let i = 0; i < 500; i++) {
    const r = rollDie(20);
    assert.ok(r >= 1 && r <= 20, `fuera de rango: ${r}`);
  }
});

test('randomCode genera códigos del largo pedido', () => {
  assert.strictEqual(randomCode(6).length, 6);
  assert.match(randomCode(8), /^[A-Z0-9]+$/);
});
