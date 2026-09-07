/**
 * @sarosia/apper - Client Authentication & User Profile Component
 */
(function() {
  function renderBadge(container, user) {
    if (!container || !user) return;
    const displayName = user.name || user.email;
    const avatar = user.picture
      ? `<img src="${user.picture}" alt="${displayName}" class="uk-border-circle" style="width: 24px; height: 24px; margin-right: 8px;" />`
      : `<span uk-icon="icon: user; ratio: 0.8" style="margin-right: 8px; color: #64748b;"></span>`;

    container.innerHTML = `
      <div class="user-profile-badge">
        ${avatar}
        <span class="user-email-text" title="${user.email}">${user.email}</span>
        <a href="/auth/logout" class="user-logout-btn" title="Sign Out">
          <span uk-icon="icon: sign-out; ratio: 0.8"></span>
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
