define(['./json_editor', './input', './checkbox'], function(jsonEditor, input, checkbox) {
  // uintN, intN, bytesN, bool, address, bytes, string, type[N], type[]
  return function(_) {
    return function(type, defaultVal) {
      if (type === 'bool') return checkbox(defaultVal);
      if (_.endsWith(type, ']')) return jsonEditor(type);
      return input(type, defaultVal);
    };
  };
});
