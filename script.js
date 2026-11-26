function hideIntro() {
  const overlay = document.getElementById('introOverlay');
  if (overlay) {
    overlay.classList.add('done');
  }
}

window.addEventListener('load', () => {
  setTimeout(hideIntro, 500);
});

// احتياط في حال تأخر حدث load
setTimeout(hideIntro, 1800);

const canvas = document.getElementById('stageCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

let width = 0;
let height = 0;
let dpr = Math.min(window.devicePixelRatio || 1, 2);
let animEnabled = true;
let pointer = { x: 0.5, y: 0.45, targetX: 0.5, targetY: 0.45 };
let activeStation = 0;
let parcelProgress = 0.12;

function roundRectPath(c, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath();
}

function resize() {
  if (!canvas || !ctx) return;
  width = window.innerWidth || document.documentElement.clientWidth || 800;
  height = window.innerHeight || document.documentElement.clientHeight || 600;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resize);
resize();

document.addEventListener('mousemove', (e) => {
  if (!width || !height) return;
  pointer.targetX = e.clientX / width;
  pointer.targetY = e.clientY / height;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (e.touches && e.touches.length > 0 && width && height) {
    pointer.targetX = e.touches[0].clientX / width;
    pointer.targetY = e.touches[0].clientY / height;
  }
}, { passive: true });

const appCubes = [
  { label: 'AE', sub: 'AliExpress', color: '#ff5a1f', bx: 0.12, by: 0.24, size: 54, phase: 0.0 },
  { label: 'T', sub: 'Temu', color: '#fb7701', bx: 0.86, by: 0.22, size: 52, phase: 1.4 },
  { label: 'BM', sub: 'BaridiMob', color: '#eab308', bx: 0.16, by: 0.72, size: 50, phase: 2.7 },
  { label: 'TI', sub: 'TrackIt', color: '#0ea5e9', bx: 0.84, by: 0.68, size: 50, phase: 4.1 },
  { label: 'DZ', sub: 'Poste DZ', color: '#10b981', bx: 0.50, by: 0.86, size: 46, phase: 5.2 }
];

function getRoutePoint(t) {
  const startX = width * 0.14;
  const endX = width * 0.86;
  const baseY = height * 0.54 + (pointer.y - 0.5) * 45;
  const x = startX + (endX - startX) * t;
  const wave = Math.sin(t * Math.PI * 2) * (Math.min(width, height) * 0.08);
  const y = baseY - wave;
  return { x, y };
}

function drawIsoCube(x, y, size, tilt, color, label, sub) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);

  const half = size * 0.5;
  const depth = size * 0.24;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, half + depth + 8, half * 0.85, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(15, 31, 44, 0.88)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.2;
  roundRectPath(ctx, -half, -half, size, size, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  roundRectPath(ctx, -14, -half + 8, 28, 22, 7);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px Cairo, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, -half + 19);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 10px Cairo, sans-serif';
  ctx.fillText(sub, 0, 12);

  ctx.restore();
}

