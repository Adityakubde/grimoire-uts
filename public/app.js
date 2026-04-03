let allPrompts = [];
let allCategories = [];
let activePromptTags = [];
let categoryPromptCounts = {};
let searchTimer;
let toastTimer;
let categoryLoadError = '';
let categoryMenuTouched = false;
const loadingState = {
  prompts: false,
  categories: false,
  categoryCounts: false,
  stats: false,
};

const filters = {
  search: '',
  model: '',
  category: '',
  sort: 'newest',
};

const MODEL_COLOURS = {
  'GPT-4o': 'bg-[#10a37f]/10 text-[#10a37f]',
  'Gemini Pro': 'bg-blue-500/10 text-blue-400',
  'Claude 3.5': 'bg-amber-500/10 text-amber-400',
  'DALL-E 3': 'bg-[#10a37f]/10 text-[#10a37f]',
  'LLaMA 3': 'bg-purple-500/10 text-purple-400',
  Groq: 'bg-red-500/10 text-red-400',
  Other: 'bg-surface-container text-outline-variant',
};

const CATEGORY_COLOURS = [
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#f97316',
  '#14b8a6',
];

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normaliseId(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return value._id || '';
}

function timeAgo(date) {
  if (!date) {
    return 'JUST NOW';
  }

  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) {
    return 'JUST NOW';
  }

  if (mins < 60) {
    return `${mins}M AGO`;
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}H AGO`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}D AGO`;
  }

  return new Date(date).toLocaleDateString();
}

function formatFullDate(date) {
  if (!date) {
    return 'Not available';
  }

  return new Date(date).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildBodyPreview(body, maxLength = 220) {
  const normalised = String(body || '').replace(/\s+/g, ' ').trim();

  if (!normalised) {
    return '';
  }

  return normalised.length > maxLength
    ? `${normalised.slice(0, maxLength)}...`
    : normalised;
}

function showToast(message) {
  const toast = document.getElementById('appToast');
  const messageEl = document.getElementById('appToastMessage');
  if (!toast || !messageEl) {
    return;
  }

  window.clearTimeout(toastTimer);
  messageEl.textContent = message;
  toast.classList.add('toast-open');

  toastTimer = window.setTimeout(() => {
    toast.classList.remove('toast-open');
  }, 3000);
}

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
  helper.style.pointerEvents = 'none';
  document.body.appendChild(helper);
  helper.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(helper);
  }
}

async function registerPromptCopy(id) {
  if (!id) {
    return;
  }

  try {
    await apiFetch(`/api/prompts/${id}/copy`, { method: 'POST' });
    await Promise.all([loadPrompts(), loadStats()]);
  } catch (error) {
    console.error(error);
  }
}

