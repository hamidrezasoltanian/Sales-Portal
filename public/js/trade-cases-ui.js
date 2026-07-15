'use strict';
/* پرونده بازرگانی — UI جزئیات، مراحل، قالب، گزارش (فاز ۳–۶ ادغام EZ) */
(function() {

  var _tkcActiveCase = null;
  var _tkcActiveTpl = null;
  var _tkcActiveActivities = null;
  var _tkcStepIdx = 0;
  var _tkcWmsProducts = null;

  function _x() { return window._tkExpose || {}; }

  function _api(method, root, path, body) {
    var fn = _x().tradeAPI;
    if (fn) return fn(method, root, path, body);
    var opts = { method: method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
    if (body) opts.body = JSON.stringify(body);
    return fetch('/api/' + root + path, opts).then(function(r) {
      if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || r.status); });
      return r.json();
    });
  }

  function _inp(w) { return (_x().inputStyle || function(){ return ''; })(w); }
  function _btn() { return _x().btnStyle || ''; }
  function _ta() { return _x().textareaStyle || ''; }
  function _date(id, val) {
    if (_x().dateInput) return _x().dateInput(id, val, '100%');
    return '<input id="' + id + '" type="text" value="' + (typeof esc === 'function' ? esc(val || '') : val || '') + '" readonly style="' + _inp('100%') + 'cursor:pointer" onclick="if(typeof openJDP===\'function\')openJDP(this,function(v){this.value=v})">';
  }

  function _fieldKey(field) {
    return field.name || ('field_' + field.id);
  }

  function _stepData(caseObj, step) {
    var sd = caseObj.stepsData || {};
    if (sd[step.id]) return sd[step.id];
    return { data: {}, completed_at: null };
  }

  function _renderField(field, value, readOnly, prefix) {
    var key = _fieldKey(field);
    var id = prefix + '_' + key;
    var lab = '<label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">' + (typeof esc === 'function' ? esc(field.label || key) : field.label) + (field.required ? ' *' : '') + '</label>';
    var v = value != null ? value : '';
    if (readOnly) {
      return '<div style="margin-bottom:8px">' + lab + '<div style="font-size:.85rem;padding:6px 0">' + (typeof esc === 'function' ? esc(String(v)) : v) + '</div></div>';
    }
    if (field.type === 'date') {
      return '<div style="margin-bottom:8px">' + lab + _date(id, v) + '</div>';
    }
    if (field.type === 'textarea') {
      return '<div style="margin-bottom:8px">' + lab + '<textarea id="' + id + '" rows="2" style="' + _ta() + '">' + (typeof esc === 'function' ? esc(String(v)) : v) + '</textarea></div>';
    }
    if (field.type === 'number') {
      return '<div style="margin-bottom:8px">' + lab + '<input id="' + id + '" type="number" value="' + v + '" style="' + _inp('100%') + '"></div>';
    }
    if (field.type === 'checkbox') {
      var checked = v === true || v === 'true' || v === '1' || v === 1;
      return '<div style="margin-bottom:8px">' + lab +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.85rem">' +
        '<input id="' + id + '" type="checkbox"' + (checked ? ' checked' : '') + (readOnly ? ' disabled' : '') + '> بله</label></div>';
    }
    if (field.type === 'select' && field.options && field.options.length) {
      var opts = field.options.map(function(o) {
        return '<option value="' + (typeof esc === 'function' ? esc(o) : o) + '"' + (String(v) === String(o) ? ' selected' : '') + '>' + (typeof esc === 'function' ? esc(o) : o) + '</option>';
      }).join('');
      return '<div style="margin-bottom:8px">' + lab + '<select id="' + id + '" style="' + _inp('100%') + '">' + opts + '</select></div>';
    }
    if (field.type === 'product') {
      return '<div style="margin-bottom:8px">' + lab +
        '<input id="' + id + '" list="tkc_prod_list" value="' + (typeof esc === 'function' ? esc(String(v)) : v) + '" placeholder="جستجوی کالا WMS..." style="' + _inp('100%') + '"></div>';
    }
    return '<div style="margin-bottom:8px">' + lab + '<input id="' + id + '" type="text" value="' + (typeof esc === 'function' ? esc(String(v)) : v) + '" style="' + _inp('100%') + '"></div>';
  }

  function _collectStepFields(step, prefix) {
    var data = {};
    (step.fields || []).forEach(function(f) {
      var el = document.getElementById(prefix + '_' + _fieldKey(f));
      if (!el) return;
      if (f.type === 'checkbox') data[_fieldKey(f)] = !!el.checked;
      else data[_fieldKey(f)] = el.value;
    });
    return data;
  }

  window._tkOpenCase = function(caseId) {
    _api('GET', 'trade-cases', '/' + caseId + '/full').then(function(res) {
      _tkcActiveCase = res.case;
      _tkcActiveTpl = res.template;
      _tkcActiveActivities = res.activities || [];
      _tkcStepIdx = 0;
      _tkRenderCaseModal();
      if (!_tkcWmsProducts) {
        fetch('/api/wms/products', { credentials: 'same-origin' }).then(function(r) { return r.ok ? r.json() : []; })
          .then(function(list) { _tkcWmsProducts = list || []; })
          .catch(function() { _tkcWmsProducts = []; });
      }
    }).catch(function(e) {
      if (typeof showToast === 'function') showToast('خطا: ' + e.message);
    });
  };

  function _tkRenderCaseModal() {
    var c = _tkcActiveCase;
    var tpl = _tkcActiveTpl;
    if (!c) return;
    var steps = (tpl && tpl.steps) ? tpl.steps.slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); }) : [];
    var readOnly = !!c.isFinalized;
    var step = steps[_tkcStepIdx];
    var body = '';

    body += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
    steps.forEach(function(s, i) {
      var done = c.stepsData && c.stepsData[s.id] && c.stepsData[s.id].completed_at;
      body += '<button type="button" onclick="window._tkcGotoStep(' + i + ')" style="padding:4px 10px;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.75rem;background:' +
        (i === _tkcStepIdx ? '#6366f1' : '#fff') + ';color:' + (i === _tkcStepIdx ? '#fff' : '#374151') + '">' +
        (done ? '✅ ' : '') + (typeof esc === 'function' ? esc(s.title) : s.title) + '</button>';
    });
    body += '</div>';

    if (step) {
      var st = _stepData(c, step);
      body += '<h4 style="margin:0 0 12px;font-size:.95rem">' + (typeof esc === 'function' ? esc(step.title) : step.title) + '</h4>';
      body += '<div id="tkcStepFields">';
      (step.fields || []).forEach(function(f) {
        body += _renderField(f, (st.data || {})[_fieldKey(f)], readOnly, 'tkc_f');
      });
      if (!(step.fields && step.fields.length)) {
        body += '<p style="color:#9ca3af;font-size:.85rem">فیلدی برای این مرحله تعریف نشده</p>';
      }
      body += '</div>';
      if (!readOnly) {
        body += '<label style="display:flex;align-items:center;gap:6px;margin-top:12px;font-size:.85rem;cursor:pointer">' +
          '<input type="checkbox" id="tkc_step_done"' + (st.completed_at ? ' checked' : '') + '> مرحله تکمیل شد</label>';
      }
    } else {
      body += '<p style="color:#9ca3af">مرحله‌ای وجود ندارد</p>';
    }

    if (c.proformaId) {
      body += '<div style="margin-top:12px">' +
        '<button type="button" onclick="window._tkcOpenProforma(\'' + c.proformaId + '\')" style="padding:6px 12px;background:#eef2ff;color:#6366f1;border:1px solid #c7d2fe;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.8rem">📄 مشاهده پیش‌فاکتور</button></div>';
    }

    var acts = _tkcActiveActivities || [];
    if (acts.length) {
      body += '<div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:10px;max-height:140px;overflow-y:auto">' +
        '<div style="font-size:.78rem;font-weight:600;color:#64748b;margin-bottom:6px">📜 تاریخچه فعالیت</div>';
      acts.slice(0, 12).forEach(function(a) {
        var when = a.at ? String(a.at).slice(0, 16).replace('T', ' ') : '';
        body += '<div style="font-size:.75rem;color:#6b7280;padding:4px 0;border-bottom:1px solid #f8fafc">' +
          '<span style="color:#94a3b8">' + when + '</span> · ' +
          _tkTplEsc(a.details || a.action || '') +
          (a.userId ? ' <span style="color:#cbd5e1">(' + _tkTplEsc(a.userId) + ')</span>' : '') +
          '</div>';
      });
      body += '</div>';
    }

    var footer = '';
    if (!readOnly) {
      footer += '<button onclick="window._tkcSaveStep()" style="' + _btn() + '">ذخیره مرحله</button>';
      if (!c.proformaId && typeof switchTab === 'function') {
        footer += '<button onclick="window._tkcLinkProforma()" style="margin-right:8px;padding:7px 14px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem">📄 پیش‌فاکتور</button>';
      }
      footer += '<button onclick="window._tkFinalizeCase(\'' + c.id + '\');closeModal(\'tkCaseModal\')" style="margin-right:8px;padding:7px 14px;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem">نهایی پرونده</button>';
    }

    if (typeof openModal === 'function') {
      openModal('tkCaseModal', (typeof esc === 'function' ? esc(c.title) : c.title), body, footer, { lg: true });
      if (_tkcWmsProducts && _tkcWmsProducts.length) {
        var dl = document.getElementById('tkc_prod_list');
        if (!dl) {
          dl = document.createElement('datalist');
          dl.id = 'tkc_prod_list';
          document.body.appendChild(dl);
        }
        dl.innerHTML = _tkcWmsProducts.map(function(p) {
          var label = (p.name || p.id) + (p.catalog_code ? ' (' + p.catalog_code + ')' : '');
          return '<option value="' + (typeof esc === 'function' ? esc(label) : label) + '">';
        }).join('');
      }
    }
  }

  window._tkcGotoStep = function(i) {
    _tkcStepIdx = i;
    _tkRenderCaseModal();
  };

  window._tkcSaveStep = function() {
    var c = _tkcActiveCase;
    var tpl = _tkcActiveTpl;
    if (!c || !tpl || !tpl.steps || !tpl.steps[_tkcStepIdx]) return;
    var step = tpl.steps.slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); })[_tkcStepIdx];
    var data = _collectStepFields(step, 'tkc_f');
    var doneEl = document.getElementById('tkc_step_done');
    var completed_at = doneEl && doneEl.checked ? (typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10)) : null;

    _api('POST', 'trade-cases', '/' + c.id + '/steps', { stepId: step.id, data: data, completed_at: completed_at })
      .then(function(updated) {
        _tkcActiveCase = updated;
        if (updated.kpiSync && updated.kpiSync.synced && typeof showToast === 'function') {
          showToast('✅ مرحله ذخیره شد · KPI: ' + updated.kpiSync.indicator);
        } else if (typeof showToast === 'function') showToast('✅ مرحله ذخیره شد');
        if (typeof window._tkLoadAndRender === 'function') window._tkLoadAndRender();
        _tkRenderCaseModal();
      })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkcLinkProforma = function() {
    if (!_tkcActiveCase) return;
    window.__pfPendingTradeCaseId = _tkcActiveCase.id;
    if (typeof openProformaForCenter === 'function') {
      openProformaForCenter(_tkcActiveCase.centerKey || '', _tkcActiveCase.title, 'new');
    } else if (typeof switchTab === 'function') {
      switchTab('proforma');
    }
    if (typeof closeModal === 'function') closeModal('tkCaseModal');
  };

  window._tkcOpenProforma = function(pfId) {
    if (!pfId) return;
    function _open() {
      if (typeof switchTab === 'function') switchTab('proforma');
      if (typeof pfOpenEdit === 'function') pfOpenEdit(pfId);
    }
    if (typeof ensureTabScripts === 'function') {
      ensureTabScripts('proforma').then(_open).catch(_open);
    } else {
      _open();
    }
    if (typeof closeModal === 'function') closeModal('tkCaseModal');
  };

  // ── Visual template builder (مدیر — بدون JSON) ───────────────────────────
  var _TK_FIELD_TYPES = [
    { v: 'text', l: 'متن' },
    { v: 'number', l: 'عدد' },
    { v: 'date', l: 'تاریخ' },
    { v: 'textarea', l: 'متن بلند' },
    { v: 'checkbox', l: 'چک‌باکس' },
    { v: 'select', l: 'انتخابی' },
    { v: 'product', l: 'کالا (WMS)' }
  ];

  function _tkTplUid(prefix) {
    return (prefix || 'tk') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }

  function _tkTplEsc(s) {
    return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s);
  }

  function _tkTplCloneSteps(steps) {
    try { return JSON.parse(JSON.stringify(steps || [])); } catch (e) { return []; }
  }

  function _tkTplSlug(label, id) {
    var raw = String(label || '').trim();
    if (!raw) return 'field_' + String(id || '').slice(-6);
    var norm = typeof fNorm === 'function' ? fNorm(raw) : raw;
    var slug = norm.replace(/\s+/g, '_').replace(/[^\w\u0600-\u06FF]/g, '').slice(0, 40);
    return slug || ('field_' + String(id || '').slice(-6));
  }

  function _tkTplKpiHint(title) {
    var t = String(title || '');
    if (/ترخیص|گمرک/i.test(t)) return '📦 KPI ترخیص';
    if (/تامین|سورس/i.test(t)) return '🔍 KPI تامین‌کننده';
    if (/مالی|هزینه/i.test(t)) return '💰 KPI مالی';
    if (/گزارش|روزانه/i.test(t)) return '📋 KPI گزارش روزانه';
    return '';
  }

  function _tkTplSortedSteps(draft) {
    return (draft.steps || []).slice().sort(function(a, b) {
      return (a.order != null ? a.order : 0) - (b.order != null ? b.order : 0);
    });
  }

  function _tkTplActiveStep(draft) {
    var steps = _tkTplSortedSteps(draft);
    var idx = draft.activeStep || 0;
    if (idx >= steps.length) idx = Math.max(0, steps.length - 1);
    draft.activeStep = idx;
    return { steps: steps, step: steps[idx] || null, idx: idx };
  }

  function _tkTplNormalizeSteps(steps) {
    return (steps || []).map(function(s, i) {
      var fields = (s.fields || []).map(function(f) {
        var opts = f.options;
        if (typeof opts === 'string') {
          opts = opts.split(',').map(function(x) { return x.trim(); }).filter(Boolean);
        }
        return {
          id: f.id || _tkTplUid('fld'),
          name: f.name || _tkTplSlug(f.label, f.id),
          label: f.label || f.name || 'فیلد',
          type: f.type || 'text',
          required: !!f.required,
          width: f.width === 'full' ? 'full' : 'half',
          options: Array.isArray(opts) ? opts : []
        };
      });
      return {
        id: s.id || _tkTplUid('step'),
        title: s.title || ('مرحله ' + (i + 1)),
        order: i,
        fields: fields
      };
    });
  }

  function _tkTplBuilderBody() {
    var d = window._tkTplDraft;
    if (!d) return '';
    var act = _tkTplActiveStep(d);
    var steps = act.steps;
    var step = act.step;
    var si = act.idx;

    var html = '<div style="font-size:.78rem;color:#6b7280;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:12px">' +
      '💡 عنوان مرحله با کلمات <b>ترخیص</b>، <b>تامین</b>، <b>مالی</b> یا <b>گزارش</b> → همگام‌سازی خودکار با KPI هنگام تکمیل پرونده</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">' +
      '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">نام فرآیند *</label>' +
      '<input id="tkt_name" value="' + _tkTplEsc(d.name || '') + '" oninput="window._tkTplPatchMeta(\'name\',this.value)" style="' + _inp('100%') + '"></div>' +
      '<div><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">دسته‌بندی</label>' +
      '<input id="tkt_category" value="' + _tkTplEsc(d.category || '') + '" oninput="window._tkTplPatchMeta(\'category\',this.value)" placeholder="مثلاً: واردات" style="' + _inp('100%') + '"></div></div>';
    html += '<div style="margin-bottom:14px"><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">توضیحات</label>' +
      '<textarea id="tkt_desc" rows="2" oninput="window._tkTplPatchMeta(\'description\',this.value)" style="' + _ta() + '">' + _tkTplEsc(d.description || '') + '</textarea></div>';

    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center">';
    steps.forEach(function(s, i) {
      var hint = _tkTplKpiHint(s.title);
      html += '<button type="button" onclick="window._tkTplSetStep(' + i + ')" style="padding:5px 10px;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.75rem;background:' +
        (i === si ? '#6366f1' : '#fff') + ';color:' + (i === si ? '#fff' : '#374151') + '">' +
        _tkTplEsc(s.title || ('مرحله ' + (i + 1))) + (hint ? ' <span style="opacity:.85">·</span> ' + hint : '') + '</button>';
    });
    html += '<button type="button" onclick="window._tkTplAddStep()" style="padding:5px 10px;border:1px dashed #c7d2fe;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.75rem;background:#eef2ff;color:#6366f1">+ مرحله</button>';
    html += '</div>';

    if (step) {
      var kpi = _tkTplKpiHint(step.title);
      html += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px">';
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">' +
        '<div style="flex:1;min-width:180px"><label style="font-size:.75rem;color:#6b7280;display:block;margin-bottom:3px">عنوان مرحله</label>' +
        '<input value="' + _tkTplEsc(step.title || '') + '" oninput="window._tkTplPatchStep(\'' + step.id + '\',this.value)" style="' + _inp('100%') + '"></div>' +
        '<button type="button" onclick="window._tkTplMoveStep(-1)" style="padding:6px 10px;background:#f1f5f9;border:none;border-radius:6px;cursor:pointer;font-family:inherit" title="بالا">↑</button>' +
        '<button type="button" onclick="window._tkTplMoveStep(1)" style="padding:6px 10px;background:#f1f5f9;border:none;border-radius:6px;cursor:pointer;font-family:inherit" title="پایین">↓</button>' +
        (steps.length > 1 ? '<button type="button" onclick="window._tkTplDelStep()" style="padding:6px 10px;background:#fee2e2;color:#b91c1c;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.78rem">حذف مرحله</button>' : '') +
        '</div>';
      if (kpi) {
        html += '<div style="font-size:.75rem;color:#6366f1;margin-bottom:10px">' + kpi + '</div>';
      }

      if (!step.fields || !step.fields.length) {
        html += '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:.85rem;border:1px dashed #e2e8f0;border-radius:8px;margin-bottom:10px">هنوز فیلدی اضافه نشده</div>';
      } else {
        html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">';
        step.fields.forEach(function(f, fi) {
          var typeOpts = _TK_FIELD_TYPES.map(function(t) {
            return '<option value="' + t.v + '"' + (f.type === t.v ? ' selected' : '') + '>' + t.l + '</option>';
          }).join('');
          html += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px">' +
            '<div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:end">' +
            '<div><label style="font-size:.7rem;color:#6b7280;display:block;margin-bottom:2px">عنوان فیلد</label>' +
            '<input value="' + _tkTplEsc(f.label || '') + '" oninput="window._tkTplPatchField(\'label\',\'' + step.id + '\',\'' + f.id + '\',this.value)" style="' + _inp('100%') + 'font-size:.82rem"></div>' +
            '<div><label style="font-size:.7rem;color:#6b7280;display:block;margin-bottom:2px">نوع</label>' +
            '<select onchange="window._tkTplPatchField(\'type\',\'' + step.id + '\',\'' + f.id + '\',this.value)" style="' + _inp('100%') + 'font-size:.82rem">' + typeOpts + '</select></div>' +
            '<div><label style="font-size:.7rem;color:#6b7280;display:block;margin-bottom:2px">عرض</label>' +
            '<select onchange="window._tkTplPatchField(\'width\',\'' + step.id + '\',\'' + f.id + '\',this.value)" style="' + _inp('100%') + 'font-size:.82rem">' +
            '<option value="half"' + (f.width !== 'full' ? ' selected' : '') + '>نیم</option>' +
            '<option value="full"' + (f.width === 'full' ? ' selected' : '') + '>تمام</option></select></div>' +
            '<button type="button" onclick="window._tkTplDelField(\'' + f.id + '\')" style="padding:6px 8px;background:transparent;border:none;color:#ef4444;cursor:pointer;font-family:inherit;font-size:.78rem">حذف</button>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap">' +
            '<label style="display:flex;align-items:center;gap:4px;font-size:.78rem;cursor:pointer">' +
            '<input type="checkbox"' + (f.required ? ' checked' : '') + ' onchange="window._tkTplPatchField(\'required\',\'' + step.id + '\',\'' + f.id + '\',this.checked)"> الزامی</label>' +
            '<span style="font-size:.7rem;color:#9ca3af">کلید: ' + _tkTplEsc(f.name || '') + '</span>' +
            '</div>';
          if (f.type === 'select') {
            var optStr = (f.options || []).join(', ');
            html += '<div style="margin-top:8px"><input value="' + _tkTplEsc(optStr) + '" placeholder="گزینه‌ها با کاما: گزینه۱, گزینه۲" oninput="window._tkTplPatchField(\'options\',\'' + step.id + '\',\'' + f.id + '\',this.value)" style="' + _inp('100%') + 'font-size:.82rem"></div>';
          }
          html += '</div>';
        });
        html += '</div>';
      }
      html += '<button type="button" onclick="window._tkTplAddField()" style="padding:6px 12px;background:#eef2ff;color:#6366f1;border:1px dashed #c7d2fe;border-radius:6px;cursor:pointer;font-family:inherit;font-size:.8rem">+ افزودن فیلد</button>';
      html += '</div>';
    }

    return html;
  }

  function _tkTplRefreshModal() {
    var mo = document.getElementById('mo_tkTplModal');
    if (!mo) return;
    var body = mo.querySelector('.m-body');
    var foot = mo.querySelector('.m-foot');
    if (body) body.innerHTML = _tkTplBuilderBody();
    if (foot) {
      foot.innerHTML = '<button onclick="window._tkTplSave()" style="' + _btn() + '">ذخیره فرآیند</button>' +
        '<button onclick="closeModal(\'tkTplModal\')" style="margin-right:8px;padding:7px 14px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem">انصراف</button>';
    }
  }

  function _tkTplOpenBuilder(tpl) {
    window._tkTplDraft = {
      id: tpl && tpl.id ? tpl.id : null,
      name: (tpl && tpl.name) || '',
      description: (tpl && tpl.description) || '',
      category: (tpl && tpl.category) || '',
      steps: _tkTplNormalizeSteps(_tkTplCloneSteps(tpl && tpl.steps ? tpl.steps : [
        { id: _tkTplUid('step'), title: 'مرحله ۱', order: 0, fields: [] }
      ])),
      activeStep: 0
    };
    var title = tpl && tpl.id ? ('طراحی: ' + (tpl.name || '')) : 'فرآیند جدید';
    if (typeof openModal === 'function') {
      openModal('tkTplModal', title, _tkTplBuilderBody(),
        '<button onclick="window._tkTplSave()" style="' + _btn() + '">ذخیره فرآیند</button>' +
        '<button onclick="closeModal(\'tkTplModal\')" style="margin-right:8px;padding:7px 14px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.85rem">انصراف</button>',
        { lg: true });
    }
  }

  window._tkTplPatchMeta = function(key, val) {
    var d = window._tkTplDraft;
    if (!d) return;
    d[key] = val;
  };

  window._tkTplPatchStep = function(stepId, title) {
    var d = window._tkTplDraft;
    if (!d) return;
    var step = (d.steps || []).find(function(s) { return s.id === stepId; });
    if (step) step.title = title;
  };

  window._tkTplPatchField = function(key, stepId, fieldId, val) {
    var d = window._tkTplDraft;
    if (!d) return;
    var step = (d.steps || []).find(function(s) { return s.id === stepId; });
    if (!step) return;
    var field = (step.fields || []).find(function(f) { return f.id === fieldId; });
    if (!field) return;
    if (key === 'required') field.required = !!val;
    else if (key === 'options') {
      field.options = String(val).split(',').map(function(x) { return x.trim(); }).filter(Boolean);
    } else {
      field[key] = val;
      if (key === 'label') field.name = _tkTplSlug(val, field.id);
    }
    if (key === 'type') _tkTplRefreshModal();
  };

  window._tkTplSetStep = function(idx) {
    var d = window._tkTplDraft;
    if (!d) return;
    d.activeStep = idx;
    _tkTplRefreshModal();
  };

  window._tkTplAddStep = function() {
    var d = window._tkTplDraft;
    if (!d) return;
    var n = (d.steps || []).length + 1;
    d.steps.push({ id: _tkTplUid('step'), title: 'مرحله ' + n, order: n - 1, fields: [] });
    d.activeStep = d.steps.length - 1;
    _tkTplRefreshModal();
  };

  window._tkTplDelStep = function() {
    var d = window._tkTplDraft;
    if (!d || !d.steps || d.steps.length <= 1) return;
    if (!confirm('این مرحله حذف شود؟')) return;
    var act = _tkTplActiveStep(d);
    d.steps = act.steps.filter(function(_, i) { return i !== act.idx; });
    d.activeStep = Math.min(act.idx, d.steps.length - 1);
    _tkTplRefreshModal();
  };

  window._tkTplMoveStep = function(dir) {
    var d = window._tkTplDraft;
    if (!d) return;
    var act = _tkTplActiveStep(d);
    var steps = act.steps;
    var idx = act.idx;
    var ni = idx + dir;
    if (ni < 0 || ni >= steps.length) return;
    var tmp = steps[idx];
    steps[idx] = steps[ni];
    steps[ni] = tmp;
    d.steps = steps;
    d.activeStep = ni;
    _tkTplRefreshModal();
  };

  window._tkTplAddField = function() {
    var d = window._tkTplDraft;
    if (!d) return;
    var act = _tkTplActiveStep(d);
    if (!act.step) return;
    var fid = _tkTplUid('fld');
    act.step.fields = act.step.fields || [];
    act.step.fields.push({
      id: fid,
      name: 'field_' + fid.slice(-6),
      label: 'فیلد جدید',
      type: 'text',
      required: false,
      width: 'half',
      options: []
    });
    _tkTplRefreshModal();
  };

  window._tkTplDelField = function(fieldId) {
    var d = window._tkTplDraft;
    if (!d) return;
    var act = _tkTplActiveStep(d);
    if (!act.step) return;
    act.step.fields = (act.step.fields || []).filter(function(f) { return f.id !== fieldId; });
    _tkTplRefreshModal();
  };

  window._tkTplSave = function() {
    var d = window._tkTplDraft;
    if (!d) return;
    var nameEl = document.getElementById('tkt_name');
    if (nameEl) d.name = nameEl.value.trim();
    if (!d.name) {
      if (typeof showToast === 'function') showToast('نام فرآیند الزامی است');
      return;
    }
    var steps = _tkTplNormalizeSteps(d.steps);
    if (!steps.length) {
      if (typeof showToast === 'function') showToast('حداقل یک مرحله لازم است');
      return;
    }
    var payload = {
      name: d.name,
      description: d.description || '',
      category: d.category || '',
      steps: steps
    };
    var req = d.id
      ? _api('PUT', 'trade-templates', '/' + d.id, payload)
      : _api('POST', 'trade-templates', '/', payload);
    req.then(function() {
      if (typeof showToast === 'function') showToast('✅ فرآیند ذخیره شد');
      if (typeof closeModal === 'function') closeModal('tkTplModal');
      window._tkTplDraft = null;
      if (typeof window._tkLoadAndRender === 'function') window._tkLoadAndRender();
    }).catch(function(e) {
      if (typeof showToast === 'function') showToast('خطا: ' + e.message);
    });
  };

  window._tkTplNew = function() {
    _tkTplOpenBuilder(null);
  };

  window._tkTplDeactivate = function(tplId) {
    if (!confirm('این فرآیند غیرفعال شود؟ پرونده‌های موجود حفظ می‌شوند.')) return;
    _api('DELETE', 'trade-templates', '/' + tplId)
      .then(function() {
        if (typeof showToast === 'function') showToast('فرآیند غیرفعال شد');
        if (typeof window._tkLoadAndRender === 'function') window._tkLoadAndRender();
      })
      .catch(function(e) { if (typeof showToast === 'function') showToast('خطا: ' + e.message); });
  };

  window._tkRenderTemplates = function(cont) {
    if (!(_x().isManager && _x().isManager())) {
      cont.innerHTML = '<div style="padding:40px;text-align:center;color:#9ca3af">فقط مدیر</div>';
      return;
    }
    _api('GET', 'trade-templates', '/').then(function(res) {
      var tpls = (res && res.templates) || [];
      var html = '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">' +
        '<div><h4 style="margin:0;font-size:.95rem">فرآیندهای بازرگانی</h4>' +
        '<p style="margin:4px 0 0;font-size:.78rem;color:#6b7280">طراحی مراحل و فیلدها — بدون کدنویسی</p></div>' +
        '<button onclick="window._tkTplNew()" style="' + _btn() + '">+ فرآیند جدید</button></div>';

      if (!tpls.length) {
        html += '<div style="text-align:center;padding:40px;color:#9ca3af;background:#f8fafc;border-radius:12px">' +
          'فرآیندی تعریف نشده — روی «فرآیند جدید» کلیک کنید</div>';
      } else {
        tpls.forEach(function(t) {
          var stepCount = (t.steps && t.steps.length) || 0;
          var fieldCount = 0;
          (t.steps || []).forEach(function(s) { fieldCount += (s.fields && s.fields.length) || 0; });
          html += '<div style="background:#fff;border-radius:10px;padding:14px;border:1px solid #e2e8f0;margin-bottom:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
            '<div style="flex:1;min-width:200px">' +
            '<div style="font-weight:600;font-size:.9rem">' + _tkTplEsc(t.name) + '</div>' +
            '<div style="font-size:.78rem;color:#6b7280;margin-top:4px">' + stepCount + ' مرحله · ' + fieldCount + ' فیلد · نسخه ' + (t.version || 1) +
            (t.category ? ' · ' + _tkTplEsc(t.category) : '') + '</div></div>' +
            '<button onclick="window._tkEditTemplate(\'' + t.id + '\')" style="padding:6px 14px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.8rem">⚙️ طراحی</button>' +
            '<button onclick="window._tkTplDeactivate(\'' + t.id + '\')" style="padding:6px 10px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.78rem;color:#6b7280">غیرفعال</button>' +
            '</div>';
        });
      }
      cont.innerHTML = html;
    });
  };

  window._tkEditTemplate = function(tplId) {
    _api('GET', 'trade-templates', '/' + tplId).then(function(tpl) {
      _tkTplOpenBuilder(tpl);
    }).catch(function(e) {
      if (typeof showToast === 'function') showToast('خطا: ' + e.message);
    });
  };

  window._tkCreateTemplate = function() {
    window._tkTplNew();
  };

  // ── Trade reports tab ─────────────────────────────────────────────────────
  window._tkRenderTradeReports = function(cont) {
    var emp = _x().employee ? encodeURIComponent(_x().employee()) : '';
    var mon = _x().month ? encodeURIComponent(_x().month()) : '';
    fetch('/api/trade-reports/summary?month=' + mon + '&assigned_to=' + emp, { credentials: 'same-origin' })
      .then(function(r) { return r.ok ? r.json() : r.json().then(function(e) { throw new Error(e.error); }); })
      .then(function(s) {
        return fetch('/api/trade-reports/cases-by-template?month=' + mon, { credentials: 'same-origin' })
          .then(function(r2) { return r2.ok ? r2.json() : { rows: [] }; })
          .then(function(byTpl) { return { summary: s, byTpl: byTpl }; });
      })
      .then(function(data) {
        var s = data.summary;
        var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:16px">';
        html += '<div style="background:#fff;padding:14px;border-radius:10px;border:1px solid #e2e8f0;text-align:center"><div style="font-size:1.4rem;font-weight:700">' + (s.cases.active || 0) + '</div><div style="font-size:.75rem;color:#6b7280">پرونده فعال</div></div>';
        html += '<div style="background:#fff;padding:14px;border-radius:10px;border:1px solid #e2e8f0;text-align:center"><div style="font-size:1.4rem;font-weight:700">' + (s.cases.finalized || 0) + '</div><div style="font-size:.75rem;color:#6b7280">نهایی‌شده</div></div>';
        html += '<div style="background:#fff;padding:14px;border-radius:10px;border:1px solid #e2e8f0;text-align:center"><div style="font-size:1.4rem;font-weight:700">' + s.clearances + '</div><div style="font-size:.75rem;color:#6b7280">ترخیص</div></div>';
        html += '<div style="background:#fff;padding:14px;border-radius:10px;border:1px solid #e2e8f0;text-align:center"><div style="font-size:1.4rem;font-weight:700">' + s.dailyReports + '</div><div style="font-size:.75rem;color:#6b7280">گزارش روزانه</div></div>';
        html += '<div style="background:#fff;padding:14px;border-radius:10px;border:1px solid #e2e8f0;text-align:center"><div style="font-size:1.4rem;font-weight:700">' + s.suppliers + '</div><div style="font-size:.75rem;color:#6b7280">تامین‌کننده</div></div>';
        if (s.kpiMonthly && s.kpiMonthly.final_score != null) {
          html += '<div style="background:#eef2ff;padding:14px;border-radius:10px;border:1px solid #c7d2fe;text-align:center"><div style="font-size:1.4rem;font-weight:700;color:#6366f1">' + s.kpiMonthly.final_score + '</div><div style="font-size:.75rem;color:#6b7280">نمره KPI</div></div>';
        }
        html += '</div>';
        var rows = (data.byTpl && data.byTpl.rows) || [];
        if (rows.length) {
          html += '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e2e8f0"><h4 style="margin:0 0 12px;font-size:.9rem">پرونده به تفکیک فرآیند</h4>';
          rows.forEach(function(r) {
            html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:.85rem">' +
              '<span>' + (typeof esc === 'function' ? esc(r.name) : r.name) + '</span>' +
              '<span style="color:#6b7280">' + (r.case_count || 0) + ' فعال · ' + (r.finalized_count || 0) + ' نهایی</span></div>';
          });
          html += '</div>';
        }
        cont.innerHTML = html;
      })
      .catch(function(e) {
        cont.innerHTML = '<div style="color:#ef4444;padding:20px">خطا: ' + (typeof esc === 'function' ? esc(e.message) : e.message) + '</div>';
      });
  };

})();
