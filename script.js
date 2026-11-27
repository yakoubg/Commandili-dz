/* -------------------------------------------------
   Commandili DZ – ملف JavaScript متكامل
   • قراءة سعر الصرف اليومي تلقائياً من rate.json (مع تجاوز الكاش)
   • تفاعل كامل للمحطات والزر العلوي وحركة الطرد على Canvas
   • حاسبة فورية تدعم عرض أول 10 زبائن (0% عمولة)
   • أكورديون الأسئلة الشائعة + النسخ والتواصل المباشر
   ------------------------------------------------- */

(function () {
  'use strict';

  const CFG = Object.freeze({
    rateFile: './rate.json',
    feePercent: 0.10,
    defaultRate: 250,
    minRate: 100,
    maxRate: 1000,
    defaultUsd: 20,
    maxUsd: 10000,
    maxLinkLength: 1000,
    roundingStep: 5,
    introDelay: 400,
    introMaxDelay: 1500,
    canvasFpsCap: 30,
    allowedStores: new Set(['AliExpress', 'Temu'])
  });

  const STATIONS = Object.freeze([
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
  ]);

  const APP_CUBES = Object.freeze([
    { label: 'AE', sub: 'AliExpress', color: '#ff5a1f', bx: 0.12, by: 0.24, size: 54, phase: 0.0 },
    { label: 'T',  sub: 'Temu',       color: '#fb7701', bx: 0.86, by: 0.22, size: 52, phase: 1.4 },
    { label: 'BM', sub: 'BaridiMob',  color: '#eab308', bx: 0.16, by: 0.72, size: 50, phase: 2.7 },
    { label: 'TI', sub: 'TrackIt',    color: '#0ea5e9', bx: 0.84, by: 0.68, size: 50, phase: 4.1 },
    { label: 'DZ', sub: 'Poste DZ',   color: '#10b981', bx: 0.50, by: 0.86, size: 46, phase: 5.2 }
  ]);

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const fmtDZD = new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 });
  const roundDZD = v => Math.round(v / CFG.roundingStep) * CFG.roundingStep;
  const setText = (id, txt) => { const el = $(`#${id}`); if (el) el.textContent = txt; };

  function sanitizeText(str, maxLen = 1000) {
    if (typeof str !== 'string') return '';
    return str.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
  }

  function validateProductUrl(raw) {
    const cleaned = sanitizeText(raw, CFG.maxLinkLength);
    if (!cleaned) return { ok: true, empty: true, value: '', message: '' };
    try {
      const parsed = new URL(cleaned);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { ok: false, empty: false, value: '', message: 'يرجى إدخال رابط يبدأ بـ https:// فقط.' };
      }
      return { ok: true, empty: false, value: parsed.toString(), message: '' };
    } catch {
      return { ok: false, empty: false, value: '', message: 'صيغة الرابط غير صحيحة؛ تأكد من نسخ الرابط كاملاً من المتجر.' };
    }
  }

  function clampNumber(raw, min, max, fallback) {
    if (raw === '' || raw === null || raw === undefined) return fallback;
    const num = Number(raw);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  const State = {
    animEnabled: true,
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    activeStation: 0,
    parcelProgress: 0.05,
    pointer: { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45 },
    canvas: { w: 0, h: 0, dpr: 1, ctx: null, rafId: null, lastTs: 0, visible: true },
    inputs: {
      store: 'AliExpress',
      usd: CFG.defaultUsd,
      rate: CFG.defaultRate,
      link: '',
      linkValid: true,
      firstTen: false
    }
  };

  function initIntro() {
    const overlay = $('#introOverlay');
    if (!overlay) return;

    let done = false;
    const hide = () => {
      if (done) return;
      done = true;
      overlay.classList.add('done');
      try { sessionStorage.setItem('cmd_intro_done', '1'); } catch (_) {}
      setTimeout(() => { overlay.style.display = 'none'; }, 620);
    };

    try {
      if (sessionStorage.getItem('cmd_intro_done') === '1') {
        overlay.classList.add('done');
        overlay.style.display = 'none';
        return;
      }
    } catch (_) {}

    setTimeout(hide, CFG.introDelay);
    setTimeout(hide, CFG.introMaxDelay);
    document.addEventListener('click', hide, { once: true, passive: true });
    document.addEventListener('keydown', hide, { once: true, passive: true });
  }

  const Canvas = {
    init() {
      const canvas = $('#stageCanvas');
      if (!canvas) return;
      State.canvas.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
      this.resize();
      window.addEventListener('resize', this.resize.bind(this), { passive: true });

      const observer = new IntersectionObserver(entries => {
        State.canvas.visible = entries[0]?.isIntersecting ?? true;
      }, { rootMargin: '100px' });
      observer.observe(canvas);

      document.addEventListener('mousemove', e => {
        if (State.canvas.w > 0 && State.canvas.h > 0) {
          State.pointer.tx = e.clientX / State.canvas.w;
          State.pointer.ty = e.clientY / State.canvas.h;
        }
      }, { passive: true });

      document.addEventListener('touchmove', e => {
        if (e.touches[0] && State.canvas.w > 0 && State.canvas.h > 0) {
          State.pointer.tx = e.touches[0].clientX / State.canvas.w;
          State.pointer.ty = e.touches[0].clientY / State.canvas.h;
        }
      }, { passive: true });

      this.loop(0);
    },

    resize() {
      const c = State.canvas;
      c.w = window.innerWidth;
      c.h = window.innerHeight;
      c.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = $('#stageCanvas');
      if (canvas && c.ctx) {
        canvas.width = Math.max(1, Math.floor(c.w * c.dpr));
        canvas.height = Math.max(1, Math.floor(c.h * c.dpr));
        c.ctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);
      }
    },

    loop(ts) {
      const c = State.canvas;
      c.rafId = requestAnimationFrame(this.loop.bind(this));
      if (ts - c.lastTs < 1000 / CFG.canvasFpsCap) return;
      c.lastTs = ts;
      if (State.reduceMotion || !c.visible) return;
      if (!c.ctx || c.w <= 0 || c.h <= 0) return;
      this.render(ts * 0.001);
    },

    render(t) {
      const { ctx, w, h } = State.canvas;
      const { pointer, activeStation } = State;

      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;

      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createRadialGradient(
        w * pointer.x, h * pointer.y, 20,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.75
      );
      grad.addColorStop(0, 'rgba(255, 106, 26, 0.14)');
      grad.addColorStop(0.5, 'rgba(14, 165, 233, 0.06)');
      grad.addColorStop(1, 'rgba(7, 16, 23, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const getRoutePoint = ratio => {
        const startX = w * 0.14, endX = w * 0.86;
        const baseY = h * 0.54 + (pointer.y - 0.5) * 45;
        const x = startX + (endX - startX) * ratio;
        const wave = Math.sin(ratio * Math.PI * 2) * (Math.min(w, h) * 0.08);
        return { x, y: baseY - wave };
      };

      ctx.beginPath();
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const p = getRoutePoint(i / steps);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 7]);
      ctx.stroke();
      ctx.setLineDash([]);

      STATIONS.forEach((st, idx) => {
        const pt = getRoutePoint(st.pos);
        const active = idx === activeStation;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, active ? 10 : 6, 0, Math.PI * 2);
        ctx.fillStyle = active ? '#ff6a1a' : 'rgba(148, 163, 184, 0.55)';
        ctx.fill();

        if (active) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 17 + Math.sin(t * 4) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 106, 26, 0.45)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      if (State.animEnabled) {
        State.parcelProgress += 0.0018;
        if (State.parcelProgress > 1) State.parcelProgress = 0;
      }

      const parcelPt = getRoutePoint(State.parcelProgress);
      ctx.save();
      ctx.translate(parcelPt.x, parcelPt.y);
      ctx.rotate(State.animEnabled ? Math.sin(t * 3) * 0.14 : 0);
      ctx.fillStyle = 'rgba(255,106,26,0.25)';
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6a1a';
      ctx.strokeStyle = '#ffd0b0';
      ctx.lineWidth = 1.5;
      this.roundRectPath(ctx, -13, -13, 26, 26, 6);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-2, -13, 4, 26);
      ctx.restore();

      APP_CUBES.forEach(c => {
        const floatY = State.animEnabled ? Math.sin(t * 1.4 + c.phase) * 14 : 0;
        const floatX = State.animEnabled ? Math.cos(t * 1.1 + c.phase) * 10 : 0;
        const px = (pointer.x - 0.5) * 28;
        const py = (pointer.y - 0.5) * 24;
        const tilt = State.animEnabled ? Math.sin(t * 1.2 + c.phase) * 0.14 + (pointer.x - 0.5) * 0.2 : 0;
        this.drawIsoCube(
          w * c.bx + floatX + px,
          h * c.by + floatY + py,
          c.size, tilt, c.color, c.label, c.sub
        );
      });
    },

    roundRectPath(c, x, y, w, h, r) {
      const rad = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + rad, y);
      c.arcTo(x + w, y, x + w, y + h, rad);
      c.arcTo(x + w, y + h, x, y + h, rad);
      c.arcTo(x, y + h, x, y, rad);
      c.arcTo(x, y, x + w, y, rad);
      c.closePath();
    },

    drawIsoCube(x, y, size, tilt, color, label, sub) {
      const { ctx } = State.canvas;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      const half = size * 0.5;
      const depth = size * 0.24;

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(0, half + depth + 8, half * 0.85, 8, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(15,31,44,0.88)';
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.2;
      this.roundRectPath(ctx, -half, -half, size, size, 12);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = color;
      this.roundRectPath(ctx, -14, -half + 8, 28, 22, 7);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '900 11px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, -half + 19);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '700 10px Cairo, sans-serif';
      ctx.fillText(sub, 0, 12);
      ctx.restore();
    }
  };

  const UI = {
    cache() {
      this.el = {
        form:             $('#orderCalcForm'),
        nextStationTag:   $('#nextStationTag'),
        stationCard:      $('#stationCard'),
        chips:            $$('.station-chip'),
        toggleBtn:        $('#toggleStageBtn'),
        storeSel:         $('#storeSelect'),
        usdIn:            $('#usdInput'),
        rateIn:           $('#rateInput'),
        rateNote:         $('#rateSourceNote'),
        linkIn:           $('#linkInput'),
        validationNote:   $('#validationNote'),
        vipSwitch:        $('.vip-switch'),
        firstTen:         $('#firstTenToggle'),
        commBadge:        $('#commissionBadge'),
        copyBtn:          $('#copyBtn'),
        directContactBtn: $('#directContactBtn'),
        directPageLink:   $('#directPageLink'),
        toast:            $('#copyToast'),
        faqTriggers:      $$('.faq-trigger')
      };
    },

    async loadDailyRate() {
      try {
        const res = await fetch(`${CFG.rateFile}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('rate.json not found');
        const data = await res.json();
        const rawRate = data.rate ?? data.usd ?? data.price ?? data.usd_to_dzd;
        const parsed = clampNumber(rawRate, CFG.minRate, CFG.maxRate, null);
        if (parsed !== null && this.el.rateIn) {
          this.el.rateIn.value = String(parsed);
          State.inputs.rate = parsed;
          if (this.el.rateNote) {
            const dateStr = data.updatedAt ? ` (${sanitizeText(String(data.updatedAt), 30)})` : '';
            this.el.rateNote.textContent = `تم التحديث من rate.json${dateStr}`;
          }
          this.renderCalc();
          return;
        }
      } catch (_) {}

      if (this.el.rateNote) {
        this.el.rateNote.textContent = `السعر الافتراضي: ${CFG.defaultRate} دج`;
      }
    },

    selectStation(idx) {
      const safeIdx = ((idx % STATIONS.length) + STATIONS.length) % STATIONS.length;
      const st = STATIONS[safeIdx];
      State.activeStation = safeIdx;
      State.parcelProgress = st.pos;

      this.el.chips.forEach((chip, i) => {
        const active = i === safeIdx;
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-selected', String(active));
      });

      setText('stationBadge', st.badge);
      setText('stationTitle', st.title);
      setText('stationDesc', st.desc);

      if (this.el.stationCard) {
        this.el.stationCard.classList.remove('flash');
        void this.el.stationCard.offsetWidth;
        this.el.stationCard.classList.add('flash');
      }
    },

    initStationControls() {
      this.el.chips.forEach(ch => {
        ch.addEventListener('click', () => {
          const idx = Number(ch.dataset.station);
          if (Number.isInteger(idx)) this.selectStation(idx);
        });
      });

      if (this.el.nextStationTag) {
        this.el.nextStationTag.addEventListener('click', () => {
          this.selectStation(State.activeStation + 1);
        });
      }

      this.selectStation(0);
    },

    initToggleAnim() {
      const btn = this.el.toggleBtn;
      if (!btn) return;
      btn.addEventListener('click', () => {
        State.animEnabled = !State.animEnabled;
        btn.textContent = State.animEnabled ? 'إيقاف الحركة' : 'تشغيل الحركة';
        btn.setAttribute('aria-pressed', String(State.animEnabled));
      });
    },

    initCalculator() {
      const { form, storeSel, usdIn, rateIn, linkIn, firstTen } = this.el;
      if (form) form.addEventListener('submit', e => e.preventDefault());

      const syncAndRender = () => {
        const chosenStore = CFG.allowedStores.has(storeSel?.value) ? storeSel.value : 'AliExpress';
        const usd = usdIn && usdIn.value === '' ? 0 : clampNumber(usdIn?.value, 0, CFG.maxUsd, CFG.defaultUsd);
        const rate = clampNumber(rateIn?.value, CFG.minRate, CFG.maxRate, CFG.defaultRate);
        const urlCheck = validateProductUrl(linkIn?.value || '');
        const isFirstTen = Boolean(firstTen?.checked);

        State.inputs.store = chosenStore;
        State.inputs.usd = usd;
        State.inputs.rate = rate;
        State.inputs.link = urlCheck.value;
        State.inputs.linkValid = urlCheck.ok;
        State.inputs.firstTen = isFirstTen;

        if (linkIn) linkIn.classList.toggle('invalid', !urlCheck.ok && !urlCheck.empty);
        if (this.el.validationNote) this.el.validationNote.textContent = urlCheck.message;
        if (this.el.vipSwitch) this.el.vipSwitch.classList.toggle('active', isFirstTen);

        this.renderCalc();
      };

      [storeSel, usdIn, rateIn, linkIn, firstTen].forEach(el => {
        if (!el) return;
        el.addEventListener('input', syncAndRender);
        el.addEventListener('change', syncAndRender);
      });

      syncAndRender();
    },

    renderCalc() {
      const { usd, rate, firstTen } = State.inputs;
      const feeUsd = firstTen ? 0 : usd * CFG.feePercent;
      const productDzd = roundDZD(usd * rate);
      const feeDzd = firstTen ? 0 : roundDZD(feeUsd * rate);
      const totalDzd = productDzd + feeDzd;

      setText('productDzdOut', `${fmtDZD.format(productDzd)} دج`);
      setText('feeDzdOut', firstTen ? '0 دج (عرض 10)' : `${fmtDZD.format(feeDzd)} دج`);
      setText('totalDzdOut', `${fmtDZD.format(totalDzd)} دج`);

      const badge = this.el.commBadge;
      if (badge) {
        if (firstTen) {
          badge.textContent = '0% عمولة • عرض الافتتاح';
          badge.classList.add('free');
        } else {
          badge.textContent = 'عمولة 1$ / 10$';
          badge.classList.remove('free');
        }
      }
    },

    buildOrderSummary() {
      const { store, usd, rate, firstTen, link } = State.inputs;
      const feeUsd = firstTen ? 0 : usd * CFG.feePercent;
      const productDzd = roundDZD(usd * rate);
      const feeDzd = firstTen ? 0 : roundDZD(feeUsd * rate);
      const totalDzd = productDzd + feeDzd;
      const safeUrl = link || '(سأرسل الرابط هنا)';

      return [
        'طلب جديد عبر Commandili DZ (كومنديلي) 🇩🇿',
        `• المنصة: ${store}`,
        `• الرابط: ${safeUrl}`,
        `• سعر المنتج: ${usd.toFixed(2)}$`,
        `• النظام: ${firstTen ? 'عرض أول 10 زبائن (بدون عمولة 0%)' : 'عمولة 1$ لكل 10$'}`,
        `• الإجمالي التقريبي عبر BaridiMob: ${fmtDZD.format(totalDzd)} دج`,
        '• الاستلام: مكتب البريد (متابعة TrackIt)'
      ].join('\n');
    },

    async copyOrderText(txt) {
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(txt);
          copied = true;
        }
      } catch (_) {}

      if (!copied) {
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
        ta.remove();
      }
      return copied;
    },

    initCopy() {
      const { copyBtn, directContactBtn, directPageLink, toast } = this.el;
      if (!copyBtn || !toast) return;

      copyBtn.addEventListener('click', async () => {
        if (!State.inputs.linkValid) {
          this.showToast(toast, 'تحقق من صيغة الرابط أولاً قبل النسخ', true);
          this.el.linkIn?.focus();
          return;
        }
        const copied = await this.copyOrderText(this.buildOrderSummary());
        this.showToast(
          toast,
          copied ? 'تم نسخ تفاصيل الطلب بنجاح — الصقها في رسائل الصفحة' : 'تعذر النسخ تلقائياً؛ يرجى النسخ يدوياً',
          !copied
        );
      });

      if (directContactBtn && directPageLink) {
        directContactBtn.addEventListener('click', async () => {
          if (!State.inputs.linkValid) {
            this.showToast(toast, 'تحقق من صيغة الرابط أولاً قبل الانتقال', true);
            this.el.linkIn?.focus();
            return;
          }
          const copied = await this.copyOrderText(this.buildOrderSummary());
          this.showToast(
            toast,
            copied ? 'تم نسخ بطاقة الطلب — جاري فتح صفحة Commandili DZ' : 'جاري فتح الصفحة — انسخ تفاصيل طلبك وأرسلها في الخاص',
            !copied
          );
          window.open(directPageLink.href, '_blank', 'noopener,noreferrer');
        });
      }
    },

    initFaq() {
      this.el.faqTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
          const item = trigger.closest('.faq-item');
          if (!item) return;
          const willOpen = !item.classList.contains('open');
          item.classList.toggle('open', willOpen);
          trigger.setAttribute('aria-expanded', String(willOpen));
        });
      });
    },

    showToast(el, message, isWarn) {
      if (!el) return;
      el.textContent = message;
      el.classList.toggle('warn', Boolean(isWarn));
      el.classList.add('show');
      clearTimeout(el._timer);
      el._timer = setTimeout(() => el.classList.remove('show'), 3800);
    },

    initAll() {
      this.cache();
      this.initStationControls();
      this.initToggleAnim();
      this.initCalculator();
      this.initCopy();
      this.initFaq();
      this.loadDailyRate();
    }
  };

  function init() {
    initIntro();
    UI.initAll();
    Canvas.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
