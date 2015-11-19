define(['async'], function(async) {
  var folder = {
    init: function($container) {
      $container.find('[data-folder]').each(function() {
        var $el = $(this);
        var text = $el.text();
        var tip = $el.data('bs.tooltip');
        if (tip) {
          if (text.length > 13) {
            tip.options.title = text;
            tip.enable();
            $el.text(text.substr(0, 5) + '[...]' + text.substr(-3));
          } else {
            tip.disable();
          }
        } else {
          $el.tooltip({ title: text, trigger: 'manual' });
          if (text.length > 11) {
            $el.text(text.substr(0, 5) + '[...]' + text.substr(-3));
          } else {
            $el.data('bs.tooltip').disable();
          }
        }
      });
    },
    handler: function(e) {
      var $el = $(e.target);
      if ($el.hasClass('tooltip-inner')) return;
      
      var open = !!$el.attr('aria-describedby');
      
      var tips = _($('[data-folder]'))
            .map(function(el) { return $(el); })
            .filter(function($el) { return !!$el.attr('aria-describedby'); })
            .map(function($el) { return $el.data('bs.tooltip'); })
            .value();

      async.each(
        tips,
        function(tip, cb) { tip.hide(cb); },
        function() {
          if (!open && $el.data('folder') !== undefined) $el.tooltip('show');
        }
      );
    }
  };
  return folder;
});
