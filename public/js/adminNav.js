(function () {
  var sidebar  = document.querySelector('.sidebar');
  var toggle   = document.querySelector('.menu-toggle');
  var backdrop = document.querySelector('.sidebar-backdrop');
  if (!sidebar || !toggle) return;

  function closeNav() {
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }
  function openNav() {
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
  }

  toggle.addEventListener('click', function () {
    sidebar.classList.contains('open') ? closeNav() : openNav();
  });
  if (backdrop) backdrop.addEventListener('click', closeNav);
  document.querySelectorAll('.sidebar a').forEach(function (a) {
    a.addEventListener('click', closeNav);
  });
})();