import Hjson from 'hjson';
import { isPlainObject, merge, omit } from 'lodash';
// const GenerateSchema = require('generate-schema/src/schemas/json.js');
import GenerateSchema from 'generate-schema/src/schemas/json';
export class HjsonData {
  constructor() {
    this.obj = null;
    // this.comments = null
    this.startCommentSymbol = '/*';
    this.endCommentSymbol = '*/';
  }
  parse(hjsonText, opts) {
    opts = opts || { keepWsc: true };

    this.obj = Hjson.parse(hjsonText, opts);

    return this;
  }
  stringify(opts) {
    opts = opts || {};
    return Hjson.rt.stringify(this.obj, opts);
  }
  // stringifyComments () {
  //   return Hjson.stringify(this.comments)
  // }
  getCommentJson(varName, pos) {
    let hjson = this.getCommentHjson(varName, pos);
    return hjson.obj;
  }
  getCommentHjson(varName, pos) {
    let comment = this.getComment(varName, pos);
    let commentHjson = new HjsonData().parse(comment);
    this.parseKey(commentHjson.obj, []);

    return commentHjson;
  }

  parseKey(obj) {
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (isPlainObject(item)) {
          this.parseKey(item);
        }
      });
    } else if (isPlainObject(obj)) {
      const keys = Object.keys(obj);

      let newHjson = null;
      keys.forEach(key => {
        const value = this.parseKey(obj[key]);
        const arr = key.split('|');
        if (isPlainObject(obj)) {
          this.parseKey(value);
        }

        if (arr.length > 1) {
          let newKey = arr[0];
          let componentName = arr[1];
          let params = arr.slice(2);
          const component = {
            __componentName: componentName,
            __componentParams: params,
            ...value,
          };

          params.forEach((param, index) => {
            component['__componentParam' + index] = param;
          });
          obj[newKey] = component;
          // obj[newKey] = obj[newKey] || [];
          // obj[newKey].push(component);
          delete obj[key];
        }
      });
    }
    return obj;
  }
  restoreKey(data, parentKey, parentNode) {
    if (isPlainObject(data)) {
      if ('__componentName' in data) {
        let newKey = [parentKey, data.__componentName]
          .concat(data.__componentParams || []) // data.__componentParams 不存在 时[]
          .join('|');
        parentNode[newKey] = data;

        delete parentNode[parentKey];
        delete data.__componentName;
        if (data.__componentParams) {
          delete data.__componentParams;
        }
      } else {
        Object.keys(data).forEach(key => {
          this.restoreKey(data[key], key, data);
        });
      }
    } else if (Array.isArray(data)) {
      data.forEach((item, index) => {
        this.restoreKey(item, index, data);
      });
    }
  }
  setCommentJson(varName, json, pos) {
    let cloneJson = clone(json);
    this.restoreKey(cloneJson);
    let comment = Hjson.stringify(cloneJson, {
      // bracesSameLine: true,
      emitRootBraces: false,
      separator: true,
    });
    comment = this.unwrapBrace(comment);
    this.setComment(varName, comment, pos);
    return this;
  }
  getRootCommentJson(pos) {
    let hjson = this.getRootCommentHjson(pos);
    return hjson.obj;
  }
  getRootCommentHjson(pos) {
    let comment = this.getRootComment(pos);
    let commentHjson = new HjsonData().parse(comment);
    this.parseKey(commentHjson.obj, []);
    return commentHjson;
  }
  setRootCommentJson(json, pos) {
    let cloneJson = clone(json);
    this.restoreKey(cloneJson);
    let comment = Hjson.stringify(cloneJson, {
      // bracesSameLine: true,
      emitRootBraces: false,
      separator: true,
    });
    comment = this.unwrapBrace(comment);
    this.setRootComment(comment, pos);
    return this;
  }
  getRootComment(pos = 0) {
    const originComments = this.getRootOriginComments(this.obj);
    const rootComment = originComments.r[pos];

    return this.unwrapCommentSymbol(rootComment);
  }
  setRootComment(value, pos = 0) {
    let rootComment = this.wrapCommentSymbol(value);
    const originComments = this.getRootOriginComments(this.obj);
    originComments.r[pos] = originComments.r[pos] || ['', ''];
    originComments.r[pos] = rootComment;
  }

  getComment(varName, pos = 0) {
    let { lastObj, lastKey } = this.getLastVarInfo(varName);

    const originComments = this.getOriginComments(lastObj);
    const comment = (originComments.c || originComments.a)[lastKey][pos];

    return this.unwrapCommentSymbol(comment);
  }

  setComment(varName, value, pos = 0) {
    let { lastObj, lastKey } = this.getLastVarInfo(varName);

    const originComments = this.getOriginComments(lastObj);
    if ('c' in originComments) {
      originComments.c[lastKey] = originComments.c[lastKey] || ['', ''];
      originComments.c[lastKey][pos] = this.wrapCommentSymbol(value);
    } else {
      originComments.a[lastKey] = originComments.a[lastKey] || ['', ''];
      originComments.a[lastKey][pos] = this.wrapCommentSymbol(value);
    }
  }

  getLastVarInfo(varName) {
    let lastObj = this.obj;
    let lastKey = varName;
    if (Array.isArray(varName)) {
      let value = this.obj;
      varName.forEach((key, index) => {
        if (index === varName.length - 1) {
          lastObj = value;
          lastKey = key;
        }
        value = value[key];
      });
    }

    return {
      lastObj,
      lastKey,
    };
  }

  getVar(varName) {
    if (Array.isArray(varName)) {
      let value = this.obj;
      varName.forEach(key => {
        value = value[key];
      });
      return value;
    } else if (varName) {
      return this.obj[varName];
    } else {
      return this.obj;
    }
  }

  setVar(varName, value, comment) {
    let lastObj = this.obj;
    let lastKey = varName;
    if (Array.isArray(varName)) {
      let value = this.obj;
      varName.forEach((key, index) => {
        if (index === varName.length - 1) {
          lastObj = value;
          lastKey = key;
        }
        value = value[key];
      });
      lastObj[lastKey] = value;
    } else {
      this.obj[varName] = value;
    }

    this.ensureKeyExist(lastObj, lastKey);

    if (comment) {
      this.setComment(varName, comment);
    }
    return this;
  }
  ensureKeyExist(obj, key) {
    const originComments = this.getOriginComments(obj);
    if (originComments.o.indexOf(key) === -1) {
      originComments.o.push(key);
    }
  }

  getRootOriginComments(obj) {
    obj.__COMMENTS__ = obj.__COMMENTS__ || { c: {}, o: [], r: ['', ''] };
    obj.__COMMENTS__.r = obj.__COMMENTS__.r || ['', ''];
    return obj.__COMMENTS__;
  }
  getOriginComments(obj) {
    obj.__COMMENTS__ = obj.__COMMENTS__ || { c: {}, o: [], r: ['', ''] };
    return obj.__COMMENTS__;
  }
  setOriginComments(obj, originComments) {
    obj.__COMMENTS__ = originComments;
  }

  updateVar(varName, newVarName) {
    let { lastObj, lastKey } = this.getLastVarInfo(varName);
    let lastValue = lastObj[lastKey];
    delete lastObj[lastKey];
    lastObj[newVarName] = lastValue;
  }

  wrapCommentSymbol(value) {
    return `${this.startCommentSymbol}${value}${this.endCommentSymbol}`;
  }
  unwrapCommentSymbol(value) {
    let startCommentSymbol = this.startCommentSymbol.replace(
      /([\*\/\\])/g,
      '\\$1'
    );
    let endCommentSymbol = this.endCommentSymbol.replace(/([\*\/\\])/g, '\\$1');

    let newValue = value
      .replace(new RegExp(`^\\s*${startCommentSymbol}`), '')
      .replace(new RegExp(`${endCommentSymbol}\\s*$`), '');

    return newValue;
  }
  unwrapBrace(value) {
    let newValue = value
      .replace(new RegExp(`^\\s*\\{`), '')
      .replace(new RegExp(`\\}\\s*$`), '');

    return `
      ${newValue}
    `;
  }
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export default HjsonData;

