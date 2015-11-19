define(['async'], function(async) {
  var folder = {
    init: function($container) {
      $container.find('[data-folder]').each(function() {
        var $el = $(this);
        $el.tooltip('destroy');
        var text = $el.text();
        if (text.length > 11) {
          $el.tooltip({ title: $el.text(), trigger: 'manual' });
          $el.text(text.substr(0, 5) + '[...]' + text.substr(-3));
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