function render(now) {
  if (!ctx || width <= 0 || height <= 0) {
    requestAnimationFrame(render);
    return;
  }

  const tSec = (now || 0) * 0.001;
  pointer.x += (pointer.targetX - pointer.x) * 0.06;
  pointer.y += (pointer.targetY - pointer.y) * 0.06;

  ctx.clearRect(0, 0, width, height);

  const grad = ctx.createRadialGradient(
    width * pointer.x,
    height * pointer.y,
    20,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.75
  );
  grad.addColorStop(0, 'rgba(255, 106, 26, 0.14)');
  grad.addColorStop(0.5, 'rgba(14, 165, 233, 0.06)');
  grad.addColorStop(1, 'rgba(7, 16, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.beginPath();
  const steps = 80;
  for (let i = 0; i <= steps; i++) {
    const p = getRoutePoint(i / steps);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([7, 7]);
  ctx.stroke();
  ctx.setLineDash([]);

  const stationPositions = [0.05, 0.36, 0.68, 0.96];
  stationPositions.forEach((pos, idx) => {
    const pt = getRoutePoint(pos);
    const isCurrent = idx === activeStation;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, isCurrent ? 10 : 6, 0, Math.PI * 2);
    ctx.fillStyle = isCurrent ? '#ff6a1a' : 'rgba(148, 163, 184, 0.55)';
    ctx.fill();

    if (isCurrent) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 17 + Math.sin(tSec * 4) * 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 106, 26, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  if (animEnabled) {
    parcelProgress += 0.0018;
    if (parcelProgress > 1) parcelProgress = 0;
  }

  const parcelPt = getRoutePoint(parcelProgress);
  ctx.save();
  ctx.translate(parcelPt.x, parcelPt.y);
  ctx.rotate(Math.sin(tSec * 3) * 0.14);

  ctx.fillStyle = 'rgba(255, 106, 26, 0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff6a1a';
  ctx.strokeStyle = '#ffd0b0';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, -13, -13, 26, 26, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.fillRect(-2, -13, 4, 26);
  ctx.restore();

  appCubes.forEach((c) => {
    const floatY = Math.sin(tSec * 1.4 + c.phase) * 14;
    const floatX = Math.cos(tSec * 1.1 + c.phase) * 10;
    const parallaxX = (pointer.x - 0.5) * 28;
    const parallaxY = (pointer.y - 0.5) * 24;
    const tilt = Math.sin(tSec * 1.2 + c.phase) * 0.14 + (pointer.x - 0.5) * 0.2;

    drawIsoCube(
      width * c.bx + floatX + parallaxX,
      height * c.by + floatY + parallaxY,
      c.size,
      tilt,
      c.color,
      c.label,
      c.sub
    );
  });

  ctx.restore();
  requestAnimationFrame(render);
}

requestAnimationFrame(render);

const stations = [
  {
    badge: 'المحطة 01 / 04',
    title: 'إرسال الرابط وتأكيد التفاصيل',
    desc: 'ترسل رابط المنتج من AliExpress أو Temu في الخاص، نتحقق من توافره وخلوه من القيود الجمركية، ونحسب لك التكلفة بدقة.',
    pos: 0.05
  },
  {
    badge: 'المحطة 02 / 04',
    title: 'الدفع بالدينار عبر BaridiMob',
    desc: 'بعد اعتماد الطلب، تحوّل المبلغ الإجمالي بالدينار عبر BaridiMob دون الحاجة لبطاقة بنكية أو عملة صعبة.',
    pos: 0.36
  },
  {
    badge: 'المحطة 03 / 04',
    title: 'إتمام الطلب والشحن الدولي',
    desc: 'ننفّذ الطلب فوراً على المتجر ونزوّدك برقم التتبع لمتابعة مسار الطرد وفق الضوابط الجمركية المعتمدة.',
    pos: 0.68
  },
  {
    badge: 'المحطة 04 / 04',
    title: 'متابعة TrackIt واستلام البريد',
    desc: 'تتابع وصول الشحنة عبر TrackIt وتستلم طردك مباشرة في مكتب البريد ببلديتك في أي ولاية.',
    pos: 0.96
  }
];

const chips = document.querySelectorAll('.station-chip');
const stationBadge = document.getElementById('stationBadge');
const stationTitle = document.getElementById('stationTitle');
const stationDesc = document.getElementById('stationDesc');

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const idx = Number(chip.dataset.station);
    activeStation = idx;
    parcelProgress = stations[idx].pos;
    chips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    stationBadge.textContent = stations[idx].badge;
    stationTitle.textContent = stations[idx].title;
    stationDesc.textContent = stations[idx].desc;
  });
});

const toggleStageBtn = document.getElementById('toggleStageBtn');
if (toggleStageBtn) {
  toggleStageBtn.addEventListener('click', () => {
    animEnabled = !animEnabled;
    toggleStageBtn.textContent = animEnabled ? 'إيقاف/تشغيل الحركة' : 'تشغيل الحركة';
  });
}

