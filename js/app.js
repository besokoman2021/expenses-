// App State
const state = {
  currentTab: 'transactions', // 'transactions' | 'reports' | 'analysis'
  selectedDate: new Date(),   // For reports month navigation
  editingTxId: null,
  currentCategoryType: 'expense',
  categoryManagerType: 'expense', // 'expense' | 'income'
  deferredPrompt: null
};

// Arabic Month Names
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

// Color palette for charts
const CHART_COLORS = [
  '#9e9e9e', '#5c35b1', '#2196f3', '#43a047', '#ff9800',
  '#e91e63', '#00bcd4', '#795548', '#607d8b', '#9c27b0'
];

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initTabs();
  initModal();
  initCategoryManager();
  initMonthNavigation();
  initBackupActions();
  renderCurrentTab();

  // Listen for PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    const installBanner = document.getElementById('pwaInstallBtn');
    if (installBanner) installBanner.style.display = 'inline-flex';
  });
});

// Register Service Worker for offline PWA
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('ServiceWorker registered with scope:', reg.scope))
        .catch((err) => console.warn('ServiceWorker registration failed:', err));
    });
  }
}

// Tab Switching
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabName) {
  state.currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tabName}`);
  });
  renderCurrentTab();
}

function renderCurrentTab() {
  if (state.currentTab === 'transactions') {
    renderTransactionsTab();
  } else if (state.currentTab === 'reports') {
    renderReportsTab();
  } else if (state.currentTab === 'analysis') {
    renderAnalysisTab();
  }
}

// Format Currency
function formatCurrency(amount) {
  const val = parseFloat(amount) || 0;
  return `${val.toFixed(2)} ج.م`;
}

// Format Date YYYY/M/D
function formatDateAr(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[0], 10)}/${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
  }
  return dateStr;
}

// Toast notification helper
function showToast(message) {
  const toast = document.getElementById('appToast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ----------------------------------------------------
// TAB 1: TRANSACTIONS
// ----------------------------------------------------
function renderTransactionsTab() {
  const transactions = DB.getTransactions();
  
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryExpenses = {};

  transactions.forEach(tx => {
    const amt = parseFloat(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
    } else {
      totalExpense += amt;
      const cat = tx.category || 'أخرى';
      categoryExpenses[cat] = (categoryExpenses[cat] || 0) + amt;
    }
  });

  const balance = totalIncome - totalExpense;

  // Update Summary Card
  const incEl = document.getElementById('summaryIncome');
  const expEl = document.getElementById('summaryExpense');
  const balEl = document.getElementById('summaryBalance');
  const insightEl = document.getElementById('summaryInsight');

  if (incEl) incEl.textContent = formatCurrency(totalIncome);
  if (expEl) expEl.textContent = formatCurrency(totalExpense);
  if (balEl) {
    balEl.textContent = formatCurrency(balance);
    balEl.className = 'summary-amount-balance ' + (balance < 0 ? 'negative' : '');
  }

  // Smart Insight message (matching Image 3)
  if (insightEl) {
    let highestCat = '';
    let highestAmt = 0;
    for (const cat in categoryExpenses) {
      if (categoryExpenses[cat] > highestAmt) {
        highestAmt = categoryExpenses[cat];
        highestCat = cat;
      }
    }

    if (highestAmt > 0 && highestCat) {
      insightEl.style.display = 'block';
      insightEl.textContent = `يبدو أن إنفاقك على ${highestCat} مرتفع نسبياً (${formatCurrency(highestAmt)}). حاول تقليله.`;
    } else {
      insightEl.style.display = 'none';
    }
  }

  // Render Transaction Cards
  const listContainer = document.getElementById('transactionsList');
  const emptyState = document.getElementById('transactionsEmpty');

  if (transactions.length === 0) {
    listContainer.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  listContainer.innerHTML = transactions.map(tx => {
    const isExpense = tx.type === 'expense';
    const amountClass = isExpense ? 'expense' : 'income';
    const badgeClass = isExpense ? 'expense' : 'income';
    const formattedAmount = `${tx.amount.toFixed(2)} ج.م`;
    const formattedDate = formatDateAr(tx.date);

    return `
      <div class="tx-card" onclick="openTxDetailModal('${tx.id}')">
        <div class="tx-right">
          <div class="tx-icon-badge ${badgeClass}">
            ${isExpense ? `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2.5"/>
                <circle cx="12" cy="12" r="2.5"/>
                <circle cx="19" cy="12" r="2.5"/>
              </svg>
            ` : `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            `}
          </div>
          <div class="tx-details">
            <span class="tx-title">${escapeHTML(tx.title)}</span>
            <span class="tx-subtitle">${escapeHTML(tx.category || 'أخرى')} - ${formattedDate}</span>
          </div>
        </div>
        <div class="tx-amount ${amountClass}">
          ${formattedAmount}
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------
// TAB 2: REPORTS
// ----------------------------------------------------
function initMonthNavigation() {
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    state.selectedDate.setMonth(state.selectedDate.getMonth() - 1);
    renderReportsTab();
  });
  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    state.selectedDate.setMonth(state.selectedDate.getMonth() + 1);
    renderReportsTab();
  });

  const shareBtn = document.getElementById('shareReportBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', shareMonthlyReport);
  }
}