function normaliseTags(tags) {
  const incoming = Array.isArray(tags)
    ? tags
    : String(tags || '')
        .split(',')
        .map((tag) => tag.trim());

  return [...new Set(
    incoming
      .map((tag) => String(tag || '').trim().replace(/^#/, ''))
      .filter(Boolean)
  )];
}

async function apiFetch(url, options = {}) {
  const hasBody = Object.prototype.hasOwnProperty.call(options, 'body');
  const config = {
    ...options,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  };

  const response = await fetch(url, config);
  let payload = {};

  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }

  return payload.data;
}

function showGridMessage(title, message) {
  const grid = document.getElementById('promptGrid');
  if (!grid) {
    return;
  }

  grid.innerHTML = `
    <div class="col-span-full py-24 text-center">
      <p class="font-serif text-3xl text-on-surface mb-3">${escHtml(title)}</p>
      <p class="font-sans text-sm text-[#b8b0c4] uppercase tracking-widest max-w-xl mx-auto">
        ${escHtml(message)}
      </p>
    </div>
  `;
}

function renderGridSkeleton(count = 2) {
  const grid = document.getElementById('promptGrid');
  if (!grid) {
    return;
  }

  grid.innerHTML = Array.from({ length: count }, () => `
    <div class="bg-[#111118] p-4 lg:p-5 border border-outline-variant/10 space-y-3" aria-hidden="true">
      <div class="flex justify-between items-start gap-3">
        <div class="skeleton-block h-7 w-36 max-w-[68%]"></div>
        <div class="flex gap-1 items-center">
          <span class="skeleton-block h-4 w-4"></span>
          <span class="skeleton-block h-4 w-4"></span>
          <span class="skeleton-block h-4 w-4"></span>
          <span class="skeleton-block h-4 w-4"></span>
          <span class="skeleton-block h-4 w-4"></span>
          <span class="skeleton-block h-4 w-4"></span>
        </div>
      </div>
      <div class="bg-surface-container-lowest p-3 border border-outline-variant/5 space-y-2 min-h-[6rem]">
        <div class="skeleton-block h-3 w-full"></div>
        <div class="skeleton-block h-3 w-[92%]"></div>
        <div class="skeleton-block h-3 w-4/5"></div>
      </div>
      <div class="flex items-center justify-between gap-4">
        <div class="skeleton-block h-6 w-24"></div>
        <div class="skeleton-block h-3 w-28"></div>
      </div>
    </div>
  `).join('');
}

function renderGrid(prompts) {
  const grid = document.getElementById('promptGrid');
  if (!grid) {
    return;
  }

  if (loadingState.prompts) {
    renderGridSkeleton();
    return;
  }

  if (!prompts.length) {
    const hasActiveFilters = Boolean(filters.search || filters.model || filters.category);
    showGridMessage(
      hasActiveFilters ? 'No spells match these filters.' : 'Your vault is empty.',
      hasActiveFilters ? 'Clear a filter or add a new spell.' : 'Tap + to inscribe your first spell.'
    );
    return;
  }

  grid.innerHTML = prompts.map(cardHTML).join('');
}

function cardHTML(prompt) {
  const stars = [1, 2, 3, 4, 5]
    .map((index) => `
      <span class="material-symbols-outlined text-sm"
        style="font-variation-settings: 'FILL' ${index <= (prompt.rating || 0) ? 1 : 0};">star</span>
    `)
    .join('');

  const promptModel = String(prompt.model || 'Other');
  const modelClass = MODEL_COLOURS[promptModel] || MODEL_COLOURS.Other;
  const bodyPreview = escHtml(buildBodyPreview(prompt.body));
  const categoryName = prompt.category?.name ? ` | ${escHtml(prompt.category.name)}` : '';

  return `
    <div class="spell-card bg-[#111118] p-4 lg:p-5 hover:bg-surface-container-high active:scale-[0.98]
                lg:active:scale-100 transition-all border border-outline-variant/10
                lg:border-transparent lg:hover:border-outline-variant/20 cursor-pointer group"
         onclick="openPrompt('${prompt._id}')">
      <div class="spell-card-header flex justify-between items-start mb-3 gap-3">
        <h3 class="spell-card-title font-serif text-lg lg:text-[1.75rem] group-hover:text-secondary transition-colors">
          ${escHtml(prompt.title)}
        </h3>
        <div class="flex items-center gap-2 pl-2">
          <button class="spell-card-copy-icon flex items-center justify-center opacity-80"
            onclick="copyPromptPreview(event, '${prompt._id}')"
            aria-label="Copy spell"
            title="Copy spell"
            type="button">
            <span class="material-symbols-outlined text-[17px]">content_copy</span>
          </button>
          <div class="flex gap-0.5 text-secondary scale-75 origin-right lg:scale-[0.9]">${stars}</div>
        </div>
      </div>
      <button class="spell-card-preview w-full appearance-none bg-surface-container-lowest p-3 mb-3 font-mono text-[10px] lg:text-xs
                  text-primary leading-relaxed border border-outline-variant/5 text-left transition-colors hover:border-primary/25 cursor-copy"
        onclick="copyPromptPreview(event, '${prompt._id}')"
        title="Copy spell"
        type="button">
        <span class="spell-card-preview-text">"${bodyPreview}"</span>
      </button>
      <div class="mt-auto flex items-center justify-between gap-4">
        <span class="${modelClass} px-2 py-0.5 lg:py-1 text-[9px] lg:text-[10px]
                      font-bold font-sans tracking-widest uppercase">${escHtml(promptModel)}</span>
        <span class="text-[10px] lg:text-[11px] text-[#b8b0c4] font-sans">
          ${timeAgo(prompt.updatedAt)}${categoryName}
        </span>
      </div>
    </div>
  `;
}

function renderCategorySelect() {
  const select = document.getElementById('sheetCategory');
  if (!select) {
    return;
  }

  const currentValue = select.value;
  const options = [
    '<option value="">Uncategorised</option>',
    ...allCategories.map((category) => `
      <option value="${category._id}">${escHtml(category.name)}</option>
    `),
  ];

  select.innerHTML = options.join('');
  select.value = allCategories.some((category) => category._id === currentValue) ? currentValue : '';
}

function renderCategoryList(errorMessage = '') {
  const list = document.getElementById('categoryList');
  if (!list) {
    syncSidebarNavState();
    return;
  }

  const categoryError = errorMessage || categoryLoadError;
  if (categoryError) {
    list.innerHTML = `
      <div class="px-4 py-3 text-[10px] font-sans text-outline-variant uppercase tracking-widest">
        ${escHtml(categoryError)}
      </div>
    `;
    syncSidebarNavState();
    return;
  }

  if (loadingState.categories || loadingState.categoryCounts) {
    list.innerHTML = `
      <div class="space-y-3 py-2" aria-hidden="true">
        <div class="flex items-center justify-between gap-3 px-3 py-2">
          <div class="flex items-center gap-3 flex-1">
            <span class="skeleton-block h-2 w-2 rounded-full"></span>
            <span class="skeleton-block h-3 w-24"></span>
          </div>
          <span class="skeleton-block h-3 w-5"></span>
        </div>
        <div class="flex items-center justify-between gap-3 px-3 py-2">
          <div class="flex items-center gap-3 flex-1">
            <span class="skeleton-block h-2 w-2 rounded-full"></span>
            <span class="skeleton-block h-3 w-20"></span>
          </div>
          <span class="skeleton-block h-3 w-5"></span>
        </div>
        <div class="flex items-center justify-between gap-3 px-3 py-2">
          <div class="flex items-center gap-3 flex-1">
            <span class="skeleton-block h-2 w-2 rounded-full"></span>
            <span class="skeleton-block h-3 w-28"></span>
          </div>
          <span class="skeleton-block h-3 w-5"></span>
        </div>
        <div class="px-3 pt-3">
          <div class="skeleton-block h-3 w-24"></div>
        </div>
      </div>
    `;
    syncSidebarNavState();
    return;
  }

  const categoryButtons = allCategories
    .map((category) => {
      const isActive = filters.category === category._id;
      const promptCount = categoryPromptCounts[category._id] || 0;

      return `
        <div class="group flex items-center gap-2">
          <button onclick="filterByCategory('${category._id}')"
            class="flex items-center justify-between gap-3 w-full py-2 px-3 text-xs font-sans transition-all ${
              isActive
                ? 'text-on-surface bg-surface-container-low'
                : 'text-outline-variant hover:text-on-surface hover:bg-surface-container-low'
            }">
            <span class="flex items-center gap-3 min-w-0">
              <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${category.colour}"></span>
              <span class="truncate">${escHtml(category.name)}</span>
            </span>
            <span class="text-[10px] text-outline-variant">${promptCount}</span>
          </button>
          <button class="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-outline-variant hover:text-error transition-all p-1"
            onclick="event.stopPropagation(); deleteCategory('${category._id}')"
            title="Delete category"
            aria-label="Delete ${escHtml(category.name)} category"
            type="button">
            <span class="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      `;
    })
    .join('');

  list.innerHTML = `
    ${categoryButtons}
    <div class="pt-3">
      <button onclick="openNewCategory()"
        class="flex items-center gap-3 w-full py-2 px-3 text-outline-variant hover:text-on-surface hover:bg-surface-container-low transition-all text-xs font-sans"
        type="button">
        <span>+ Add Category</span>
      </button>
    </div>
  `;
  syncSidebarNavState();
}

function syncSidebarNavState() {
  const allSpellsNav = document.getElementById('allSpellsNav');
  const categoryMenuSection = document.getElementById('categoryMenuSection');
  const showAllSpells = !filters.category;

  if (allSpellsNav) {
    allSpellsNav.className = `flex items-center gap-3 py-3 px-4 transition-colors w-full text-left ${
      showAllSpells
        ? 'text-[#f5be52] font-semibold bg-[#1f1f25]'
        : 'text-[#ccc3d8] hover:bg-[#1f1f25]'
    }`;
  }

  if (categoryMenuSection && filters.category && !categoryMenuTouched) {
    categoryMenuSection.open = true;
  }
}

function renderTagList() {
  const tagList = document.getElementById('sheetTagList');
  if (!tagList) {
    return;
  }

  if (!activePromptTags.length) {
    tagList.innerHTML = `
      <span class="text-[11px] font-sans uppercase tracking-widest text-[#b8b0c4]">
        No tags yet
      </span>
    `;
    return;
  }

  tagList.innerHTML = activePromptTags
    .map(
      (tag, index) => `
        <span class="bg-surface-container px-3 py-1 text-[10px] font-mono text-primary flex items-center gap-2">
          #${escHtml(tag)}
          <button class="flex items-center justify-center text-outline-variant hover:text-on-surface"
            onclick="removeTag(${index})"
            type="button">
            <span class="material-symbols-outlined text-[10px]">close</span>
          </button>
        </span>
      `
    )
    .join('');
}

function renderPromptMeta(prompt) {
  const updatedEl = document.getElementById('sheetMetaUpdated');
  const usageEl = document.getElementById('sheetMetaUsage');
  const categoryEl = document.getElementById('sheetMetaCategory');
  const createdEl = document.getElementById('sheetMetaCreated');

  if (!updatedEl || !usageEl || !categoryEl || !createdEl) {
    return;
  }

  if (!prompt) {
    updatedEl.textContent = 'Waiting for first save';
    usageEl.textContent = '0 copies';
    categoryEl.textContent = 'Uncategorised';
    createdEl.textContent = 'Draft mode';
    return;
  }

  updatedEl.textContent = formatFullDate(prompt.updatedAt);
  usageEl.textContent = `${prompt.usageCount || 0} ${(prompt.usageCount || 0) === 1 ? 'copy' : 'copies'}`;
  categoryEl.textContent = prompt.category?.name || 'Uncategorised';
  createdEl.textContent = formatFullDate(prompt.createdAt);
}

function buildCategoryCounts(prompts) {
  return prompts.reduce((counts, prompt) => {
    const categoryId = normaliseId(prompt.category);

    if (!categoryId) {
      return counts;
    }

    counts[categoryId] = (counts[categoryId] || 0) + 1;
    return counts;
  }, {});
}

function renderRatingStars(rating) {
  const stars = document.getElementById('sheetStars');
  const ratingInput = document.getElementById('sheetRating');
  if (!stars || !ratingInput) {
    return;
  }

  ratingInput.value = String(rating);
  stars.innerHTML = [1, 2, 3, 4, 5]
    .map(
      (value) => `
        <button class="transition-transform hover:scale-110"
          onclick="setRating(${value})"
          type="button">
          <span class="material-symbols-outlined text-2xl"
            style="font-variation-settings: 'FILL' ${value <= rating ? 1 : 0};">star</span>
        </button>
      `
    )
    .join('') + `
      <button class="ml-2 text-[11px] font-sans uppercase tracking-widest text-[#b8b0c4] hover:text-on-surface"
        onclick="setRating(0)"
        type="button">
        Clear
      </button>
    `;
}

function resetCopyButton() {
  const copyButton = document.getElementById('copyBtn');
  if (!copyButton) {
    return;
  }

  copyButton.textContent = 'Copy Incantation';
}

async function loadPrompts(options = {}) {
  const { showLoading = false } = options;
  const params = new URLSearchParams();

  if (filters.search) {
    params.set('search', filters.search);
  }

  if (filters.model) {
    params.set('model', filters.model);
  }

  if (filters.category) {
    params.set('category', filters.category);
  }

  if (filters.sort) {
    params.set('sort', filters.sort);
  }

  if (showLoading) {
    loadingState.prompts = true;
    renderGrid(allPrompts);
  }

  try {
    const data = await apiFetch(`/api/prompts?${params.toString()}`);
    allPrompts = data;
  } catch (error) {
    allPrompts = [];
    loadingState.prompts = false;
    renderCategoryList();
    showGridMessage('MongoDB connection needed.', error.message);
    console.error(error);
    return;
  }

  loadingState.prompts = false;
  renderGrid(allPrompts);
  renderCategoryList();
}

async function loadCategories(options = {}) {
  const { showLoading = false } = options;

  if (showLoading) {
    loadingState.categories = true;
    renderCategoryList();
  }

  try {
    const data = await apiFetch('/api/categories');
    categoryLoadError = '';
    allCategories = data;
  } catch (error) {
    allCategories = [];
    categoryLoadError = error.message;
    loadingState.categories = false;
    renderCategoryList();
    renderCategorySelect();
    console.error(error);
    return;
  }

  loadingState.categories = false;
  renderCategoryList();
  renderCategorySelect();
}

async function loadCategoryCounts(options = {}) {
  const { showLoading = false } = options;

  if (showLoading) {
    loadingState.categoryCounts = true;
    renderCategoryList();
  }

  try {
    const prompts = await apiFetch('/api/prompts');
    categoryPromptCounts = buildCategoryCounts(prompts);
  } catch (error) {
    categoryPromptCounts = {};
    loadingState.categoryCounts = false;
    renderCategoryList();
    console.error(error);
    return;
  }

  loadingState.categoryCounts = false;
  renderCategoryList();
}

async function loadStats(options = {}) {
  const { showLoading = false } = options;
  const subtitle = document.getElementById('vaultSubtitle');
  if (!subtitle) {
    return;
  }

  if (showLoading) {
    loadingState.stats = true;
    subtitle.textContent = 'Curated logic for the modern alchemist.';
  }

  try {
    const stats = await apiFetch('/api/stats');
    loadingState.stats = false;
    subtitle.textContent = `Curated logic across ${stats.total} spells, ${stats.totalCategories} circles, and ${stats.totalCopies} copies.`;
  } catch (error) {
    loadingState.stats = false;
    subtitle.textContent = 'Curated logic for the modern alchemist.';
    console.error(error);
  }
}

function syncFilterControls() {
  const searchInput = document.getElementById('searchInput');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const modelFilter = document.getElementById('modelFilter');
  const sortFilter = document.getElementById('sortFilter');

  if (searchInput) {
    searchInput.value = filters.search;
  }

  if (mobileSearchInput) {
    mobileSearchInput.value = filters.search;
  }

  if (modelFilter) {
    modelFilter.value = filters.model;
  }

  if (sortFilter) {
    sortFilter.value = filters.sort;
  }

  syncSidebarNavState();
}

function openPrompt(id) {
  const prompt = allPrompts.find((item) => item._id === id);
  if (!prompt) {
    return;
  }

  const selectedId = document.getElementById('selectedId').value;
  const panelAlreadyOpen = typeof isDetailsOpen === 'function' && isDetailsOpen();
  if (panelAlreadyOpen && selectedId === id) {
    hideDetails();
    return;
  }

  document.getElementById('selectedId').value = prompt._id;
  document.getElementById('sheetTitle').value = prompt.title;
  document.getElementById('sheetBody').value = prompt.body;
  document.getElementById('sheetModel').value = prompt.model || 'GPT-4o';
  document.getElementById('sheetCategory').value = normaliseId(prompt.category);

  activePromptTags = [...(prompt.tags || [])];
  renderTagList();
  renderRatingStars(prompt.rating || 0);
  renderPromptMeta(prompt);
  resetCopyButton();
  showDetails();
}

function openNewPrompt() {
  document.getElementById('selectedId').value = '';
  document.getElementById('sheetTitle').value = '';
  document.getElementById('sheetBody').value = '';
  document.getElementById('sheetModel').value = 'GPT-4o';
  document.getElementById('sheetCategory').value = '';

  activePromptTags = [];
  renderTagList();
  renderRatingStars(0);
  renderPromptMeta(null);
  resetCopyButton();
  showDetails();
}

function setRating(value) {
  renderRatingStars(value);
}

function promptForTag() {
  const result = window.prompt('Add one or more tags (comma separated):');
  if (!result) {
    return;
  }

  activePromptTags = normaliseTags([...activePromptTags, ...result.split(',')]);
  renderTagList();
}

function removeTag(index) {
  activePromptTags = activePromptTags.filter((tag, currentIndex) => currentIndex !== index);
  renderTagList();
}

async function openNewCategory() {
  const name = window.prompt('Name the new category:');
  if (!name || !name.trim()) {
    return;
  }

  try {
    const createdCategory = await apiFetch('/api/categories', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        colour: CATEGORY_COLOURS[allCategories.length % CATEGORY_COLOURS.length],
      }),
    });

    await loadCategories();
    await loadCategoryCounts();
    await loadStats();

    const categorySelect = document.getElementById('sheetCategory');
    if (categorySelect) {
      categorySelect.value = createdCategory._id;
    }
  } catch (error) {
    alert(error.message);
  }
}

