/**
 * 神灯 — minimal schemas for the lamp's two projections.
 *
 * A session projection validates its state and its client view through
 * `schema.parse(value)`. This plugin needs exactly two shapes, both shallow,
 * so it carries a small validator instead of adding a schema library to a
 * linked bundle: a linked package resolves no dependencies from the profile,
 * and pulling in a general-purpose validator for two objects would be the
 * "add a dependency" default the lamp itself advises against.
 *
 * `parse` throws on a shape violation, which is what the projection contract
 * expects, and returns the value unchanged on success.
 */

function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** State schema: `{ active, running }` with `running` a nullable command record. */
export const lampState = {
  parse(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`shenDeng state: expected an object, received ${describe(value)}`);
    }
    if (typeof value.active !== 'boolean') {
      throw new TypeError(`shenDeng state.active: expected a boolean, received ${describe(value.active)}`);
    }
    const running = value.running;
    if (running !== null) {
      if (typeof running !== 'object' || Array.isArray(running)) {
        throw new TypeError(`shenDeng state.running: expected null or an object, received ${describe(running)}`);
      }
      if (typeof running.commandId !== 'string') {
        throw new TypeError('shenDeng state.running.commandId: expected a string');
      }
      if (typeof running.wanted !== 'boolean') {
        throw new TypeError('shenDeng state.running.wanted: expected a boolean');
      }
    }
    return value;
  },
};

/** Client view schema: `{ active, pending }`. */
export const lampView = {
  parse(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`shenDeng view: expected an object, received ${describe(value)}`);
    }
    if (typeof value.active !== 'boolean') {
      throw new TypeError(`shenDeng view.active: expected a boolean, received ${describe(value.active)}`);
    }
    if (typeof value.pending !== 'boolean') {
      throw new TypeError(`shenDeng view.pending: expected a boolean, received ${describe(value.pending)}`);
    }
    return value;
  },
};

/**
 * State schema for the usage counter.
 *
 * These are counts of things that actually happened in the Session log, not
 * estimates: how many wish checks ran, how many open dimensions they found,
 * and how many vague phrases were flagged. Nothing here claims a token saving,
 * because "tokens not wasted on a rework" is a counterfactual and cannot be
 * measured.
 */
export const usageState = {
  parse(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`shenDengUsage state: expected an object, received ${describe(value)}`);
    }
    for (const key of ['checks', 'gaps', 'vague', 'scans']) {
      if (typeof value[key] !== 'number' || !Number.isInteger(value[key]) || value[key] < 0) {
        throw new TypeError(`shenDengUsage state.${key}: expected a non-negative integer, received ${describe(value[key])}`);
      }
    }
    return value;
  },
};

/** Client view: the same counters, cropped to what the dock renders. */
export const usageView = {
  parse(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`shenDengUsage view: expected an object, received ${describe(value)}`);
    }
    for (const key of ['checks', 'gaps']) {
      if (typeof value[key] !== 'number' || !Number.isInteger(value[key]) || value[key] < 0) {
        throw new TypeError(`shenDengUsage view.${key}: expected a non-negative integer`);
      }
    }
    return value;
  },
};