function renderReportsTab() {
  const year = state.selectedDate.getFullYear();
  const monthIndex = state.selectedDate.getMonth();
  const monthName = ARABIC_MONTHS[monthIndex];

  // Update header text "<  نوفمبر 2026  >"
  const labelEl = document.getElementById('selectedMonthLabel');
  if (labelEl) labelEl.textContent = `${monthName} ${year}`;

  const transactions = DB.getTransactions();
  let monthIncome = 0;
  let monthExpense = 0;
  const categoryExpenses = {};

  transactions.forEach(tx => {
    if (!tx.date) return;
    const txDate = new Date(tx.date);
    if (txDate.getFullYear() === year && txDate.getMonth() === monthIndex) {
      const amt = parseFloat(tx.amount) || 0;
      if (tx.type === 'income') {
        monthIncome += amt;
      } else {
        monthExpense += amt;
        const cat = tx.category || 'أخرى';
        categoryExpenses[cat] = (categoryExpenses[cat] || 0) + amt;
      }
    }
  });

  const monthBalance = monthIncome - monthExpense;

  // Update breakdown numbers
  document.getElementById('reportIncome').textContent = formatCurrency(monthIncome);
  document.getElementById('reportExpense').textContent = formatCurrency(monthExpense);
  document.getElementById('reportBalance').textContent = formatCurrency(monthBalance);

  // Render Donut Chart
  renderDonutChart(categoryExpenses, monthExpense);
}

function renderDonutChart(categoryExpenses, totalExpense) {
  const canvas = document.getElementById('reportDonutCanvas');
  const legendEl = document.getElementById('donutLegend');
  const centerCatEl = document.getElementById('donutCenterCat');
  const centerValEl = document.getElementById('donutCenterVal');

  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Crisp Canvas rendering on high DPI screens
  canvas.width = 250 * dpr;
  canvas.height = 250 * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, 250, 250);

  const entries = Object.entries(categoryExpenses);

  if (totalExpense === 0 || entries.length === 0) {
    // Empty donut ring
    ctx.beginPath();
    ctx.arc(125, 125, 100, 0, Math.PI * 2);
    ctx.lineWidth = 42;
    ctx.strokeStyle = '#e0dfe8';
    ctx.stroke();

    centerCatEl.textContent = 'لا توجد مصروفات';
    centerValEl.textContent = '0.00 ج.م';
    legendEl.innerHTML = '';
    return;
  }

  // Draw donut slices
  const centerX = 125;
  const centerY = 125;
  const radius = 80;
  const ringWidth = 40;

  let startAngle = -0.5 * Math.PI;
  let primaryCat = entries[0][0];
  let primaryAmt = entries[0][1];

  // Find max category for center info
  entries.forEach(([cat, amt]) => {
    if (amt > primaryAmt) {
      primaryAmt = amt;
      primaryCat = cat;
    }
  });

  centerCatEl.textContent = primaryCat;
  centerValEl.textContent = primaryAmt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  entries.forEach(([cat, amt], idx) => {
    const sliceAngle = (amt / totalExpense) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    const color = CHART_COLORS[idx % CHART_COLORS.length];

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.lineWidth = ringWidth;
    ctx.strokeStyle = color;
    ctx.lineCap = 'butt';
    ctx.stroke();

    startAngle = endAngle;
  });

  // Render Legend
  legendEl.innerHTML = entries.map(([cat, amt], idx) => {
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    return `
      <div class="legend-item">
        <span class="legend-dot" style="background-color: ${color}"></span>
        <span>${escapeHTML(cat)}</span>
      </div>
    `;
  }).join('');
}