function filterByCategory(id) {
  filters.category = id;
  syncFilterControls();
  loadPrompts();

  if (window.innerWidth < 1024) {
    toggleDrawer();
  }
}

function clearCategoryFilter() {
  filters.category = '';
  syncFilterControls();
  loadPrompts();

  if (window.innerWidth < 1024) {
    toggleDrawer();
  }
}

async function deleteCategory(id) {
  const category = allCategories.find((item) => item._id === id);
  const label = category ? category.name : 'this category';

  if (!window.confirm(`Delete ${label}? Prompts inside it will become uncategorised.`)) {
    return;
  }

  try {
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });

    if (filters.category === id) {
      filters.category = '';
    }

    const categorySelect = document.getElementById('sheetCategory');
    if (categorySelect && categorySelect.value === id) {
      categorySelect.value = '';
    }

    await Promise.all([loadCategories(), loadCategoryCounts(), loadPrompts(), loadStats()]);
  } catch (error) {
    alert(error.message);
  }
}

async function savePrompt() {
  const id = document.getElementById('selectedId').value;
  const title = document.getElementById('sheetTitle').value.trim();
  const body = document.getElementById('sheetBody').value.trim();
  const model = document.getElementById('sheetModel').value;
  const category = document.getElementById('sheetCategory').value;
  const rating = Number(document.getElementById('sheetRating').value || 0);

  if (!title || !body) {
    alert('Title and body are required.');
    return;
  }

  const payload = {
    title,
    body,
    model,
    category: category || null,
    rating,
    tags: activePromptTags,
  };

  try {
    await apiFetch(id ? `/api/prompts/${id}` : '/api/prompts', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });

    await Promise.all([loadPrompts(), loadCategories(), loadCategoryCounts(), loadStats()]);
    showToast('Spell Brewed');
    hideDetails();
  } catch (error) {
    alert(error.message);
    console.error(error);
  }
}

