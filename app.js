/**
 * Expense & Budget Visualizer
 * Vanilla JS — no frameworks, LocalStorage persistence
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'budget_tracker_transactions';

const CATEGORY_ICONS = {
  Food: '🍔',
  Transport: '🚗',
  Fun: '🎉',
};

const CATEGORY_COLORS = {
  Food: '#f97316',
  Transport: '#3b82f6',
  Fun: '#a855f7',
};

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {{ id: string, name: string, amount: number, category: string }[]} */
let transactions = [];

/** @type {Chart | null} */
let chartInstance = null;

// ─── DOM References ───────────────────────────────────────────────────────────

const form        = document.getElementById('transaction-form');
const inputName   = document.getElementById('item-name');
const inputAmount = document.getElementById('item-amount');
const inputCat    = document.getElementById('item-category');
const errName     = document.getElementById('err-name');
const errAmount   = document.getElementById('err-amount');
const errCategory = document.getElementById('err-category');
const balanceEl   = document.getElementById('total-balance');
const listEl      = document.getElementById('transaction-list');
const emptyState  = document.getElementById('empty-state');
const chartCanvas = document.getElementById('spending-chart');
const chartEmpty  = document.getElementById('chart-empty');

// ─── LocalStorage Helpers ─────────────────────────────────────────────────────

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate() {
  let valid = true;

  // Clear previous errors
  clearError(inputName,   errName);
  clearError(inputAmount, errAmount);
  clearError(inputCat,    errCategory);

  if (!inputName.value.trim()) {
    showError(inputName, errName, 'Item name is required.');
    valid = false;
  }

  const amt = parseFloat(inputAmount.value);
  if (!inputAmount.value.trim() || isNaN(amt) || amt <= 0) {
    showError(inputAmount, errAmount, 'Enter a valid amount greater than 0.');
    valid = false;
  }

  if (!inputCat.value) {
    showError(inputCat, errCategory, 'Please select a category.');
    valid = false;
  }

  return valid;
}

function showError(input, msgEl, message) {
  input.classList.add('invalid');
  msgEl.textContent = message;
}

function clearError(input, msgEl) {
  input.classList.remove('invalid');
  msgEl.textContent = '';
}

// ─── Core Actions ─────────────────────────────────────────────────────────────

function addTransaction(name, amount, category) {
  const tx = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    amount: parseFloat(amount),
    category,
  };
  transactions.unshift(tx); // newest first
  saveToStorage();
  render();
}

function deleteTransaction(id) {
  transactions = transactions.filter((tx) => tx.id !== id);
  saveToStorage();
  render();
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatRupiah(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function render() {
  renderBalance();
  renderList();
  renderChart();
}

function renderBalance() {
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  balanceEl.textContent = formatRupiah(total);
}

function renderList() {
  // Remove all items except the empty-state placeholder
  const existingItems = listEl.querySelectorAll('.transaction-item');
  existingItems.forEach((el) => el.remove());

  if (transactions.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  transactions.forEach((tx) => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.dataset.id = tx.id;

    li.innerHTML = `
      <div class="category-badge ${tx.category}" aria-hidden="true">
        ${CATEGORY_ICONS[tx.category] ?? '📦'}
      </div>
      <div class="item-info">
        <div class="item-name" title="${escapeHtml(tx.name)}">${escapeHtml(tx.name)}</div>
        <div class="item-category">${tx.category}</div>
      </div>
      <div class="item-amount">${formatRupiah(tx.amount)}</div>
      <button
        class="btn-delete"
        aria-label="Delete ${escapeHtml(tx.name)}"
        data-id="${tx.id}"
        title="Delete"
      >✕</button>
    `;

    listEl.appendChild(li);
  });
}

function renderChart() {
  // Aggregate totals per category
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach((tx) => {
    if (totals[tx.category] !== undefined) {
      totals[tx.category] += tx.amount;
    }
  });

  const labels  = Object.keys(totals).filter((k) => totals[k] > 0);
  const data    = labels.map((k) => totals[k]);
  const colors  = labels.map((k) => CATEGORY_COLORS[k]);

  const hasData = data.length > 0;

  chartEmpty.style.display   = hasData ? 'none'  : 'block';
  chartCanvas.style.display  = hasData ? 'block' : 'none';

  if (!hasData) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  if (chartInstance) {
    // Update in-place for smooth animation
    chartInstance.data.labels          = labels;
    chartInstance.data.datasets[0].data       = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.update();
  } else {
    chartInstance = new Chart(chartCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverOffset: 10,
        }],
      },
      options: {
        responsive: true,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              font: { size: 13, family: "'Segoe UI', system-ui, sans-serif" },
              color: '#1e293b',
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const val = ctx.parsed;
                const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${formatRupiah(val)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}

// ─── Security Helper ──────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

// Form submit
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validate()) return;

  addTransaction(inputName.value, inputAmount.value, inputCat.value);

  // Reset form
  form.reset();
  clearError(inputName,   errName);
  clearError(inputAmount, errAmount);
  clearError(inputCat,    errCategory);
  inputName.focus();
});

// Clear validation state on input change
inputName.addEventListener('input',   () => clearError(inputName,   errName));
inputAmount.addEventListener('input', () => clearError(inputAmount, errAmount));
inputCat.addEventListener('change',   () => clearError(inputCat,    errCategory));

// Delete via event delegation on the list
listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  const id = btn.dataset.id;
  if (id) deleteTransaction(id);
});

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  transactions = loadFromStorage();
  render();
}

init();
