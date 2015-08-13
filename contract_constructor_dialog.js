define(function(require) {
    main.consumes = ['Dialog', 'ui', 'ethergit.libs', 'ethereum-console'];
    main.provides = ['ethergit.dialog.contract.constructor'];

    return main;

    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var libs = imports['ethergit.libs'];
        var ethConsole = imports['ethereum-console'];

        var async = require('async');
        var Contract = require('./contract');
        var Parsers = require('./parsers');

        var $ = libs.jquery();
        var _ = libs.lodash();

        // Cached elements
        var $name, $error, $args;
        var callback, args;

        var dialog = new Dialog('Ethergit', main.consumes, {
            name: 'sandbox-contract-constructor',
            allowClose: true,
            title: 'Contract Constructor',
            width: 500,
            elements: [
                {
                    type: 'button', id: 'submitContractConstructorDialog', color: 'green',
                    caption: 'Submit', 'default': true, onclick: submit
                }
            ]
        });

        dialog.on('draw', function(e) {
            e.html.innerHTML = require('text!./contract_constructor.html');
            var $root = $(e.html);
            $name = $root.find('[data-name=name]');
            $error = $root.find('[data-name=error]');
            $args = $root.find('[data-name=args]');
        });

        function askArgs(contract, cb) {
            args = _.findWhere(contract.abi, { type: 'constructor' }).inputs;
            
            if (!areTypesSupported()) {
                ethConsole.logger(function(err, logger) {
                    if (err) console.error(err);
                    else logger.error(
                        'Only uintN, intN, bytesN, bool, address, and string types are supported in constructors.'
                            + 'The contract <b>' + contract.name + '</b> has been created with empty args.'
                    );
                });
                return cb(null, []);
            }
            
            dialog.show();
            $name.text(contract.name);
            $args.empty();
            var argField = _.template(
                '<div class="form-group">\
                    <label for="<%= name %>" class="col-sm-4 control-label"><%= name %> : <%= type %></label>\
                    <div class="col-sm-8">\
                    <input type="text" name="<%= name %>" class="form-control" placeholder="">\
                    <p data-label="<%= name %>" class="help-block" style="display:none"></p>\
                </div></div>'
            );
            _.each(args, function(arg) {
                $args.append(argField({ name: arg.name, type: arg.type }));
            });
            callback = cb;

            function areTypesSupported() {
                var types = [/^uint\d+$/, /^int\d+$/, /^bytes\d+$/, /^bool$/, /^address$/, /^string$/];
                return _.every(args, function(arg) {
                    return _.some(types, function(type) {
                        return type.test(arg.type);
                    });
                });
            }
        }

        function submit() {
            $error.empty();
            $args.find('[data-label]').hide();
            $args.find('.has-error').removeClass('has-error');

            var inputs = _($args.find('input')).map(function(input) {
                var $input = $(input);
                return [$input.attr('name'), $input.val()];
            }).zipObject().value();

            var errors = _.reduce(args, function(result, arg) {
                var errs = Parsers.parser(arg.type).validate(inputs[arg.name]);
                if (errs.length > 0) result[arg.name] = errs;
                return result;
            }, {});

            if (_.size(errors) == 0) {
                hide();
                callback(null, _.map(args, function(arg) {
                    return Parsers.parser(arg.type).parse(inputs[arg.name]);
                }));
            } else {
                _.each(errors, function(error, name) {
                    $args.find('input[name=' + name + ']')
                        .parent().parent().addClass('has-error');
                    $args.find('[data-label=' + name + ']')
                        .text(error).show();
                });
            }
        }

        function hide() {
            dialog.hide();
        }

        dialog.freezePublicAPI({ askArgs: askArgs });

        register(null, { 'ethergit.dialog.contract.constructor': dialog });
    }
});
