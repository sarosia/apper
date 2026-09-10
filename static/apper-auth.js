/**
 * @sarosia/apper - Client Authentication & User Profile Component
 */
(function() {
  function renderBadge(container, user) {
    if (!container || !user) return;
    const displayName = user.name || 'User';
    const avatar = user.picture
      ? `<img src="${user.picture}" alt="${displayName}" class="uk-border-circle" style="width: 32px; height: 32px;" />`
      : `<span uk-icon="icon: user; ratio: 0.8" style="color: #64748b;"></span>`;

    container.innerHTML = `
      <div class="user-profile-badge" style="padding: 2px;">
        <a href="/auth/logout" class="user-logout-btn" title="Sign Out (${displayName})" style="text-decoration:none;">
          ${avatar}
        </a>
      </div>
    `;
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
    renderBadge
  };
})();
