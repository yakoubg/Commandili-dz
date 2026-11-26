// إخفاء شاشة التحميل بعد اكتمال التحميل
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  setTimeout(() => {
    preloader.classList.add('hidden');
  }, 550);
});

// شريط تقدم التمرير وتحريك المكعبات الطائرة مع المؤشر
const scrollProgress = document.getElementById('scrollProgress');
const floatingCubes = document.querySelectorAll('.floating-cube');

window.addEventListener('scroll', () => {
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
  scrollProgress.style.width = `${progress}%`;
}, { passive: true });

document.addEventListener('mousemove', (e) => {
  const cx = (e.clientX / window.innerWidth - 0.5) * 2;
  const cy = (e.clientY / window.innerHeight - 0.5) * 2;

  floatingCubes.forEach((cube) => {
    const speed = parseFloat(cube.dataset.speed) || 0.02;
    const tx = cx * 650 * speed;
    const ty = cy * 650 * speed;
    cube.style.marginLeft = `${tx}px`;
    cube.style.marginTop = `${ty}px`;
  });
}, { passive: true });

// تأثير إمالة خفيفة للبطاقات عند تحريك المؤشر
document.querySelectorAll('.tilt-card').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const rotateX = (-y * 6).toFixed(2);
    const rotateY = (x * 6).toFixed(2);
    card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});

// حاسبة التكلفة والعمولة
const priceInput = document.getElementById('productPrice');
const rateInput = document.getElementById('exchangeRate');
const platformSelect = document.getElementById('platform');
const urlInput = document.getElementById('productUrl');
const promoCheck = document.getElementById('promoCheck');

const resUsd = document.getElementById('resUsd');
const resProductDzd = document.getElementById('resProductDzd');
const resCommission = document.getElementById('resCommission');
const resTotalDzd = document.getElementById('resTotalDzd');
const statusBadge = document.getElementById('statusBadge');

const copyOrderBtn = document.getElementById('copyOrderBtn');
const copyFeedback = document.getElementById('copyFeedback');

let currentAnimatedTotal = 2750;

function animateValue(element, start, end, duration) {
  const startTime = performance.now();
  element.classList.add('bump');
  setTimeout(() => element.classList.remove('bump'), 220);

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(start + (end - start) * easeOut);
    element.textContent = value.toLocaleString('en-US') + ' دج';
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

function calculate() {
  const usd = Math.max(0, parseFloat(priceInput.value) || 0);
  const rate = Math.max(1, parseFloat(rateInput.value) || 250);
  const isPromo = promoCheck.checked;

  // العمولة: 1 دولار لكل 10 دولار (أي 10% من قيمة المنتج)
  const commUsd = isPromo ? 0 : usd * 0.10;
  const productDzd = Math.round(usd * rate);
  const commDzd = Math.round(commUsd * rate);
  const totalDzd = productDzd + commDzd;

  resUsd.textContent = usd.toFixed(2) + ' $';
  resProductDzd.textContent = productDzd.toLocaleString('en-US') + ' دج';

  if (isPromo) {
    resCommission.textContent = '0.00 $ (مجاناً 🎉)';
    resCommission.style.color = '#22c55e';
    statusBadge.textContent = 'عرض 10 الأوائل مفعّل';
    statusBadge.style.color = '#22c55e';
  } else {
    resCommission.textContent = `${commUsd.toFixed(2)} $ (${commDzd.toLocaleString('en-US')} دج)`;
    resCommission.style.color = '#f36f21';
    statusBadge.textContent = 'التسعيرة العادية';
    statusBadge.style.color = '#94a3b8';
  }

  animateValue(resTotalDzd, currentAnimatedTotal, totalDzd, 320);
  currentAnimatedTotal = totalDzd;
}

[priceInput, rateInput, promoCheck].forEach((el) => {
  el.addEventListener('input', calculate);
  el.addEventListener('change', calculate);
});

// نسخ رسالة الطلب الجاهزة
copyOrderBtn.addEventListener('click', () => {
  const usd = Math.max(0, parseFloat(priceInput.value) || 0);
  const rate = Math.max(1, parseFloat(rateInput.value) || 250);
  const isPromo = promoCheck.checked;
  const commUsd = isPromo ? 0 : usd * 0.10;
  const totalDzd = Math.round((usd + commUsd) * rate);
  const link = urlInput.value.trim() || '(سأرفق الرابط هنا)';

  const message =
`السلام عليكم Commandili DZ 🇩🇿
أريد طلب هذا المنتج:
• المتجر: ${platformSelect.value}
• الرابط: ${link}
• سعر المنتج: ${usd.toFixed(2)}$
• العرض: ${isPromo ? 'عرض الـ 10 الأوائل (0% عمولة)' : 'عمولة عادية (1$ لكل 10$)'}
• المجموع التقديري عبر BaridiMob: ${totalDzd.toLocaleString('en-US')} دج`;

  navigator.clipboard.writeText(message).then(() => {
    copyFeedback.classList.add('show');
    setTimeout(() => copyFeedback.classList.remove('show'), 3500);
  });
});

// تفعيل الأكورديون لدليل الجمارك
document.querySelectorAll('.acc-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.parentElement;
    const isActive = item.classList.contains('active');
    document.querySelectorAll('.acc-item').forEach((i) => i.classList.remove('active'));
    if (!isActive) item.classList.add('active');
  });
});

// حركات الظهور عند التمرير
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

calculate();