const storeSelect = document.getElementById('storeSelect');
const usdInput = document.getElementById('usdInput');
const rateInput = document.getElementById('rateInput');
const linkInput = document.getElementById('linkInput');
const firstTenToggle = document.getElementById('firstTenToggle');

const productDzdOut = document.getElementById('productDzdOut');
const feeDzdOut = document.getElementById('feeDzdOut');
const totalDzdOut = document.getElementById('totalDzdOut');
const commissionBadge = document.getElementById('commissionBadge');

function updateCalc() {
  const usd = Math.max(0, parseFloat(usdInput && usdInput.value) || 0);
  const rate = Math.max(1, parseFloat(rateInput && rateInput.value) || 250);
  const isFreeFee = Boolean(firstTenToggle && firstTenToggle.checked);

  const feeUsd = isFreeFee ? 0 : usd * 0.10;
  const productDzd = Math.round(usd * rate);
  const feeDzd = Math.round(feeUsd * rate);
  const totalDzd = productDzd + feeDzd;

  if (productDzdOut) productDzdOut.textContent = `${productDzd.toLocaleString('en-US')} دج`;
  if (feeDzdOut) feeDzdOut.textContent = isFreeFee ? '0 دج (عرض 10)' : `${feeDzd.toLocaleString('en-US')} دج`;
  if (totalDzdOut) totalDzdOut.textContent = `${totalDzd.toLocaleString('en-US')} دج`;

  if (commissionBadge) {
    if (isFreeFee) {
      commissionBadge.textContent = '0% عمولة • عرض الافتتاح';
      commissionBadge.style.color = '#34d399';
      commissionBadge.style.borderColor = 'rgba(52, 211, 153, 0.45)';
      commissionBadge.style.background = 'rgba(52, 211, 153, 0.12)';
    } else {
      commissionBadge.textContent = 'عمولة 1$ / 10$';
      commissionBadge.style.color = '#ffb380';
      commissionBadge.style.borderColor = 'rgba(255, 106, 26, 0.4)';
      commissionBadge.style.background = 'rgba(255, 106, 26, 0.18)';
    }
  }
}

[usdInput, rateInput, firstTenToggle].forEach((el) => {
  if (!el) return;
  el.addEventListener('input', updateCalc);
  el.addEventListener('change', updateCalc);
});

updateCalc();

const copyBtn = document.getElementById('copyBtn');
const copyToast = document.getElementById('copyToast');

if (copyBtn) {
  copyBtn.addEventListener('click', () => {
    const usd = Math.max(0, parseFloat(usdInput && usdInput.value) || 0);
    const rate = Math.max(1, parseFloat(rateInput && rateInput.value) || 250);
    const isFreeFee = Boolean(firstTenToggle && firstTenToggle.checked);
    const feeUsd = isFreeFee ? 0 : usd * 0.10;
    const totalDzd = Math.round((usd + feeUsd) * rate);
    const url = (linkInput && linkInput.value.trim()) || '(سأرسل الرابط هنا)';
    const store = (storeSelect && storeSelect.value) || 'AliExpress';

    const text =
`طلب جديد عبر Commandili DZ (كومنديلي) 🇩🇿
• المنصة: ${store}
• الرابط: ${url}
• سعر المنتج: ${usd.toFixed(2)}$
• النظام: ${isFreeFee ? 'عرض أول 10 زبائن (بدون عمولة 0%)' : 'عمولة 1$ لكل 10$'}
• الإجمالي التقريبي عبر BaridiMob: ${totalDzd.toLocaleString('en-US')} دج`;

    navigator.clipboard.writeText(text).then(() => {
      if (copyToast) {
        copyToast.classList.add('show');
        setTimeout(() => copyToast.classList.remove('show'), 3500);
      }
    });
  });
    }
