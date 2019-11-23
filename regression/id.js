const R = require("ramda");

function isIdField(key, value) {
  return (
    ["_id", "id", "oid"].includes(key) &&
    typeof value === "string" &&
    value.length === "5dd9301ac56fe6827ce6da66".length
  );
}

function mapIds(cb, object) {
  return R.mapObjIndexed((v, k) => (isIdField(k, v) ? cb(v) : v), object);
}

class IdInferrer {
  constructor() {
    this.oldIdsByNew = new Map();
  }

  remapIdsToOld(newObject) {
    return mapIds(newId => {
      const oldId = this.oldIdsByNew.get(newId);
      if (!oldId) {
        throw new Error(`no mapping from new id ${newId} to an old id`);
      }
      return oldId;
    }, newObject);
  }

  addMapping(oldId, newId) {
    const existing = this.oldIdsByNew.get(newId);
    if (!existing) {
      this.oldIdsByNew.set(newId, oldId);
    } else if (existing !== oldId) {
      throw new Error(
        `conficting id mapping (new id ${newId} maps to both old id ${existing} and old id ${oldId})`,
      );
    }
  }

  learnMappings(oldObject, newObject) {
    if (!R.equals(...[oldObject, newObject].map(o => mapIds(() => "", o)))) {
      throw new Error("objects must be identical except ids");
    }
    R.mergeDeepWithKey(
      (k, oldValue, newValue) => {
        if (isIdField(k, oldValue) !== isIdField(k, newValue)) {
          throw new Error(
            "field type inferred differently in old and new object",
          );
        }
        if (isIdField(k, oldValue)) {
          this.addMapping(oldValue, newValue);
        }
      },
      oldObject,
      newObject,
    );
  }
}

module.exports = { IdInferrer, mapIds };
