import { useEffect, useMemo, useReducer, useState } from 'react';
import { apiRequest } from '../api.js';
import { buildBodyPreview, formatFullDate, normaliseTags, timeAgo } from '../utils.js';
import AdminPanel from './AdminPanel.jsx';

const PROMPT_TYPE_COLOURS = {
  General: 'bg-[#10a37f]/10 text-[#10a37f]',
  Coding: 'bg-blue-500/10 text-blue-400',
  Writing: 'bg-amber-500/10 text-amber-400',
  Research: 'bg-purple-500/10 text-purple-400',
  Creative: 'bg-pink-500/10 text-pink-300',
  Data: 'bg-red-500/10 text-red-400',
};

const PROMPT_TYPES = ['General', 'Coding', 'Writing', 'Research', 'Creative', 'Data'];

const CATEGORY_COLOURS = [
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#f97316',
  '#14b8a6',
];

const initialState = {
  prompts: [],
  categories: [],
  stats: { total: 0, totalCategories: 0, totalCopies: 0 },
  users: [],
  activities: [],
  loadingVault: true,
  loadingAdmin: false,
  error: '',
};

// Reducer keeps vault/admin data updates in one predictable place.
function vaultReducer(state, action) {
  switch (action.type) {
    case 'vault-loading':
      return { ...state, loadingVault: action.value, error: '' };
    case 'vault-loaded':
      return {
        ...state,
        prompts: action.prompts,
        categories: action.categories,
        stats: action.stats,
        loadingVault: false,
        error: '',
      };
    case 'admin-loading':
      return { ...state, loadingAdmin: action.value, error: '' };
    case 'admin-loaded':
      return {
        ...state,
        users: action.users,
        activities: action.activities,
        loadingAdmin: false,
        error: '',
      };
    case 'prompt-copied':
      return {
        ...state,
        prompts: state.prompts.map((prompt) => (
          prompt.id === action.id
            ? { ...prompt, usageCount: action.usageCount }
            : prompt
        )),
        stats: {
          ...state.stats,
          totalCopies: Math.max(0, state.stats.totalCopies + action.delta),
        },
      };
    case 'error':
      return { ...state, loadingVault: false, loadingAdmin: false, error: action.message };
    default:
      return state;
  }
}

function BookMark() {
  return (
    <svg className="book-icon-animate" fill="none" height="24" viewBox="0 0 24 24" width="24">
      <ellipse className="glow-animate" cx="12" cy="12" fill="#7c3aed" rx="6" ry="8" style={{ mixBlendMode: 'screen' }} />
      <g stroke="#e4e1e9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <path d="M12 19V5C12 5 10 4 6 4C2 4 2 7 2 7V18C2 18 2 15 6 15C10 15 12 16 12 16" />
        <path d="M12 19V5C12 5 14 4 18 4C22 4 22 7 22 7V18C22 18 22 15 18 15C14 15 12 16 12 16" />
        <line strokeOpacity="0.3" x1="12" x2="12" y1="5" y2="19" />
      </g>
    </svg>
  );
}

