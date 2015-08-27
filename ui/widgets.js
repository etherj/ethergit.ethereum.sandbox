define(['./json_editor', './input', './checkbox'], function(jsonEditor, input, checkbox) {
    // uintN, intN, bytesN, bool, address, bytes, string, type[N], type[]
    return function(type) {
        if (type === 'bool') return checkbox();
        if (_.endsWith(type, ']')) return jsonEditor(type);
        return input(type);
    };
});
