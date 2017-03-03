define(['async'], function(async) {

  var MIN_LEN_LOWER = 13;

  return function(_) {
    var folder = {
      init: function($container) {
        $container.find('[data-folder]').each(function() {
          var $el = $(this);

          var minLen = $el.data('folder-len') ? parseInt($el.data('folder-len'), 10) : MIN_LEN_LOWER;
          if (minLen < MIN_LEN_LOWER) {
            minLen = MIN_LEN_LOWER;
          }

          var text = $el.text();
          var tip = $el.data('bs.tooltip');
          if (tip) {
            if (text.length > minLen) {
              tip.options.title = text;
              tip.enable();
              $el.text(text.substr(0, 5) + '[...]' + text.substr(-3));
              $el.addClass('folded');
            } else {
              tip.disable();
              $el.removeClass('folded');
            }
          } else {
            $el.tooltip({ title: text, trigger: 'manual' });
            if (text.length > minLen) {
              $el.text(text.substr(0, 5) + '[...]' + text.substr(-3));
              $el.addClass('folded');
            } else {
              $el.data('bs.tooltip').disable();
              $el.removeClass('folded');
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
  }
});