async function deletePrompt() {
  const id = document.getElementById('selectedId').value;
  if (!id) {
    hideDetails();
    return;
  }

  if (!window.confirm('Delete this spell permanently?')) {
    return;
  }

  try {
    await apiFetch(`/api/prompts/${id}`, { method: 'DELETE' });
    await Promise.all([loadPrompts(), loadCategoryCounts(), loadStats()]);
    showToast('Spell Deleted');
    hideDetails();
  } catch (error) {
    alert(error.message);
  }
}

async function copyPrompt() {
  const body = document.getElementById('sheetBody').value;
  const id = document.getElementById('selectedId').value;
  const copyButton = document.getElementById('copyBtn');

  if (!body) {
    return;
  }

  try {
    const copied = await writeTextToClipboard(body);
    if (!copied) {
      throw new Error('Clipboard copy failed.');
    }

    showToast('Spell Copied');

    if (copyButton) {
      copyButton.textContent = 'Copied';
      window.setTimeout(resetCopyButton, 1400);
    }

    registerPromptCopy(id);
  } catch (error) {
    alert('Clipboard copy failed.');
    console.error(error);
  }
}

async function copyPromptPreview(event, id) {
  if (event) {
    event.stopPropagation();
  }

  const prompt = allPrompts.find((item) => item._id === id);
  if (!prompt?.body) {
    return;
  }

  try {
    const copied = await writeTextToClipboard(prompt.body);
    if (!copied) {
      throw new Error('Clipboard copy failed.');
    }

    showToast('Spell Copied');
    registerPromptCopy(id);
  } catch (error) {
    alert('Clipboard copy failed.');
    console.error(error);
  }
}

