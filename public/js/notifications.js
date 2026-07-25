(function () {
  const menu = document.getElementById('notifMenu');
  if (!menu) return;

  const trigger   = document.getElementById('notifTrigger');
  const dropdown  = document.getElementById('notifDropdown');
  const badge     = document.getElementById('notifBadge');
  const list      = document.getElementById('notifList');
  const markAllBtn = document.getElementById('notifMarkAll');
  const footer     = document.getElementById('notifFooter');
  const loadMoreBtn = document.getElementById('notifLoadMore');
  const csrfToken = window.__csrfToken || '';

  let currentPage = 1;
  let hasMore = false;
  let isLoadingMore = false;

  const ICONS = {
    booking: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M8 3.5v4M16 3.5v4M3.5 10h17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    cancel: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M8 3.5v4M16 3.5v4M3.5 10h17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8 14h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-7.6-4.7-10-9.3C.5 8 1.8 4.8 5 3.8c2-.6 4 .1 5.2 1.9L12 8l1.8-2.3c1.2-1.8 3.2-2.5 5.2-1.9 3.2 1 4.5 4.2 3 7.4-2.4 4.6-10 9.3-10 9.3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.5a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H8.8a1.7 1.7 0 0 0 1-1.6V2.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 11.5 12 4l8 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9.5a1 1 0 0 0 1 1h3.5V16h3v4.5H17a1 1 0 0 0 1-1V10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    payout: '<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="6" width="19" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 10h19" stroke="currentColor" stroke-width="1.6"/><path d="M6 15h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    general: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2a7 7 0 0 0-7 7v4l-1.8 3.2A1 1 0 0 0 4 18h16a1 1 0 0 0 .87-1.5L19 13V9a7 7 0 0 0-7-7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.5 20.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };

  const timeAgo = (iso) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const escapeHtml = (str) => (str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const setBadge = (count) => {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.remove('hidden');
      trigger.classList.add('has-unread');
    } else {
      badge.classList.add('hidden');
      trigger.classList.remove('has-unread');
    }
    markAllBtn.disabled = count === 0;
  };

  const fetchUnreadCount = () => {
    fetch('/notifications/unread-count', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(data => setBadge(data.unreadCount || 0))
      .catch(() => {});
  };

  const buildItemHtml = (n) => {
    const icon = ICONS[n.icon] || ICONS.general;
    const unreadClass = n.isRead ? '' : ' unread';
    const dot = n.isRead ? '' : '<span class="notif-item-dot"></span>';
    return (
      '<a href="' + escapeHtml(n.link || '#') + '" class="notif-item' + unreadClass + '" data-id="' + n._id + '">' +
        '<span class="notif-item-icon">' + icon + '</span>' +
        '<span class="notif-item-body">' +
          '<p class="notif-item-title">' + escapeHtml(n.title) + '</p>' +
          '<p class="notif-item-message">' + escapeHtml(n.message) + '</p>' +
          '<span class="notif-item-time">' + timeAgo(n.createdAt) + '</span>' +
        '</span>' +
        dot +
      '</a>'
    );
  };

  const renderList = (notifications, { append = false } = {}) => {
    if (!append && !notifications.length) {
      list.innerHTML =
        '<div class="notif-empty">' +
        '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2a7 7 0 0 0-7 7v4l-1.8 3.2A1 1 0 0 0 4 18h16a1 1 0 0 0 .87-1.5L19 13V9a7 7 0 0 0-7-7Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9.5 20.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
        '<div>You\'re all caught up</div></div>';
      return;
    }
    const html = notifications.map(buildItemHtml).join('');
    if (append) {
      list.insertAdjacentHTML('beforeend', html);
    } else {
      list.innerHTML = html;
    }
  };

  const updateFooter = () => {
    footer.classList.toggle('hidden', !hasMore);
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load more';
  };

  const loadNotifications = () => {
    currentPage = 1;
    list.innerHTML = '<div class="notif-loading">Loading…</div>';
    footer.classList.add('hidden');
    fetch('/notifications?page=1', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(data => {
        renderList(data.notifications || []);
        setBadge(data.unreadCount || 0);
        hasMore = !!data.hasMore;
        currentPage = data.page || 1;
        updateFooter();
      })
      .catch(() => {
        list.innerHTML = '<div class="notif-loading">Couldn\'t load notifications.</div>';
      });
  };

  const loadMore = () => {
    if (isLoadingMore || !hasMore) return;
    isLoadingMore = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading…';
    fetch('/notifications?page=' + (currentPage + 1), { credentials: 'same-origin' })
      .then(r => r.json())
      .then(data => {
        renderList(data.notifications || [], { append: true });
        hasMore = !!data.hasMore;
        currentPage = data.page || currentPage + 1;
        isLoadingMore = false;
        updateFooter();
      })
      .catch(() => {
        isLoadingMore = false;
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load more';
      });
  };

  const closeDropdown = () => {
    menu.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = !menu.classList.contains('open');
    menu.classList.toggle('open', willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) loadNotifications();
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) closeDropdown();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.notif-item');
    if (!item) return;
    const id = item.dataset.id;
    if (id && item.classList.contains('unread')) {
      item.classList.remove('unread');
      const dot = item.querySelector('.notif-item-dot');
      if (dot) dot.remove();
      fetch('/notifications/' + id + '/read', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'CSRF-Token': csrfToken }
      }).then(r => r.json()).then(data => {
        if (typeof data.unreadCount === 'number') setBadge(data.unreadCount);
      }).catch(() => {});
    }
    // let the link navigate normally
  });

  loadMoreBtn.addEventListener('click', loadMore);

  markAllBtn.addEventListener('click', () => {
    if (markAllBtn.disabled) return;
    fetch('/notifications/read-all', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'CSRF-Token': csrfToken }
    }).then(r => r.json()).then(() => {
      setBadge(0);
      list.querySelectorAll('.notif-item.unread').forEach(el => {
        el.classList.remove('unread');
        const dot = el.querySelector('.notif-item-dot');
        if (dot) dot.remove();
      });
    }).catch(() => {});
  });

  fetchUnreadCount();
  setInterval(fetchUnreadCount, 30000);
})();