export default function VaultApp({ getToken, profile, onLogout }) {
  const [state, dispatch] = useReducer(vaultReducer, initialState);
  const [view, setView] = useState('vault');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [toast, setToast] = useState('');
  const [easterEggOpen, setEasterEggOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    promptType: '',
    category: '',
    sort: 'newest',
  });

  const isAdmin = profile.role === 'admin';

  // Vault load pulls prompts, categories, and stats in one request.
  async function loadVault() {
    dispatch({ type: 'vault-loading', value: true });

    try {
      const { prompts, categories, stats } = await apiRequest('/api/vault', {
        tokenProvider: getToken,
      });

      dispatch({ type: 'vault-loaded', prompts, categories, stats });
    } catch (error) {
      dispatch({ type: 'error', message: error.message });
    }
  }

  // Admin load fetches users and activity logs side by side.
  async function loadAdmin() {
    if (!isAdmin) {
      return;
    }

    dispatch({ type: 'admin-loading', value: true });

    try {
      const [users, activities] = await Promise.all([
        apiRequest('/api/users', { tokenProvider: getToken }),
        apiRequest('/api/activities', { tokenProvider: getToken }),
      ]);

      dispatch({ type: 'admin-loaded', users, activities });
    } catch (error) {
      dispatch({ type: 'error', message: error.message });
    }
  }

  useEffect(() => {
    loadVault();
  }, [getToken]);

  useEffect(() => {
    if (view === 'admin') {
      loadAdmin();
    }
  }, [view]);

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(''), 3000);
  }

  const categoryPromptCounts = useMemo(() => {
    return state.prompts.reduce((counts, prompt) => {
      const categoryId = prompt.category?.id || prompt.categoryId;
      if (categoryId) {
        counts[categoryId] = (counts[categoryId] || 0) + 1;
      }
      return counts;
    }, {});
  }, [state.prompts]);

  // Live search filters prompt cards without a page reload.
  const visiblePrompts = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase();
    const filtered = state.prompts.filter((prompt) => {
      const matchesSearch = !searchValue || [
        prompt.title,
        prompt.body,
        prompt.promptType,
        prompt.category?.name,
        ...(prompt.tags || []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(searchValue);

      const matchesType = !filters.promptType || prompt.promptType === filters.promptType;
      const matchesCategory = !filters.category || prompt.category?.id === filters.category;

      return matchesSearch && matchesType && matchesCategory;
    });

    return filtered.sort((a, b) => {
      if (filters.sort === 'rating') {
        return (b.rating || 0) - (a.rating || 0) || new Date(b.updatedAt) - new Date(a.updatedAt);
      }

      if (filters.sort === 'usage') {
        return (b.usageCount || 0) - (a.usageCount || 0) || new Date(b.updatedAt) - new Date(a.updatedAt);
      }

      if (filters.sort === 'oldest') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }

      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [state.prompts, filters]);

  function openNewPrompt() {
    setSelectedPrompt(null);
    setSheetOpen(true);
  }

  function openPrompt(prompt) {
    setSelectedPrompt(prompt);
    setSheetOpen(true);
  }

  // Prompt CRUD save handles both create and update from one sheet.
  async function savePrompt(payload) {
    const isEditing = Boolean(payload.id);
    await apiRequest(isEditing ? `/api/prompts/${payload.id}` : '/api/prompts', {
      method: isEditing ? 'PATCH' : 'POST',
      tokenProvider: getToken,
      body: payload,
    });

    await loadVault();
    setSheetOpen(false);
    showToast('Spell Brewed');
  }

  // Prompt delete stays owner-scoped through the backend route.
  async function deletePrompt(id) {
    if (!id) {
      setSheetOpen(false);
      return;
    }

    if (!window.confirm('Delete this spell permanently?')) {
      return;
    }

    await apiRequest(`/api/prompts/${id}`, { method: 'DELETE', tokenProvider: getToken });
    await loadVault();
    setSheetOpen(false);
    showToast('Spell Deleted');
  }

  // Clipboard fallback keeps copy working when the modern API is unavailable.
  async function writeTextToClipboard(text) {
    const value = String(text || '');
    if (!value) {
      return false;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    const helper = document.createElement('textarea');
    helper.value = value;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();

    try {
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(helper);
    }
  }

  // Copy uses an optimistic count update so the UI responds immediately.
  async function copyPrompt(prompt) {
    let optimisticApplied = false;

    try {
      const copied = await writeTextToClipboard(prompt.body);
      if (!copied) {
        throw new Error('Clipboard copy failed.');
      }

      const currentUsageCount = prompt.usageCount || 0;
      const optimisticUsageCount = currentUsageCount + 1;
      dispatch({
        type: 'prompt-copied',
        id: prompt.id,
        usageCount: optimisticUsageCount,
        delta: 1,
      });
      optimisticApplied = true;
      showToast('Spell Copied');

      const result = await apiRequest(`/api/prompts/${prompt.id}/copy`, {
        method: 'POST',
        tokenProvider: getToken,
      });

      if (result.usageCount !== optimisticUsageCount) {
        dispatch({
          type: 'prompt-copied',
          id: prompt.id,
          usageCount: result.usageCount,
          delta: result.usageCount - optimisticUsageCount,
        });
      }
    } catch (error) {
      if (optimisticApplied) {
        dispatch({
          type: 'prompt-copied',
          id: prompt.id,
          usageCount: prompt.usageCount || 0,
          delta: -1,
        });
      }
      alert(error.message);
    }
  }

  // Category create gives the new item a simple rotating colour.
  async function createCategory() {
    const name = window.prompt('Name the new category:');
    if (!name?.trim()) {
      return;
    }

    await apiRequest('/api/categories', {
      method: 'POST',
      tokenProvider: getToken,
      body: {
        name: name.trim(),
        colour: CATEGORY_COLOURS[state.categories.length % CATEGORY_COLOURS.length],
      },
    });

    await loadVault();
    showToast('Category Added');
  }

  // Category rename only sends the changed name to the API.
  async function renameCategory(category) {
    const nextName = window.prompt('Rename this category:', category.name);
    if (!nextName?.trim() || nextName.trim() === category.name) {
      return;
    }

    await apiRequest(`/api/categories/${category.id}`, {
      method: 'PATCH',
      tokenProvider: getToken,
      body: { name: nextName.trim() },
    });

    await loadVault();
    showToast('Category Updated');
  }

  // Category delete uncategorises prompts instead of deleting them.
  async function deleteCategory(category) {
    if (!window.confirm(`Delete ${category.name}? Prompts inside it will become uncategorised.`)) {
      return;
    }

    await apiRequest(`/api/categories/${category.id}`, { method: 'DELETE', tokenProvider: getToken });
    setFilters((current) => ({
      ...current,
      category: current.category === category.id ? '' : current.category,
    }));
    await loadVault();
    showToast('Category Deleted');
  }

  // Inactive keeps the account record but blocks future logins.
  async function deactivateUser(user) {
    if (!window.confirm(`Make ${user.email} inactive? They will not be able to log in.`)) {
      return;
    }

    await apiRequest(`/api/users/${user.id}`, {
      method: 'PATCH',
      tokenProvider: getToken,
      body: { isActive: false },
    });
    await loadAdmin();
    showToast('User Inactive');
  }

  // Delete permanently removes the account and its owned vault records.
  async function deleteUser(user) {
    if (!window.confirm(`Delete ${user.email} permanently? This removes the account and their saved vault records.`)) {
      return;
    }

    await apiRequest(`/api/users/${user.id}`, { method: 'DELETE', tokenProvider: getToken });
    await loadAdmin();
    showToast('User Deleted');
  }

  return (
    <div className="min-h-screen flex flex-col lg:h-screen lg:min-h-0 lg:pl-[280px] bg-background">
      <div
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 lg:hidden ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      <aside
        className={`h-screen w-[280px] fixed left-0 top-0 bg-[#111118] flex flex-col py-8 px-6 z-[70] drawer-content lg:z-50 border-r border-outline-variant/10 ${
          drawerOpen ? 'drawer-visible' : 'drawer-hidden'
        }`}
      >
        <div className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookMark />
            <h1 className="text-2xl font-serif text-[#e4e1e9] tracking-tight">Grimoire</h1>
          </div>
          <button className="text-[#ccc3d8] lg:hidden" onClick={() => setDrawerOpen(false)} type="button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 min-h-0 space-y-2 overflow-y-auto custom-scrollbar pr-1">
          <button
            className={`flex items-center gap-3 py-3 px-4 transition-colors w-full text-left ${
              view === 'vault' && !filters.category
                ? 'text-[#f5be52] font-semibold bg-[#1f1f25]'
                : 'text-[#ccc3d8] hover:bg-[#1f1f25]'
            }`}
            onClick={() => {
              setView('vault');
              setFilters((current) => ({ ...current, category: '' }));
              setDrawerOpen(false);
            }}
            type="button"
          >
            <span className="material-symbols-outlined">auto_stories</span>
            <span className="text-sm tracking-wide">All Spells</span>
          </button>

          <details className="mt-1" open>
            <summary className="flex items-center justify-between gap-3 py-3 px-4 text-[#ccc3d8] hover:bg-[#1f1f25] transition-colors cursor-pointer list-none">
              <span className="flex items-center gap-3 min-w-0">
                <span className="material-symbols-outlined">style</span>
                <span className="text-sm tracking-wide truncate">Spells Cabinet</span>
              </span>
              <span className="material-symbols-outlined text-lg text-outline-variant">expand_more</span>
            </summary>
            <div className="mt-3 ml-4 pl-4 border-l border-outline-variant/10">
              <div className="space-y-1">
                {state.categories.map((category) => (
                  <div className="group flex items-center gap-1" key={category.id}>
                    <button
                      className={`flex items-center justify-between gap-3 w-full py-2 px-3 text-xs font-sans transition-all ${
                        filters.category === category.id
                          ? 'text-on-surface bg-surface-container-low'
                          : 'text-outline-variant hover:text-on-surface hover:bg-surface-container-low'
                      }`}
                      onClick={() => {
                        setView('vault');
                        setFilters((current) => ({ ...current, category: category.id }));
                        setDrawerOpen(false);
                      }}
                      type="button"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: category.colour }} />
                        <span className="truncate">{category.name}</span>
                      </span>
                      <span className="text-[10px] text-outline-variant">
                        {categoryPromptCounts[category.id] || 0}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <button
                        className="text-outline-variant hover:text-on-surface transition-all p-1"
                        onClick={() => renameCategory(category)}
                        title={`Rename ${category.name} category`}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        className="text-outline-variant hover:text-error transition-all p-1"
                        onClick={() => deleteCategory(category)}
                        title={`Delete ${category.name} category`}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-3">
                  <button
                    className="flex items-center gap-3 w-full py-2 px-3 text-outline-variant hover:text-on-surface hover:bg-surface-container-low transition-all text-xs font-sans"
                    onClick={createCategory}
                    type="button"
                  >
                    <span>+ Add Category</span>
                  </button>
                </div>
              </div>
            </div>
          </details>

          {isAdmin && (
            <button
              className={`flex items-center gap-3 py-3 px-4 transition-colors w-full text-left ${
                view === 'admin'
                  ? 'text-[#f5be52] font-semibold bg-[#1f1f25]'
                  : 'text-[#ccc3d8] hover:bg-[#1f1f25]'
              }`}
              onClick={() => {
                setView('admin');
                setDrawerOpen(false);
              }}
              type="button"
            >
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <span className="text-sm tracking-wide">Admin Panel</span>
            </button>
          )}
        </nav>

        <div className="mt-6 shrink-0 border-t border-outline-variant/10 pt-6 safe-bottom-inset">
          <button
            className="flex items-center gap-3 w-full py-3 px-4 text-[#ccc3d8] hover:bg-[#1f1f25]"
            onClick={() => setEasterEggOpen(true)}
            type="button"
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="text-sm font-medium">Ministry Settings</span>
          </button>
        </div>
      </aside>

      <header className="sticky top-0 h-16 lg:h-20 bg-[#0a0a0f] flex items-center justify-between px-4 lg:px-10 z-40 border-b border-outline-variant/10">
        <div className="flex items-center gap-3 flex-1">
          <button className="p-2 -ml-2 text-on-surface lg:hidden" onClick={() => setDrawerOpen(true)} type="button">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <BookMark />
            <h1 className="text-xl font-serif">Grimoire</h1>
          </div>
          <div className="hidden lg:block w-96 ml-0">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#b8b0c4] text-lg">
                search
              </span>
              <input
                className="w-full bg-transparent border border-outline-variant/20 py-2 pl-12 pr-4 focus:ring-0 focus:border-primary transition-all text-sm font-sans placeholder:text-[#8f889b]"
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search spells..."
                type="search"
                value={filters.search}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="font-sans text-xs text-on-surface">{profile.displayName}</p>
            <p className="font-sans text-[10px] uppercase tracking-widest text-[#b8b0c4]">{profile.role}</p>
          </div>
          <button
            className="border border-outline-variant/30 px-3 py-2 font-sans text-[10px] uppercase tracking-widest text-[#ccc3d8] hover:text-on-surface hover:bg-surface-container"
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      </header>

      {view === 'admin' ? (
        <AdminPanel
          activities={state.activities}
          currentUserId={profile.id}
          loading={state.loadingAdmin}
          onDeactivateUser={deactivateUser}
          onDeleteUser={deleteUser}
          onRefresh={loadAdmin}
          users={state.users}
        />
      ) : (
        <main className="flex-1 overflow-y-auto custom-scrollbar px-4 lg:px-10 py-6 lg:py-8">
          <div className="lg:hidden mb-6">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#b8b0c4] text-lg">
                search
              </span>
              <input
                className="w-full bg-transparent border border-outline-variant/20 py-3 pl-12 pr-4 focus:ring-0 focus:border-primary transition-all text-sm font-sans placeholder:text-[#8f889b]"
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search spells..."
                type="search"
                value={filters.search}
              />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-4xl lg:text-6xl font-serif tracking-tight text-on-surface">The Vault</h2>
              <p className="font-sans text-sm text-[#b8b0c4] mt-2" title="Spells are saved prompts, circles are categories, and copies count how many times prompts were copied.">
                Curated logic across {state.stats.total} spells, {state.stats.totalCategories} circles, and {state.stats.totalCopies} copies.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-[620px]">
              <label className="vault-filter-field relative">
                <select
                  className="vault-filter-select"
                  onChange={(event) => setFilters((current) => ({ ...current, promptType: event.target.value }))}
                  value={filters.promptType}
                >
                  <option value="">All Types</option>
                  {PROMPT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <span className="vault-filter-chevron pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[22px] text-outline">
                  expand_more
                </span>
              </label>

              <button
                className="border border-outline-variant/40 text-primary px-4 py-3 font-sans text-xs font-bold uppercase tracking-widest hover:bg-surface-container transition-colors"
                onClick={() => setFilters({ search: '', promptType: '', category: '', sort: 'newest' })}
                type="button"
              >
                Clear Filters
              </button>

              <label className="vault-filter-field relative">
                <select
                  className="vault-filter-select"
                  onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}
                  value={filters.sort}
                >
                  <option value="newest">Recent</option>
                  <option value="rating">Rating</option>
                  <option value="usage">Most Used</option>
                  <option value="oldest">Oldest</option>
                </select>
                <span className="vault-filter-chevron pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[22px] text-outline">
                  expand_more
                </span>
              </label>
            </div>
          </div>

          {state.error && (
            <div className="mb-6 border border-error/30 bg-error/10 p-4 text-error font-sans text-sm">
              {state.error}
            </div>
          )}

          <PromptGrid
            loading={state.loadingVault}
            onCopy={copyPrompt}
            onOpen={openPrompt}
            prompts={visiblePrompts}
            searchActive={Boolean(filters.search || filters.promptType || filters.category)}
          />
        </main>
      )}

      {view === 'vault' && (
        <div className={`fixed bottom-8 right-8 z-[100] app-fab ${sheetOpen ? 'app-fab-hidden' : ''}`}>
          <button
            className="h-14 w-14 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(124,58,237,0.4)] active:scale-95 group"
            disabled={sheetOpen}
            onClick={openNewPrompt}
            tabIndex={sheetOpen ? -1 : 0}
            title="Create a new spell"
            type="button"
          >
            <span className="material-symbols-outlined text-3xl">add</span>
          </button>
        </div>
      )}

      <PromptSheet
        categories={state.categories}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onDelete={deletePrompt}
        onSave={savePrompt}
        prompt={selectedPrompt}
      />

      <div className={`fixed left-1/2 bottom-6 z-[130] pointer-events-none app-toast ${toast ? 'toast-open' : ''}`}>
        <div className="bg-[#18181f] px-4 py-3 app-toast-panel">
          <p className="text-[11px] font-bold font-sans uppercase tracking-[0.2em] text-on-surface">
            {toast || 'Spell Copied'}
          </p>
        </div>
      </div>

      {easterEggOpen && (
        <div className="fixed inset-0 z-[120] bg-black/70 p-4" onClick={() => setEasterEggOpen(false)}>
          <div className="min-h-full flex items-center justify-center">
            <div
              className="w-full max-w-sm bg-[#18181f] border border-outline-variant/20 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 p-5 border-b border-outline-variant/10">
                <div>
                  <p className="text-[10px] font-bold font-sans uppercase tracking-[0.28em] text-[#f5be52] mb-2">
                    Ministry Secret
                  </p>
                  <h3 className="text-2xl font-serif text-on-surface">You found an Easter Egg</h3>
                  <p className="text-sm font-body italic text-[#b8b0c4] mt-1">A hidden wizarding surprise.</p>
                </div>
                <button className="p-2 text-outline-variant hover:text-on-surface" onClick={() => setEasterEggOpen(false)} type="button">
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
              <div className="p-5">
                <div className="bg-[#111118] border border-outline-variant/10">
                  <img alt="Animated easter egg surprise" className="w-full h-auto max-h-[320px] object-contain block" src="/assets/easter-egg.webp?v=2" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PromptGrid({ loading, onCopy, onOpen, prompts, searchActive }) {
  if (loading) {
    return (
      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-1 xl:grid-cols-2 lg:gap-6">
        {[0, 1].map((item) => (
          <div className="bg-[#111118] p-4 lg:p-5 border border-outline-variant/10 space-y-3" key={item}>
            <div className="flex justify-between items-start gap-3">
              <div className="skeleton-block h-7 w-36 max-w-[68%]"></div>
              <div className="skeleton-block h-4 w-32"></div>
            </div>
            <div className="bg-surface-container-lowest p-3 border border-outline-variant/5 space-y-2 min-h-[6rem]">
              <div className="skeleton-block h-3 w-full"></div>
              <div className="skeleton-block h-3 w-[92%]"></div>
              <div className="skeleton-block h-3 w-4/5"></div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="skeleton-block h-6 w-24"></div>
              <div className="skeleton-block h-3 w-28"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!prompts.length) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif text-3xl text-on-surface mb-3">
          {searchActive ? 'No spells match these filters.' : 'Your vault is empty.'}
        </p>
        <p className="font-sans text-sm text-[#b8b0c4] uppercase tracking-widest max-w-xl mx-auto">
          {searchActive ? 'Clear a filter or add a new spell.' : 'Tap + to inscribe your first spell.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-1 xl:grid-cols-2 lg:gap-6">
      {prompts.map((prompt) => (
        <PromptCard key={prompt.id} onCopy={onCopy} onOpen={onOpen} prompt={prompt} />
      ))}
    </div>
  );
}

function PromptCard({ onCopy, onOpen, prompt }) {
  const promptType = prompt.promptType || 'General';
  const typeClass = PROMPT_TYPE_COLOURS[promptType] || PROMPT_TYPE_COLOURS.General;
  const categoryName = prompt.category?.name ? ` | ${prompt.category.name}` : '';

  return (
    <div
      className="spell-card bg-[#111118] p-4 lg:p-5 hover:bg-surface-container-high active:scale-[0.98] lg:active:scale-100 transition-all border border-outline-variant/10 lg:border-transparent lg:hover:border-outline-variant/20 cursor-pointer group"
      onClick={() => onOpen(prompt)}
    >
      <div className="spell-card-header flex justify-between items-start mb-3 gap-3">
        <h3 className="spell-card-title font-serif text-lg lg:text-[1.75rem] group-hover:text-secondary transition-colors">
          {prompt.title}
        </h3>
        <div className="flex items-center gap-2 pl-2">
          <button
            className="spell-card-copy-icon flex items-center justify-center opacity-80"
            onClick={(event) => {
              event.stopPropagation();
              onCopy(prompt);
            }}
            title="Copy this spell"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px]">content_copy</span>
          </button>
          <div className="flex gap-0.5 text-secondary scale-75 origin-right lg:scale-[0.9]">
            {[1, 2, 3, 4, 5].map((index) => (
              <span
                className="material-symbols-outlined text-sm"
                key={index}
                style={{ fontVariationSettings: `'FILL' ${index <= (prompt.rating || 0) ? 1 : 0}` }}
              >
                star
              </span>
            ))}
          </div>
        </div>
      </div>
      <button
        className="spell-card-preview w-full appearance-none bg-surface-container-lowest p-3 mb-3 font-mono text-[10px] lg:text-xs text-primary leading-relaxed border border-outline-variant/5 text-left transition-colors hover:border-primary/25 cursor-copy"
        onClick={(event) => {
          event.stopPropagation();
          onCopy(prompt);
        }}
        title="Copy this spell"
        type="button"
      >
        <span className="spell-card-preview-text">"{buildBodyPreview(prompt.body)}"</span>
      </button>
      <div className="mt-auto flex items-center gap-3">
        <span className={`${typeClass} px-2 py-0.5 lg:py-1 text-[9px] lg:text-[10px] font-bold font-sans tracking-widest uppercase`}>
          {promptType}
        </span>
        <span className="text-[9px] lg:text-[10px] text-[#8f889b] font-sans uppercase tracking-[0.18em] whitespace-nowrap">
          USED {prompt.usageCount || 0}X
        </span>
        <span className="ml-auto text-right text-[10px] lg:text-[11px] text-[#b8b0c4] font-sans">
          {timeAgo(prompt.updatedAt)}
          {categoryName}
        </span>
      </div>
    </div>
  );
}

function PromptSheet({ categories, isOpen, onClose, onDelete, onSave, prompt }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [promptType, setPromptType] = useState('General');
  const [categoryId, setCategoryId] = useState('');
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(prompt?.id);

  useEffect(() => {
    setTitle(prompt?.title || '');
    setBody(prompt?.body || '');
    setPromptType(prompt?.promptType || 'General');
    setCategoryId(prompt?.category?.id || prompt?.categoryId || '');
    setRating(prompt?.rating || 0);
    setTags(prompt?.tags || []);
  }, [prompt, isOpen]);

  // Tag input is kept simple for the assignment demo.
  function addTags() {
    const result = window.prompt('Add one or more tags (comma separated):');
    if (!result) {
      return;
    }

    setTags((current) => normaliseTags([...current, ...result.split(',')]));
  }

  // Sheet save validates the two required prompt fields.
  async function handleSave() {
    if (!title.trim() || !body.trim()) {
      alert('Title and body are required.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: prompt?.id,
        title: title.trim(),
        body: body.trim(),
        promptType,
        categoryId: categoryId || null,
        rating,
        tags,
      });
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-[80] bg-black/70 transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-x-0 bottom-0 z-[90] h-[90vh] bg-[#18181f] flex flex-col transition-transform duration-300 border-t border-[#252535] lg:h-screen lg:w-[400px] lg:left-auto lg:right-0 lg:top-0 lg:border-t-0 lg:border-l lg:z-[90] ${
          isOpen ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-y-0 lg:translate-x-full'
        }`}
      >
        <div className="flex-shrink-0 p-6 lg:p-8 border-b border-outline-variant/10 flex justify-between items-start">
          <div className="flex items-center justify-between w-full gap-4">
            <div>
              <h2 className="font-serif text-3xl text-on-surface mb-1">Craft Spell</h2>
            </div>
            <button className="flex items-center justify-center p-2 text-outline-variant hover:text-on-surface transition-colors" onClick={onClose} type="button">
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 lg:p-8 overflow-y-auto custom-scrollbar pb-8">
          <div className="space-y-6 lg:space-y-8">
            <div>
              <label className="block text-[10px] lg:text-[11px] font-bold font-sans text-[#b8b0c4] uppercase tracking-widest mb-2">
                Spell Title
              </label>
              <input
                className="sheet-title-field w-full focus:ring-0 text-on-surface font-serif text-2xl lg:text-xl"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Name your spell..."
                type="text"
                value={title}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] lg:text-[11px] font-bold font-sans text-[#b8b0c4] uppercase tracking-widest mb-2">
                  Prompt Type
                </label>
                <select className="sheet-field text-primary font-sans text-xs p-3 w-full focus:ring-0" onChange={(event) => setPromptType(event.target.value)} value={promptType}>
                  {PROMPT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] lg:text-[11px] font-bold font-sans text-[#b8b0c4] uppercase tracking-widest mb-2">
                  Category
                </label>
                <select className="sheet-field text-primary font-sans text-xs p-3 w-full focus:ring-0" onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
                  <option value="">Uncategorised</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] lg:text-[11px] font-bold font-sans text-[#b8b0c4] uppercase tracking-widest mb-2">
                Spell Formula
              </label>
              <textarea
                className="sheet-field w-full focus:ring-0 text-primary font-mono text-xs p-4 leading-relaxed resize-none"
                onChange={(event) => setBody(event.target.value)}
                placeholder="# system_prompt&#10;Describe the prompt logic you want to preserve..."
                rows="10"
                value={body}
              />
            </div>

            <div>
              <label className="block text-[10px] lg:text-[11px] font-bold font-sans text-[#b8b0c4] uppercase tracking-widest mb-3">
                Spell Power
              </label>
              <div className="flex items-center gap-2 text-secondary">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button className="transition-transform hover:scale-110" key={value} onClick={() => setRating(value)} type="button">
                    <span
                      className="material-symbols-outlined text-2xl"
                      style={{ fontVariationSettings: `'FILL' ${value <= rating ? 1 : 0}` }}
                    >
                      star
                    </span>
                  </button>
                ))}
                <button className="ml-2 text-[11px] font-sans uppercase tracking-widest text-[#b8b0c4] hover:text-on-surface" onClick={() => setRating(0)} type="button">
                  Clear
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4 mb-3">
                <label className="block text-[10px] lg:text-[11px] font-bold font-sans text-[#b8b0c4] uppercase tracking-widest">
                  Enchantment Tags
                </label>
                <button className="bg-surface-container-highest px-3 py-1 text-[10px] font-mono text-on-surface flex items-center gap-2 hover:text-primary transition-colors border border-outline-variant/20" onClick={addTags} type="button">
                  <span className="material-symbols-outlined text-sm">add</span>
                  Add Tag
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.length ? tags.map((tag, index) => (
                  <span className="bg-surface-container px-3 py-1 text-[10px] font-mono text-primary flex items-center gap-2" key={tag}>
                    #{tag}
                    <button className="text-outline-variant hover:text-on-surface" onClick={() => setTags((current) => current.filter((_, currentIndex) => currentIndex !== index))} type="button">
                      <span className="material-symbols-outlined text-[10px]">close</span>
                    </button>
                  </span>
                )) : (
                  <span className="text-[11px] font-sans uppercase tracking-widest text-[#b8b0c4]">No tags yet</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetaBox label="Last Edited" value={isEditing ? formatFullDate(prompt.updatedAt) : 'Waiting for first save'} />
              <MetaBox label="Usage Count" value={`${prompt?.usageCount || 0} ${(prompt?.usageCount || 0) === 1 ? 'copy' : 'copies'}`} />
              <MetaBox label="Category" value={categories.find((category) => category.id === categoryId)?.name || 'Uncategorised'} />
              <MetaBox label="Created" value={isEditing ? formatFullDate(prompt.createdAt) : 'Draft mode'} />
            </div>
          </div>
        </div>

        <div className="shrink-0 p-6 lg:p-8 bg-surface-dim border-t border-outline-variant/10 safe-bottom-inset lg:pb-8">
          <div className="space-y-3">
            <button
              className="w-full bg-primary-container lg:bg-gradient-to-r lg:from-primary-container lg:to-[#6a29d4] hover:brightness-110 text-on-primary-container font-bold font-sans py-4 text-xs lg:text-sm tracking-[0.2em] uppercase transition-all shadow-lg active:scale-[0.98] disabled:opacity-60"
              disabled={saving}
              onClick={handleSave}
              type="button"
            >
              {saving ? 'Brewing...' : 'Brew Spell'}
            </button>
            <button
              className="w-full border border-error/30 text-error py-3 text-xs font-bold font-sans tracking-widest uppercase hover:bg-error/10 transition-all"
              onClick={() => onDelete(prompt?.id)}
              type="button"
            >
              Delete Spell
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function MetaBox({ label, value }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 p-3">
      <p className="text-[10px] font-bold font-sans uppercase tracking-widest text-[#b8b0c4] mb-2">
        {label}
      </p>
      <p className="text-sm font-serif text-on-surface">{value}</p>
    </div>
  );
}
