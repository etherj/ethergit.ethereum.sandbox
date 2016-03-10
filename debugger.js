define(function(require, exports, module) {
  main.consumes = ['Plugin', 'debugger'];
  main.provides = ['ether.camp.solidity.debugger'];
  return main;

  function main(options, imports, register) {
    var Plugin = imports.Plugin;
    var debug = imports['debugger'];
    var Frame = debug.Frame;
    var Source = debug.Source;
    var Breakpoint = debug.Breakpoint;
    var Variable = debug.Variable;
    var Scope = debug.Scope;

    var TYPE = 'solidity';

    var socket;
    var attached = false;
    var state = null;
    var breakOnExceptions = false;
    var breakOnUncaughtExceptions = false;

    var plugin = new Plugin('Ether.camp', main.consumes);
    var emit = plugin.getEmitter();
    emit.setMaxListeners(1000);

    plugin.on('load', function() {
      debug.registerDebugger(TYPE, plugin);
    });
    plugin.on('unload', function() {
      debug.unregisterDebugger(TYPE, plugin);
    });

    // Helper functions

    function sync(breakpoints, reconnect, callback){
      attached = true;
      emit('attach', { breakpoints: breakpoints });
      
      if (frames.length) {
        emit('frameActivate', { frame: frames[0] });
        emit('break', {
            frame: frames[0],
            frames: frames
        });
        state = 'stopped';
      } else {
        state = 'running';
      }
      emit('stateChange', { state: state });
    }

    function createSource(options) {
      return new Source({
        // etc
      });
    }

    function createFrame(options, index) {
      var frame = new Frame({
        istop: index == 0
        // etc
      });
    }

    function createVariable(options) {
      return new Variable({
        // etc
      });
    }
    
    // API functions 
    
    function attach(s, reconnect, callback) {
      socket = s;

      socket.on('back', function(err) {
        sync(emit('getBreakpoints'), true);
      }, plugin);
      socket.on('error', function(err) {
        emit('error', err);
      }, plugin);

      attachToDebugger(socket, function(err) {
        if (err) return callback(err);
        
        // Reset the active frame
        emit('frameActivate', { frame: null });
        
        // Initialize the connected debugger
        sync(emit('getBreakpoints'), reconnect, callback);
      });
    }

    function detach() {
      detachFromDebugger();

      emit('frameActivate', { frame: null });
      emit('stateChange', { state: null });

      attached = false;
      emit('detach');
    }

    function getSources(callback) {
      getSourcesFromDebugger(function(err, scripts) {
        if (err) return callback(err);
        
        var sources = scripts.map(function(options){
          return createSource(options);
        });
        
        callback(null, sources);
        emit("sources", { sources: sources });
      });
    }

    function getSource(source, callback) {
      getSourceFromDebugger(source, function(err, code) {
        callback(err, code);
      });
    }

    function getFrames(callback, silent) {
      getFramesFromDebugger(function(err, items) {
        frames = items.map(function(options, index) {
          return createFrame(frame, index);
        });
        
        emit("getFrames", { frames: frames });
        callback(null, frames);
      });
    }

    function getScope(frame, scope, callback) {
      getScopeFromDebugger(scope.index, frame.index, function(err, properties) {
        if (err) return callback(err);
        
        var variables = properties.map(function(options) {
          return createVariable(options);
        });
        
        scope.variables = variables;
        callback(null, variables, scope, frame);
      });
    }

    function getProperties(variable, callback) {
      getPropertiesFromDebugger(variable.ref, function(err, props) {
        if (err) return callback(err);
        
        if (props.length > 5000) {
          props = [new Variable({
            name: "Too many properties",
            type: "error", 
            value: "Found more than 5000 properties",
            children: false
          })];
          
          variable.properties = props;
          callback(null, props, variable);
          return;
        }
        
        var properties = props.map(function(prop) { 
          return createVariable(prop);
        });
        
        variable.properties = properties;
        callback(null, properties, variable);
      });
    }

    function stepInto(callback) {
      stepIntoDebugger(function(err){ callback(err); });
    }

    function stepOver(callback) {
      stepOverDebugger(function(err){ callback(err); });
    }

    function stepOut(callback) {
      stepOutDebugger(function(err){ callback(err); });
    }

    function resume(callback) {
      resumeDebugger(function(err){ callback(err); });
    }

    function suspend(callback) {
      suspendDebugger(function(err){
        if (err) return callback(err);
        
        emit("suspend");
        callback();
      });
    }

    function evaluate(expression, frame, global, disableBreak, callback) {
      var frameIndex = frame && typeof frame == "object" ? frame.index : frame;
      
      evaluateInDebugger(
        expression, frameIndex, global, disableBreak, 
        function(error, value, properties) {
          var name = expression.trim();
          if (error) {
            var err = new Error(error.message);
            err.name = name;
            err.stack = error.stack;
            return callback(err);
          }

          var variable = createVariable({
            name: name,
            value: value
          });
          if (properties)
            variable.properties = properties;
          
          callback(null, variable);
        });
    }

    function setScriptSource(script, newSource, previewOnly, callback) {
      setScriptSourceInDebugger(script.id, newSource, previewOnly, function(err, data) {
        if (err)
          callback(new Error("Could not update source"));
        
        emit("setScriptSource", data);
        callback(null, data);
      });
    };

    function setBreakpoint(bp, callback) {
      setBreakpointAtDebugger(bp, function(info) {
        if (isDifferentLocation(info, bp)) {
          updateBreakpoint(bp, info);
          emit("breakpointUpdate", { breakpoint: bp });
        }
        callback(null, bp, info);
      });
      return true;
    }

    function changeBreakpoint(bp, callback) {
      changeBreakpointAtDebugger(function(err, data) {
        callback(err, bp, data);
      });
    }

    function clearBreakpoint(bp, callback) {
      clearBreakpointAtDebugger(bp, function(err) {
        callback(err);
      });
    }

    function listBreakpoints(callback) {
      listBreakpointsAtDebugger(function(err, breakpoints) {
        if (err) return callback(err);
        
        callback(null, breakpoints.map(function(bp) {
          return createBreakpoint(bp);
        }));
      });
    }

    function setVariable(variable, parents, value, frame, callback) {
      setVariableAtDebugger(variable, parents, value, frame, function(err, options){
        if (err) return callback(err)
        callback(null, createVariable(options));
      });
    }

    function restartFrame(frame, callback) {
      var frameIndex = frame && typeof frame == "object" ? frame.index : frame;
      
      restartFrameAtDebugger(frameIndex, function(err, data) {
        callback(err, data);
      });
    }

    function serializeVariable(variable, callback) {
      serializeVariableAtDebugger(variable, function(err, value) {
        callback(err, value);
      });
    }

    function setBreakBehavior(type, enabled, callback) {
      breakOnExceptions = enabled ? type == "all" : false;
      breakOnUncaughtExceptions = enabled ? type == "uncaught" : false;
      
      setBreakBehavior(type, enabled, callback);
    }

    function getProxySource(process){
      return debug.proxySource
        .replace(/\/\/.*/g, "")
        .replace(/[\n\r]/g, "")
        .replace(/\{PORT\}/, process.runner[0].debugport);
    }
    
    plugin.freezePublicAPI({
      type: TYPE,
      
      features: {
        scripts: false,
        conditionalBreakpoints: false,
        liveUpdate: false,
        updateWatchedVariables: false,
        updateScopeVariables: false,
        setBreakBehavior: false,
        executeCode: false
      },

      _events: [
        'attach',
        'detach',
        'suspend',
        'setScriptSource',
        'error',
        'getBreakpoints',
        'breakpointUpdate',
        'break',
        'stateChange',
        'exception',
        'frameActivate',
        'getFrames',
        'sources',
        'sourcesCompile'
      ],
      
      get attached() { return attached; },
      get state() { return state; },
      get breakOnExceptions() { return breakOnExceptions; },
      get breakOnUncaughtExceptions() { return breakOnUncaughtExceptions; },

      attach: attach,
      detach: detach,
      getSources: getSources,
      getSource: getSource,
      getFrames: getFrames,
      getScope: getScope,
      getProperties: getProperties,
      stepInto: stepInto,
      stepOver: stepOver,
      stepOut: stepOut,
      resume: resume,
      suspend: suspend,
      evaluate: evaluate,
      setScriptSource: setScriptSource,
      setBreakpoint: setBreakpoint,
      changeBreakpoint: changeBreakpoint,
      clearBreakpoint: clearBreakpoint,
      listBreakpoints: listBreakpoints,
      setVariable: setVariable,
      restartFrame: restartFrame,
      serializeVariable: serializeVariable,
      setBreakBehavior: setBreakBehavior,
      getProxySource: getProxySource
    });
    
    register(null, { 'ether.camp.solidity.debugger': plugin });
  }
});
