/**
 * @sarosia/apper - Client Authentication & User Profile Component
 */
(function() {
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
  }

  function renderBadge(container, user) {
    if (!container || !user) return;
    const displayName = user.name || user.email || 'User';
    const initial = (displayName || 'U').charAt(0).toUpperCase();
    const avatarHtml = user.picture ?
      `<img src="${escapeHtml(user.picture)}" alt="Profile" class="user-avatar-img" />` :
      `<div class="user-avatar-fallback">${escapeHtml(initial)}</div>`;

    container.innerHTML = `
      <div class="uk-inline user-profile-container">
        <button class="user-avatar-btn" type="button"
          aria-label="Account: ${escapeHtml(displayName)}"
          title="${escapeHtml(displayName)}${user.email ? ` (${escapeHtml(user.email)})` : ''}">
          ${avatarHtml}
        </button>
        <div uk-dropdown="mode: click; pos: bottom-right; offset: 8" class="user-dropdown-card">
          <a href="/auth/logout" class="uk-button uk-button-small uk-width-1-1 user-dropdown-logout-btn">
            <span uk-icon="icon: sign-out; ratio: 0.8" class="uk-margin-small-right"></span>Sign Out
          </a>
        </div>
      </div>
    `;

    if (window.UIkit && window.UIkit.icon) {
      const iconEl = container.querySelector('span[uk-icon]');
      if (iconEl) {
        window.UIkit.icon(iconEl);
      }
    }
  }

  async function fetchUser() {
    try {
      const res = await fetch('/auth/me');
      if (res.status === 401) {
        window.location.href = '/login';
        return null;
      }
      if (res.ok) {
        const data = await res.json();
        return data.user;
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
    return null;
  }

  // Web Component definition
  if (typeof customElements !== 'undefined' && !customElements.get('apper-user-profile')) {
    class ApperUserProfile extends HTMLElement {
      async connectedCallback() {
        const user = await fetchUser();
        if (user) {
          renderBadge(this, user);
        }
      }
    }
    customElements.define('apper-user-profile', ApperUserProfile);
  }

  // Auto-render into #user-profile if present
  document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('user-profile');
    if (container && !container.innerHTML.trim()) {
      const user = await fetchUser();
      if (user) {
        renderBadge(container, user);
      }
    }
  });

  window.ApperAuth = {
    fetchUser,
    renderBadge,
    renderUserProfile: renderBadge,
    escapeHtml,
  };
})();