function shareMonthlyReport() {
  const year = state.selectedDate.getFullYear();
  const monthName = ARABIC_MONTHS[state.selectedDate.getMonth()];
  const income = document.getElementById('reportIncome').textContent;
  const expense = document.getElementById('reportExpense').textContent;
  const balance = document.getElementById('reportBalance').textContent;

  const text = `📊 تقرير ${monthName} ${year} - إدارتك المالية\n` +
               `🔹 الإيرادات: ${income}\n` +
               `🔸 المصروفات: ${expense}\n` +
               `💰 الرصيد الصافي: ${balance}\n` +
               `حفظ محلي 100% على جهازك.`;

  if (navigator.share) {
    navigator.share({
      title: `تقرير ${monthName} ${year}`,
      text: text
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      showToast('تم نسخ ملخص التقرير إلى الحافظة');
    });
  }
}

// ----------------------------------------------------
// TAB 3: ANALYSIS
// ----------------------------------------------------
function renderAnalysisTab() {
  const transactions = DB.getTransactions();
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryTotals = {};

  transactions.forEach(tx => {
    const amt = parseFloat(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
    } else {
      totalExpense += amt;
      const cat = tx.category || 'أخرى';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    }
  });

  const savingsRate = totalIncome > 0 ? Math.max(0, ((totalIncome - totalExpense) / totalIncome) * 100) : 0;
  const txCount = transactions.length;

  document.getElementById('analysisTxCount').textContent = txCount;
  document.getElementById('analysisSavingsRate').textContent = `${savingsRate.toFixed(1)}%`;
  document.getElementById('analysisTotalExpense').textContent = formatCurrency(totalExpense);

  // Categories progress breakdown
  const catListContainer = document.getElementById('analysisCatList');
  const catEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  if (catEntries.length === 0) {
    catListContainer.innerHTML = '<div style="color:#888; font-size:13.5px; text-align:center; padding:12px 0;">لا توجد مصروفات مسجلة للتحليل بعد.</div>';
    return;
  }

  catListContainer.innerHTML = catEntries.map(([cat, amt], idx) => {
    const pct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0;
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    return `
      <div class="cat-progress-item">
        <div class="cat-progress-meta">
          <span>${escapeHTML(cat)}</span>
          <span>${formatCurrency(amt)} (${pct.toFixed(0)}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${pct}%; background-color: ${color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------
// BACKUP & RESTORE ACTIONS
// ----------------------------------------------------
function initBackupActions() {
  // Export JSON Backup
  document.getElementById('btnExportBackup').addEventListener('click', () => {
    DB.exportBackupJSON();
    showToast('تم تنزيل ملف النسخة الاحتياطية على جهازك');
  });

  // Import JSON Backup
  const importInput = document.getElementById('importBackupInput');
  document.getElementById('btnImportBackup').addEventListener('click', () => {
    importInput.click();
  });

  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const count = await DB.importBackupJSON(file);
      showToast(`تم استعادة ${count} معاملة بنجاح!`);
      renderCurrentTab();
    } catch (err) {
      alert('خطأ في استيراد الملف: ' + err.message);
    }
    importInput.value = '';
  });

  // Export CSV
  document.getElementById('btnExportCSV').addEventListener('click', () => {
    DB.exportToCSV();
    showToast('تم تصدير ملف الإكسل CSV');
  });

  // Clear Database
  document.getElementById('btnClearData').addEventListener('click', () => {
    if (confirm('هل أنت متأكد من مسح جميع المعاملات من جهازك؟ لا يمكن التراجع عن هذه الخطوة.')) {
      DB.clearAllData();
      showToast('تم مسح جميع البيانات بنجاح');
      renderCurrentTab();
    }
  });

  // PWA Install Button
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (state.deferredPrompt) {
        state.deferredPrompt.prompt();
        const { outcome } = await state.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('تم تثبيت التطبيق بنجاح');
          installBtn.style.display = 'none';
        }
        state.deferredPrompt = null;
      } else {
        alert('لتثبيت التطبيق على هاتفك، اضغط على خيارات المتصفح (⋮) ثم اختر "إضافة إلى الشاشة الرئيسية" أو "تثبيت التطبيق".');
      }
    });
  }
}

// ----------------------------------------------------
// MODAL: ADD / EDIT TRANSACTION
// ----------------------------------------------------
function initModal() {
  const modalOverlay = document.getElementById('txModalOverlay');
  const openFab = document.getElementById('openAddTxBtn');
  const cancelBtn = document.getElementById('btnModalCancel');
  const txForm = document.getElementById('txForm');
  const typeSelect = document.getElementById('txType');

  // Open FAB
  openFab.addEventListener('click', () => {
    openModalForCreate();
  });

  // Cancel / Close
  cancelBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Type change -> update categories
  typeSelect.addEventListener('change', (e) => {
    state.currentCategoryType = e.target.value;
    populateCategoryDropdown(state.currentCategoryType);
  });

  // Add custom category button
  document.getElementById('btnAddCustomCat').addEventListener('click', () => {
    const newCat = prompt('أدخل اسم الفئة الجديدة:');
    if (newCat && newCat.trim()) {
      DB.addCustomCategory(state.currentCategoryType, newCat.trim());
      populateCategoryDropdown(state.currentCategoryType, newCat.trim());
      showToast('تمت إضافة الفئة بنجاح');
    }
  });

  // Form Submit
  txForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveTxFromForm();
  });
}

function populateCategoryDropdown(type, selectedValue = 'أخرى') {
  const select = document.getElementById('txCategory');
  const categories = DB.getCategories(type);
  select.innerHTML = categories.map(cat => `
    <option value="${escapeHTML(cat)}" ${cat === selectedValue ? 'selected' : ''}>${escapeHTML(cat)}</option>
  `).join('');
}

function openModalForCreate() {
  state.editingTxId = null;
  document.getElementById('modalTitle').textContent = 'إضافة معاملة جديدة';
  document.getElementById('btnModalSubmitText').textContent = 'إضافة';

  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('txDate').value = today;
  document.getElementById('txType').value = 'expense';
  state.currentCategoryType = 'expense';
  populateCategoryDropdown('expense', 'أخرى');

  document.getElementById('txTitle').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txNotes').value = '';

  document.getElementById('txModalOverlay').classList.add('active');
}

function openModalForEdit(txId) {
  const list = DB.getTransactions();
  const tx = list.find(t => t.id === txId);
  if (!tx) return;

  state.editingTxId = txId;
  document.getElementById('modalTitle').textContent = 'تعديل المعاملة';
  document.getElementById('btnModalSubmitText').textContent = 'حفظ التعديل';

  document.getElementById('txType').value = tx.type;
  state.currentCategoryType = tx.type;
  populateCategoryDropdown(tx.type, tx.category);

  document.getElementById('txTitle').value = tx.title;
  document.getElementById('txAmount').value = tx.amount;
  document.getElementById('txDate').value = tx.date;
  document.getElementById('txNotes').value = tx.notes || '';

  closeTxDetailModal();
  document.getElementById('txModalOverlay').classList.add('active');
}

function closeModal() {
  document.getElementById('txModalOverlay').classList.remove('active');
}

function saveTxFromForm() {
  const type = document.getElementById('txType').value;
  const title = document.getElementById('txTitle').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const category = document.getElementById('txCategory').value;
  const date = document.getElementById('txDate').value;
  const notes = document.getElementById('txNotes').value.trim();

  if (!title) {
    alert('يرجى إدخال عنوان المعاملة');
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert('يرجى إدخال مبلغ صحيح أكبر من الصفر');
    return;
  }

  const payload = { type, title, amount, category, date, notes };

  if (state.editingTxId) {
    DB.updateTransaction(state.editingTxId, payload);
    showToast('تم تعديل المعاملة بنجاح');
  } else {
    DB.addTransaction(payload);
    showToast('تمت إضافة المعاملة بنجاح');
  }

  closeModal();
  renderCurrentTab();
}

// ----------------------------------------------------
// TRANSACTION DETAIL / EDIT / DELETE MODAL
// ----------------------------------------------------
let activeSelectedTxId = null;

function openTxDetailModal(txId) {
  const list = DB.getTransactions();
  const tx = list.find(t => t.id === txId);
  if (!tx) return;
  activeSelectedTxId = txId;

  document.getElementById('detailTitle').textContent = tx.title;
  document.getElementById('detailAmount').textContent = formatCurrency(tx.amount);
  document.getElementById('detailAmount').className = 'amount-display ' + (tx.type === 'expense' ? 'amount-red' : 'amount-green');
  document.getElementById('detailCategory').textContent = tx.category || 'أخرى';
  document.getElementById('detailDate').textContent = formatDateAr(tx.date);
  document.getElementById('detailNotes').textContent = tx.notes || 'لا توجد ملاحظات';

  document.getElementById('txDetailOverlay').classList.add('active');
}

function closeTxDetailModal() {
  document.getElementById('txDetailOverlay').classList.remove('active');
  activeSelectedTxId = null;
}

// Global actions for detail sheet
window.openTxDetailModal = openTxDetailModal;
window.closeTxDetailModal = closeTxDetailModal;

document.addEventListener('DOMContentLoaded', () => {
  const detailOverlay = document.getElementById('txDetailOverlay');
  if (detailOverlay) {
    detailOverlay.addEventListener('click', (e) => {
      if (e.target === detailOverlay) closeTxDetailModal();
    });
  }

  const btnEdit = document.getElementById('btnDetailEdit');
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      if (activeSelectedTxId) {
        openModalForEdit(activeSelectedTxId);
      }
    });
  }

  const btnDelete = document.getElementById('btnDetailDelete');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      if (activeSelectedTxId && confirm('هل أنت متأكد من حذف هذه المعاملة؟')) {
        DB.deleteTransaction(activeSelectedTxId);
        closeTxDetailModal();
        showToast('تم حذف المعاملة');
        renderCurrentTab();
      }
    });
  }
});

// ----------------------------------------------------
// CATEGORY MANAGEMENT
// ----------------------------------------------------
function initCategoryManager() {
  const catOverlay = document.getElementById('catModalOverlay');
  const closeBtn = document.getElementById('btnCloseCatModal');
  const btnExpense = document.getElementById('btnCatTypeExpense');
  const btnIncome = document.getElementById('btnCatTypeIncome');
  const addForm = document.getElementById('catAddForm');
  const addInput = document.getElementById('catAddInput');

  // Open from Transaction Form
  const btnFromForm = document.getElementById('btnOpenCatModalFromForm');
  if (btnFromForm) {
    btnFromForm.addEventListener('click', () => {
      openCategoryManager(state.currentCategoryType || 'expense');
    });
  }

  // Open from Analysis Tab
  const btnFromAnalysis = document.getElementById('btnOpenCategoryManager');
  if (btnFromAnalysis) {
    btnFromAnalysis.addEventListener('click', () => {
      openCategoryManager('expense');
    });
  }

  // Close
  if (closeBtn) closeBtn.addEventListener('click', closeCategoryManager);
  if (catOverlay) {
    catOverlay.addEventListener('click', (e) => {
      if (e.target === catOverlay) closeCategoryManager();
    });
  }

  // Toggle Type
  if (btnExpense) {
    btnExpense.addEventListener('click', () => {
      setCategoryManagerType('expense');
    });
  }
  if (btnIncome) {
    btnIncome.addEventListener('click', () => {
      setCategoryManagerType('income');
    });
  }

  // Add Category
  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = addInput.value.trim();
      if (!val) return;
      DB.addCustomCategory(state.categoryManagerType, val);
      addInput.value = '';
      showToast(`تمت إضافة فئة "${val}" بنجاح`);
      renderCategoryList();
      populateCategoryDropdown(state.currentCategoryType);
      renderCurrentTab();
    });
  }
}

function openCategoryManager(type = 'expense') {
  setCategoryManagerType(type);
  const catOverlay = document.getElementById('catModalOverlay');
  if (catOverlay) catOverlay.classList.add('active');
}

function closeCategoryManager() {
  const catOverlay = document.getElementById('catModalOverlay');
  if (catOverlay) catOverlay.classList.remove('active');
  populateCategoryDropdown(state.currentCategoryType);
  renderCurrentTab();
}

function setCategoryManagerType(type) {
  state.categoryManagerType = type;
  const btnExpense = document.getElementById('btnCatTypeExpense');
  const btnIncome = document.getElementById('btnCatTypeIncome');
  if (btnExpense) btnExpense.classList.toggle('active', type === 'expense');
  if (btnIncome) btnIncome.classList.toggle('active', type === 'income');
  renderCategoryList();
}

function renderCategoryList() {
  const container = document.getElementById('catListContainer');
  if (!container) return;

  const categories = DB.getCategories(state.categoryManagerType);

  if (categories.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#999; padding: 20px 0; font-size:13.5px;">لا توجد فئات حالياً.</div>';
    return;
  }

  container.innerHTML = categories.map(cat => `
    <div class="cat-list-item">
      <span class="cat-list-name">${escapeHTML(cat)}</span>
      <div class="cat-list-actions">
        <button type="button" class="btn-cat-action" title="تعديل اسم الفئة" onclick="editCategoryAction('${escapeJS(cat)}')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>
        <button type="button" class="btn-cat-action delete" title="حذف الفئة" onclick="deleteCategoryAction('${escapeJS(cat)}')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

function editCategoryAction(catName) {
  const newName = prompt(`تعديل اسم الفئة:`, catName);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed) {
    alert('يرجى إدخال اسم فئة صحيح.');
    return;
  }
  if (trimmed === catName) return;

  const res = DB.editCategory(state.categoryManagerType, catName, trimmed);
  if (res.success) {
    showToast(`تم تعديل الفئة إلى "${trimmed}"`);
    renderCategoryList();
    populateCategoryDropdown(state.currentCategoryType);
    renderCurrentTab();
  } else {
    alert(res.message || 'حدث خطأ أثناء تعديل الفئة.');
  }
}

function deleteCategoryAction(catName) {
  if (confirm(`هل أنت متأكد من حذف فئة "${catName}"؟\nملاحظة: المعاملات الحالية المسجلة بهذه الفئة سيتم تحويلها تلقائياً إلى فئة "أخرى".`)) {
    const res = DB.deleteCategory(state.categoryManagerType, catName);
    if (res.success) {
      showToast(`تم حذف الفئة "${catName}" بنجاح`);
      renderCategoryList();
      populateCategoryDropdown(state.currentCategoryType);
      renderCurrentTab();
    } else {
      alert(res.message || 'تعذر حذف الفئة.');
    }
  }
}

// Expose category actions globally for inline onclick
window.editCategoryAction = editCategoryAction;
window.deleteCategoryAction = deleteCategoryAction;
window.openCategoryManager = openCategoryManager;
window.closeCategoryManager = closeCategoryManager;

// Helper to escape single quotes in JS strings
function escapeJS(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Helper XSS prevention
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
