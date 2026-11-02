// Local Storage Database Management
const STORAGE_KEY = 'edartak_transactions_data';
const SETTINGS_KEY = 'edartak_settings';

const DEFAULT_CATEGORIES = {
  expense: [
    'أخرى',
    'طعام ومشروبات',
    'فواتير والتزامات',
    'تسوق ومشتريات',
    'مواصلات',
    'صحة ودواء',
    'سكن وإيجار',
    'ترفيه',
    'صدقات وتبرعات',
    'أطفال وعائلة'
  ],
  income: [
    'راتب شهري',
    'عمل حر',
    'تجارة ومبيعات',
    'مكافأة',
    'استثمار',
    'تحويل وارد',
    'أخرى'
  ]
};

const DB = {
  // STRICT REQUIREMENT: No dummy data. Empty array by default.
  getTransactions() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading transactions:', e);
      return [];
    }
  },

  saveTransactions(transactions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch (e) {
      console.error('Error saving transactions:', e);
      return false;
    }
  },

  addTransaction(item) {
    const list = this.getTransactions();
    const newTx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      type: item.type, // 'expense' or 'income'
      title: item.title.trim(),
      amount: parseFloat(item.amount) || 0,
      category: item.category ? item.category.trim() : 'أخرى',
      date: item.date || new Date().toISOString().split('T')[0],
      notes: (item.notes || '').trim(),
      createdAt: Date.now()
    };
    list.unshift(newTx);
    this.saveTransactions(list);
    return newTx;
  },

  updateTransaction(id, updatedFields) {
    const list = this.getTransactions();
    const index = list.findIndex(tx => tx.id === id);
    if (index !== -1) {
      list[index] = {
        ...list[index],
        ...updatedFields,
        amount: parseFloat(updatedFields.amount) || list[index].amount,
        updatedAt: Date.now()
      };
      this.saveTransactions(list);
      return list[index];
    }
    return null;
  },

  deleteTransaction(id) {
    let list = this.getTransactions();
    list = list.filter(tx => tx.id !== id);
    this.saveTransactions(list);
    return true;
  },

  clearAllData() {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  },

  getAllCategories() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY + '_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          expense: Array.isArray(parsed.expense) && parsed.expense.length > 0 ? parsed.expense : [...DEFAULT_CATEGORIES.expense],
          income: Array.isArray(parsed.income) && parsed.income.length > 0 ? parsed.income : [...DEFAULT_CATEGORIES.income]
        };
      }
    } catch (e) {}
    return {
      expense: [...DEFAULT_CATEGORIES.expense],
      income: [...DEFAULT_CATEGORIES.income]
    };
  },

  saveAllCategories(cats) {
    try {
      localStorage.setItem(SETTINGS_KEY + '_categories', JSON.stringify(cats));
      return true;
    } catch (e) {
      console.error('Error saving categories:', e);
      return false;
    }
  },

  getCategories(type) {
    const cats = this.getAllCategories();
    return cats[type] || DEFAULT_CATEGORIES[type] || [];
  },

  addCustomCategory(type, categoryName) {
    categoryName = categoryName.trim();
    if (!categoryName) return false;
    const cats = this.getAllCategories();
    if (!cats[type]) cats[type] = [];
    if (!cats[type].includes(categoryName)) {
      cats[type].push(categoryName);
      this.saveAllCategories(cats);
    }
    return true;
  },

  editCategory(type, oldName, newName) {
    oldName = oldName.trim();
    newName = newName.trim();
    if (!oldName || !newName) return { success: false, message: 'اسم الفئة غير صالح' };
    if (oldName === newName) return { success: true };

    const cats = this.getAllCategories();
    if (!cats[type]) return { success: false, message: 'نوع الفئة غير صالح' };

    const idx = cats[type].indexOf(oldName);
    if (idx === -1) return { success: false, message: 'الفئة الأصلية غير موجودة' };

    if (cats[type].includes(newName)) {
      return { success: false, message: 'يوجد فئة أخرى بنفس الاسم بالفعل' };
    }

    // Update in categories list
    cats[type][idx] = newName;
    this.saveAllCategories(cats);

    // Update all matching transactions in DB
    const list = this.getTransactions();
    let txUpdated = 0;
    list.forEach(tx => {
      if (tx.type === type && tx.category === oldName) {
        tx.category = newName;
        txUpdated++;
      }
    });
    if (txUpdated > 0) {
      this.saveTransactions(list);
    }

    return { success: true, count: txUpdated };
  },

  deleteCategory(type, categoryName) {
    categoryName = categoryName.trim();
    if (!categoryName) return { success: false, message: 'اسم الفئة غير صالح' };

    const cats = this.getAllCategories();
    if (!cats[type]) return { success: false, message: 'نوع الفئة غير صالح' };

    if (cats[type].length <= 1) {
      return { success: false, message: 'لا يمكن حذف الفئة الأخيرة. يجب الاحتفاظ بفئة واحدة على الأقل.' };
    }

    const idx = cats[type].indexOf(categoryName);
    if (idx === -1) return { success: false, message: 'الفئة غير موجودة' };

    cats[type].splice(idx, 1);
    this.saveAllCategories(cats);

    // Fallback category for affected transactions
    const fallbackCategory = cats[type].includes('أخرى') ? 'أخرى' : cats[type][0];
    const list = this.getTransactions();
    let txReassigned = 0;
    list.forEach(tx => {
      if (tx.type === type && tx.category === categoryName) {
        tx.category = fallbackCategory;
        txReassigned++;
      }
    });
    if (txReassigned > 0) {
      this.saveTransactions(list);
    }

    return { success: true, fallbackCategory, count: txReassigned };
  },

  // Export full JSON backup file directly to user device
  exportBackupJSON() {
    const data = {
      app: 'إدارتك المالية',
      version: '1.1',
      exportedAt: new Date().toISOString(),
      categories: this.getAllCategories(),
      transactions: this.getTransactions()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `نسخة_احتياطية_إدارتك_المالية_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Import backup file from user device
  importBackupJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (Array.isArray(parsed)) {
            this.saveTransactions(parsed);
            resolve(parsed.length);
          } else if (parsed && Array.isArray(parsed.transactions)) {
            this.saveTransactions(parsed.transactions);
            if (parsed.categories && typeof parsed.categories === 'object') {
              this.saveAllCategories(parsed.categories);
            }
            resolve(parsed.transactions.length);
          } else {
            reject(new Error('صيغة ملف النسخة الاحتياطية غير صالحة'));
          }
        } catch (err) {
          reject(new Error('فشل قراءة الملف، تأكد من صحة ملف JSON'));
        }
      };
      reader.onerror = () => reject(new Error('خطأ أثناء قراءة الملف'));
      reader.readAsText(file);
    });
  },

  // Export CSV for Excel
  exportToCSV() {
    const list = this.getTransactions();
    if (list.length === 0) {
      alert('لا توجد معاملات مسجلة لتصديرها.');
      return;
    }
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Arabic support
    csvContent += 'النوع,العنوان,المبلغ (ج.م),الفئة,التاريخ,الملاحظات\n';

    list.forEach(item => {
      const typeStr = item.type === 'expense' ? 'مصروف' : 'إيراد';
      const row = [
        `"${typeStr}"`,
        `"${(item.title || '').replace(/"/g, '""')}"`,
        `"${item.amount.toFixed(2)}"`,
        `"${(item.category || '').replace(/"/g, '""')}"`,
        `"${item.date}"`,
        `"${(item.notes || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `معاملات_إدارتك_المالية_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
