import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const LanguageContext = createContext(null)

const TRANSLATIONS = {
  'المراقبة': 'Monitor', 'الرسائل المباشرة': 'SMS Live', 'مهام الشكاوى': 'Complaint tasks', 'القائمة السوداء': 'Blacklist', 'استرجاع': 'Recovery', 'المحافظ': 'Wallets', 'الإعدادات': 'Settings', 'التقرير الشامل': 'Full report', 'التحليلات': 'Analytics', 'تحليلات الأداء': 'Performance analytics', 'تقرير المحافظ': 'Wallet report', 'المستخدمون والصلاحيات': 'Users & permissions', 'متصل الآن': 'Online', 'مطابقة مؤكدة': 'Confirmed match', 'SMS مطابقة': 'Matched SMS',
  'تحديث': 'Refresh', 'مسح الفلاتر': 'Clear filters', 'بحث': 'Search', 'الكل': 'All', 'الحالة': 'Status', 'المبلغ': 'Amount', 'رقم العملية': 'Transaction ID', 'وقت الإنشاء': 'Created time', 'آخر تحديث': 'Updated time', 'وقت الاستلام': 'Received time', 'الجهاز': 'Device', 'النوع': 'Type', 'من/إلى': 'From/To', 'نص الرسالة': 'Message', 'الرصيد بعدها': 'Balance after', 'معاملة مرتبطة': 'Linked transaction', 'من وافق': 'Approved by', 'طريقة التنفيذ': 'Operation by', 'اعتماد': 'Approve', 'رفض': 'Decline', 'تعديل': 'Edit', 'عرض': 'View', 'نسخ': 'Copy', 'إغلاق': 'Close', 'إلغاء': 'Cancel', 'حفظ': 'Save', 'تأكيد': 'Confirm', 'جاري التحميل...': 'Loading...', 'لا توجد بيانات': 'No data', 'تعذر تحميل البيانات': 'Unable to load data', 'لا توجد عمليات مطابقة': 'No matching transactions', 'لا توجد رسائل': 'No messages', 'غير مرتبطة': 'Not linked', 'إيداع': 'Deposit', 'سحب': 'Withdrawal', 'إيداع أول': 'First deposit', 'إيداع احتفاظ': 'Retention deposit', 'إجمالي اليوم': 'Today total', 'إجمالي المبالغ': 'Total amount', 'قيد الانتظار': 'Pending', 'مدفوعة': 'Paid', 'مرفوضة': 'Declined', 'إجمالي الرسائل': 'Total messages', 'إيداعات': 'Deposits', 'سحوبات': 'Withdrawals', 'آخر وصول': 'Last received', 'آخر رسالة مستلمة': 'Latest received SMS', 'مزود الخدمة': 'Provider', 'من تاريخ': 'From date', 'إلى تاريخ': 'To date', 'عدد الصفوف': 'Rows per page', 'تفاصيل العملية': 'Transaction details', 'تفاصيل SMS': 'SMS details', 'تفاصيل المعاملة المرتبطة': 'Linked transaction details', 'سجل إجراءات المعاملة': 'Transaction action history', 'لا يوجد سجل إجراءات لهذه المعاملة': 'No action history for this transaction', 'طريقة التنفيذ': 'Operation by', 'بيانات Maven و SMS': 'Maven and SMS data', 'التقرير الشامل': 'Full report', 'القائمة السوداء': 'Blacklist', 'حظر ورفض تلقائي': 'Blacklist and auto-decline', 'حظر الرقم ورفض العملية': 'Blacklist number and decline transaction', 'الإشعارات': 'Notifications', 'جديدة': 'new', 'لا توجد إشعارات جديدة': 'No new notifications', 'عرض إثبات الدفع': 'View payment proof', 'إثبات الدفع': 'Payment proof', 'النص الخام الكامل': 'Full raw text', 'حفظ التعديل': 'Save edit', 'Telegram details': 'Telegram details', 'رسائل واردة': 'Incoming messages', 'تحديث تلقائي': 'Auto refresh', 'مفتوحة': 'Open', 'معلقة': 'Pending', 'محلولة': 'Resolved', 'لا توجد شكاوى': 'No complaints', 'سبب القرار': 'Decision reason', 'أسباب المطابقة': 'Match reasons', 'حالة المطابقة': 'Match status', 'درجة المطابقة': 'Match score', 'سبب المطابقة / الموافقة': 'Match / approval reason', 'إنشاء مستخدم': 'Create user', 'المستخدمون': 'Users', 'الصلاحيات': 'Permissions', 'دور': 'Role', 'اسم المستخدم': 'Username', 'اسم العرض': 'Display name', 'كلمة المرور': 'Password', 'مستخدم جديد': 'New user',
  'Live polling': 'استطلاع مباشر', 'Messages': 'الرسائل', 'Active sessions': 'الجلسات النشطة', 'Alerts': 'التنبيهات', 'Bot status': 'حالة البوت', 'Sessions': 'الجلسات', 'No Telegram data': 'لا توجد بيانات Telegram', 'Waiting for bot activity': 'بانتظار نشاط البوت', 'Users, Roles & Permissions': 'المستخدمون والأدوار والصلاحيات', 'RBAC administration': 'إدارة RBAC', 'Create user': 'إنشاء مستخدم', 'Profile & users': 'الملف والمستخدمون', 'Profile settings': 'إعدادات الملف', 'Log out': 'تسجيل الخروج', 'Operator': 'المشغل', 'Administrator': 'مدير', 'Wallet Financial Report': 'تقرير المحافظ المالي', 'Wallet flow, success and SMS confirmation': 'تدفقات المحافظ والنجاح وتأكيد SMS', 'Settlement & P&L': 'التسويات والأرباح والخسائر', 'July Maven settlement report': 'تقرير تسويات Maven لشهر يوليو', 'Search wallet or merchant...': 'ابحث عن محفظة أو تاجر...', 'All wallets': 'كل المحافظ', 'High SMS match': 'تأكيد SMS مرتفع', 'Low coverage': 'تغطية ضعيفة', 'No SMS': 'بدون SMS', 'Settlement tasks': 'مهام التسوية',
}

function translateText(value, language) {
  let result = value
  for (const [ar, en] of Object.entries(TRANSLATIONS)) {
    const source = language === 'ar' ? en : ar
    const target = language === 'ar' ? ar : en
    if (result.trim() === source) return result.replace(source, target)
    result = result.split(source).join(target)
  }
  return result
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('ontarget-language') || 'en')
  useEffect(() => {
    localStorage.setItem('ontarget-language', language)
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    const translate = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const nodes = []
      while (walker.nextNode()) nodes.push(walker.currentNode)
      nodes.forEach((node) => { if (node.parentElement?.closest('[data-no-translate],script,style,textarea')) return; const next = translateText(node.nodeValue, language); if (next !== node.nodeValue) node.nodeValue = next })
      document.querySelectorAll('input[placeholder],button[title],a[title]').forEach((element) => { const attribute = element.hasAttribute('placeholder') ? 'placeholder' : 'title'; const current = element.getAttribute(attribute) || ''; const next = translateText(current, language); if (next !== current) element.setAttribute(attribute, next) })
    }
    translate()
    const observer = new MutationObserver(translate)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [language])
  const value = useMemo(() => ({ language, setLanguage, toggleLanguage: () => setLanguage((current) => current === 'ar' ? 'en' : 'ar'), t: (ar, en) => language === 'ar' ? ar : en }), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
