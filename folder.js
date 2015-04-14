define(function(require) {
    var folder = {
        init: function($container) {
            $container.find('[data-folder]').each(function() {
                var $el = $(this);
                $el.data('folder', $el.text());
                folder.fold($el);
            });
        },
        foldOrUnfold: function(e) {
            var $el = $(e.target);
            var foldData = $el.data('folder');
            if (foldData !== undefined) {
                if (foldData === $el.text()) folder.fold($el);
                else folder.unfold($el);
            }
        },
        fold: function($el) {
            var text = $el.data('folder');
            if (text.length > 11) {
                $el.text(text.substr(0, 3) + '[...]' + text.substr(-3));
            }
        },
        unfold: function($el) {
            var text = $el.data('folder');
            if (text.length > 11) $el.text(text);
        }
    };
    return folder;
});