export function objToHjsonStr(obj) {
  return jsonToHjsonStr(JSON.stringify(obj));
}
export function objToHjson(obj) {
  const hj = new HjsonData().parse(JSON.stringify(obj));
  return hj;
}
export function jsonToHjsonStr(json) {
  const hj = new HjsonData().parse(json);
  return hj.stringify();
}

export function hjsonStrToObj(hjson) {
  const hj = new HjsonData().parse(hjson);
  return hj.obj;
}
export function hjsonToObj(hjson) {
  return JSON.parse(JSON.stringify(hjson.obj));
}
export function hjsonToHjsonStr(hjson) {
  return hjson.stringify();
}
export function hjsonToJsonSchema(text) {
  const hjson = new HjsonData().parse(text);

  const jsonSchema = GenerateSchema('root', hjson.obj);
  addComments(jsonSchema, hjson, []);
  return jsonSchema;
}

export function jsonSchemaToHjson(jsonSchema) {
  const obj = jsonSchemaToJson(jsonSchema);
  const hjson = objToHjson(obj);
  jsonSchemaMergeHjson(jsonSchema, hjson);
  return hjson.stringify();
}

function addComments(jsonSchema, hjson, paths) {
  const type = jsonSchema.type;
  const key = paths[paths.length - 1];
  let comments = null;
  if (paths.length === 0) {
    comments = hjson.getRootCommentJson();
  } else {
    comments = hjson.getCommentJson(paths);
  }
  merge(jsonSchema, comments);
  // jsonSchema = {
  //   ...jsonSchema,
  //   ...comments,
  // }
  if (type === 'object') {
    Object.keys(jsonSchema.properties).forEach(key => {
      const value = jsonSchema.properties[key];
      addComments(value, hjson, paths.concat(key));
    });
  } else if (type === 'array') {
    addComments(jsonSchema.items, hjson, paths.concat(0));
  }
  return jsonSchema;
}

function jsonSchemaToJson(jsonSchema) {
  let res = null;
  if (jsonSchema.type === 'object') {
    res = {};
    Object.keys(jsonSchema.properties).forEach(key => {
      let jsonSchemaItem = jsonSchema.properties[key];

      res[key] = jsonSchemaToJson(jsonSchemaItem);
    });
  } else if (jsonSchema.type === 'array') {
    res = [jsonSchemaToJson(jsonSchema.items)];
  } else {
    res = jsonSchema.default;
  }
  return res;
}

function jsonSchemaMergeHjson(jsonSchema, hjson, paths = []) {
  if (!paths.length) {
    hjson.setRootCommentJson({
      ...omit(jsonSchema, ['properties', 'items']),
    });
  } else {
    hjson.setCommentJson(paths, {
      ...omit(jsonSchema, ['properties', 'items']),
    });
  }

  if (jsonSchema.type === 'object') {
    Object.keys(jsonSchema.properties).forEach(key => {
      let jsonSchemaItem = jsonSchema.properties[key];
      jsonSchemaMergeHjson(jsonSchemaItem, hjson, paths.concat(key));
    });
  } else if (jsonSchema.type === 'array') {
    jsonSchemaMergeHjson(jsonSchema.items, hjson, paths.concat(0));
  }
}