function clearFilters() {
  filters.search = '';
  filters.model = '';
  filters.category = '';
  filters.sort = 'newest';
  syncFilterControls();
  loadPrompts();
}

function onSearch(event) {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    filters.search = event.target.value.trim();
    loadPrompts();
  }, 250);
}

function bindEvents() {
  const searchInput = document.getElementById('searchInput');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const modelFilter = document.getElementById('modelFilter');
  const sortFilter = document.getElementById('sortFilter');
  const clearFiltersButton = document.getElementById('clearFiltersBtn');
  const categoryMenuSection = document.getElementById('categoryMenuSection');
  const sheetCategory = document.getElementById('sheetCategory');

  if (searchInput) {
    searchInput.addEventListener('input', onSearch);
  }

  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', onSearch);
  }

  if (modelFilter) {
    modelFilter.addEventListener('change', (event) => {
      filters.model = event.target.value;
      loadPrompts();
    });
  }

  if (sortFilter) {
    sortFilter.addEventListener('change', (event) => {
      filters.sort = event.target.value;
      loadPrompts();
    });
  }

  if (clearFiltersButton) {
    clearFiltersButton.addEventListener('click', clearFilters);
  }

  if (categoryMenuSection) {
    categoryMenuSection.addEventListener('toggle', () => {
      categoryMenuTouched = true;
    });
  }

  if (sheetCategory) {
    sheetCategory.addEventListener('change', (event) => {
      const categoryEl = document.getElementById('sheetMetaCategory');
      const selectedOption = event.target.options[event.target.selectedIndex];

      if (categoryEl) {
        categoryEl.textContent = selectedOption ? selectedOption.textContent : 'Uncategorised';
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  renderTagList();
  renderRatingStars(0);
  renderPromptMeta(null);
  syncFilterControls();
  bindEvents();

  await Promise.all([
    loadCategories({ showLoading: true }),
    loadCategoryCounts({ showLoading: true }),
    loadPrompts({ showLoading: true }),
    loadStats({ showLoading: true }),
  ]);
});

window.clearCategoryFilter = clearCategoryFilter;
window.copyPrompt = copyPrompt;
window.copyPromptPreview = copyPromptPreview;
window.deleteCategory = deleteCategory;
window.deletePrompt = deletePrompt;
window.filterByCategory = filterByCategory;
window.openNewCategory = openNewCategory;
window.openNewPrompt = openNewPrompt;
window.openPrompt = openPrompt;
window.promptForTag = promptForTag;
window.removeTag = removeTag;
window.savePrompt = savePrompt;
window.setRating = setRating;
