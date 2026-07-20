<template>
  <div class="lt-panel animate-fade-in" dir="rtl">
    <!-- WORKFLOW QUICK NAV -->
    <div class="lt-stats-row">
      <div class="lt-stat-card border-action" :class="{ active: activeTab === 'pending' }" @click="selectTab('pending')">
        <div class="lt-stat-val text-action">{{ statPendingCount }}</div>
        <div class="lt-stat-lbl">⏳ کارتابل من</div>
        <div class="lt-stat-hint">نامه‌های نیازمند اقدام</div>
      </div>
      <div class="lt-stat-card border-followup" :class="{ active: activeTab === 'followup' }" @click="selectTab('followup')">
        <div class="lt-stat-val text-followup">{{ statFollowupCount }}</div>
        <div class="lt-stat-lbl">📨 پیگیری من</div>
        <div class="lt-stat-hint">ارجاع‌های باز برای شما</div>
      </div>
      <div class="lt-stat-card border-sign" :class="{ active: activeTab === 'sign_desk' }" @click="selectTab('sign_desk')">
        <div class="lt-stat-val text-sign">{{ statSignDeskCount }}</div>
        <div class="lt-stat-lbl">✍️ میز کار امضا</div>
        <div class="lt-stat-hint">منتظر امضای شما</div>
      </div>
      <div class="lt-stat-card border-drafts" :class="{ active: activeTab === 'drafts' }" @click="selectTab('drafts')">
        <div class="lt-stat-val text-drafts">{{ statDraftsCount }}</div>
        <div class="lt-stat-lbl">✏️ پیش‌نویس‌ها</div>
        <div class="lt-stat-hint">ثبت نشده</div>
      </div>
    </div>

    <!-- MAIN GRID CONTAINER -->
    <div class="lt-grid">
      <!-- LEFT COLUMN: SEARCH, TABS & LETTER LIST -->
      <div class="lt-list-col">
        <div class="lt-toolbar">
          <div class="lt-search-wrap">
            <input
              v-model="searchQuery"
              placeholder="جستجو در موضوع، شماره یا متن نامه..."
              class="lt-input search-inp"
              @input="load"
            />
            <span class="search-icon">🔍</span>
          </div>
          <div class="lt-toolbar-actions">
            <button class="lt-new-btn" @click="openNewModal" title="ثبت نامه جدید">
              <span class="lt-btn-icon">➕</span>
              <span class="lt-btn-text">ثبت نامه جدید</span>
            </button>
            <button v-if="isManager" class="lt-pin-btn" title="ویرایش قالب چاپ نامه" @click="openPrintTplModal">
              <span class="lt-btn-icon">🖨</span>
              <span class="lt-btn-text">قالب چاپ</span>
            </button>
            <button v-if="isSuperAdmin" class="lt-pin-btn" title="تنظیم شماره شروع نامه" @click="openIndicatorModal">
              <span class="lt-btn-icon">🔢</span>
              <span class="lt-btn-text">شماره نامه</span>
            </button>
            <button class="lt-pin-btn" title="تغییر پین‌کد امضا" @click="showPinModal = true">
              <span class="lt-btn-icon">⚙️</span>
              <span class="lt-btn-text">پین امضا</span>
            </button>
          </div>
        </div>

        <div class="lt-nav-groups">
          <div class="lt-nav-group">
            <span class="lt-nav-group-label">نمایش بر اساس نوع</span>
            <div class="lt-nav-chips">
              <button
                v-for="t in VIEW_TABS"
                :key="t.key"
                :class="['lt-chip-btn', { active: activeTab === t.key }]"
                @click="selectTab(t.key)"
              >
                {{ t.label }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'followup'" class="lt-tab-help">
          <strong>چطور تکمیل کنم؟</strong>
          <ol class="lt-help-steps">
            <li>نامه را از لیست باز کنید</li>
            <li>نتیجه اقدام را در کادر بنویسید</li>
            <li>دکمه «خاتمه ارجاع» را بزنید</li>
          </ol>
        </div>
        <div v-else-if="activeTab === 'pending'" class="lt-tab-help">
          ⏳ کارتابل کلی — نامه‌هایی که منتظر ثبت، امضا، یا ارجاع هستند.
        </div>

        <div v-if="loading" class="lt-loading-spinner">
          <div class="spinner"></div>
          <span>در حال بارگذاری نامه‌ها...</span>
        </div>

        <div v-else-if="filteredLetters.length === 0" class="lt-empty-state">
          <span v-if="activeTab === 'followup'">📭 ارجاع پیگیری باز برای شما نیست</span>
          <span v-else>📭 نامه‌ای یافت نشد</span>
        </div>

        <div v-else class="lt-list-container">
          <div
            v-for="l in filteredLetters"
            :key="l.id"
            :class="['lt-item-card', { active: selectedLetter?.id === l.id }]"
            @click="selectLetter(l)"
          >
            <div class="lt-card-header">
              <span class="lt-indicator">{{ l.indicator_number || 'پیش‌نویس / صادر نشده' }}</span>
              <span :class="['lt-badge-type', l.type]">{{ typeLabel(l.type) }}</span>
            </div>
            <div class="lt-card-subject">{{ l.subject }}</div>
            <div class="lt-card-meta-row">
              <span class="wf-stage-badge" :class="workflowStageKey(l)">{{ workflowStageLabel(l) }}</span>
              <span v-if="myOpenReferralCount(l) > 0" class="lt-my-action-badge">📨 {{ myOpenReferralCount(l) }} اقدام</span>
              <span class="priority-badge" :class="l.priority">{{ priorityLabel(l.priority) }}</span>
              <span class="classification-badge" :class="l.classification">{{ classificationLabel(l.classification) }}</span>
            </div>
            <div class="lt-card-footer">
              <span class="lt-creator">👤 {{ l.creator_name || l.created_by }}</span>
              <span class="lt-date">📅 {{ formatPersianDate(l.created_at) }}</span>
            </div>
            <div v-if="myOpenReferralCount(l) > 0" class="lt-card-action-hint">
              👆 برای ثبت نتیجه و خاتمه ارجاع کلیک کنید
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: DETAILED VIEW & WORKFLOW TIMELINE -->
      <div class="lt-details-col">
        <div v-if="!selectedLetter" class="lt-empty-details">
          <div class="empty-icon">✉️</div>
          <h3>جزئیات نامه اداری</h3>
          <p>یک نامه را از لیست سمت راست انتخاب کنید تا خط زمانی ارجاعات، پاسخ‌ها، وضعیت امضا و ضمایم آن را مشاهده کنید.</p>
        </div>

        <div v-else class="lt-details-container">
          <!-- Letter Title Header -->
          <div class="lt-details-header">
            <div>
              <h2 class="lt-details-subject">{{ selectedLetter.subject }}</h2>
              <div class="lt-details-meta">
                <span class="meta-tag">🔢 شماره اندیکاتور: <strong>{{ selectedLetter.indicator_number || 'پیش‌نویس (بدون شماره)' }}</strong></span>
                <span class="meta-tag">📅 ثبت شده در: {{ formatPersianDate(selectedLetter.created_at) }}</span>
                <span class="meta-tag">👤 ثبت‌کننده: {{ selectedLetter.creator_name || selectedLetter.created_by }}</span>
                <span class="meta-tag">🏷️ نوع: {{ typeLabel(selectedLetter.type) }}</span>
                <span class="meta-tag">⚡ فوریت: {{ priorityLabel(selectedLetter.priority) }}</span>
                <span class="meta-tag">🔒 طبقه‌بندی: {{ classificationLabel(selectedLetter.classification) }}</span>
              </div>
            </div>
            <div class="lt-details-actions">
              <!-- Print -->
              <button
                v-if="selectedLetter.status !== 'draft' && selectedLetter.indicator_number"
                class="lt-btn-print"
                @click="printLetter(selectedLetter.id)"
              >
                🖨 چاپ نامه
              </button>

              <!-- Edit Draft / Super Admin -->
              <button
                v-if="canEditLetter(selectedLetter)"
                class="lt-btn-approve"
                @click="openEditDraft(selectedLetter)"
              >
                ✏️ {{ isSuperAdmin && selectedLetter.status !== 'draft' ? 'ویرایش نامه (مدیریت)' : 'ویرایش پیش‌نویس' }}
              </button>

              <!-- Register internal/incoming -->
              <button
                v-if="canRegisterInternal(selectedLetter)"
                class="lt-btn-approve"
                @click="approveInternalLetter(selectedLetter)"
              >
                📝 ثبت نهایی و صدور شماره
              </button>

              <!-- Send to sign desk (outgoing) -->
              <button
                v-if="canSendToSignDesk(selectedLetter)"
                class="lt-btn-sign"
                @click="approveOutgoingLetter(selectedLetter)"
              >
                ✍️ ارسال به میز کار امضا
              </button>

              <!-- Digital Signature -->
              <button
                v-if="canSignLetter(selectedLetter)"
                class="lt-btn-sign"
                @click="openSignModal"
              >
                🖋️ امضای دیجیتال
              </button>

              <!-- Refer / Follow-up -->
              <button
                v-if="canReferLetter(selectedLetter) || myPendingReferralsForSelected.length > 0"
                class="lt-btn-refer"
                @click="scrollToFollowupPanel"
              >
                📨 {{ myPendingReferralsForSelected.length > 0 ? 'اقدام پیگیری من' : 'ارجاع برای پیگیری' }}
              </button>

              <!-- Cancel Signature -->
              <button
                v-if="selectedLetter.status === 'approved_for_sign' && selectedLetter.my_signer_status === 'signed'"
                class="lt-btn-unsign"
                @click="openUnsignModal"
              >
                🚫 لغو امضای من
              </button>

              <!-- Archive -->
              <button
                v-if="canArchiveLetter(selectedLetter)"
                class="lt-btn-archive"
                @click="archiveLetter(selectedLetter.id)"
              >
                🗄️ بایگانی
              </button>

              <!-- Restore from Trash -->
              <button
                v-if="selectedLetter.is_deleted"
                class="lt-btn-restore"
                @click="restoreLetter(selectedLetter.id)"
              >
                ♻️ بازیابی
              </button>

              <!-- Delete -->
              <button
                v-if="!selectedLetter.is_deleted && (selectedLetter.status === 'draft' || isManager)"
                class="lt-btn-delete"
                @click="deleteLetter(selectedLetter.id)"
              >
                🗑️ حذف
              </button>
            </div>
          </div>

          <!-- Status banner + workflow -->
          <div class="lt-status-banner" :class="'stage-' + workflowStageKey(selectedLetter)">
            <div class="lt-status-main">
              <span class="lt-status-chip">{{ workflowStageLabel(selectedLetter) }}</span>
              <p class="lt-status-desc">{{ statusDescription(selectedLetter) }}</p>
            </div>
            <div v-if="pendingSignersText(selectedLetter)" class="lt-status-waiting">
              ⏳ منتظر: <strong>{{ pendingSignersText(selectedLetter) }}</strong>
            </div>
          </div>

          <div class="lt-workflow-tracker" :class="{ 'wf-live': wfAnimating }" :style="{ '--wf-pct': workflowProgressPct(selectedLetter) + '%' }">
            <div
              v-for="(step, idx) in workflowStepsFor(selectedLetter)"
              :key="step.key"
              :class="['wf-step', { active: step.active, done: step.done, pending: !step.active && !step.done, clickable: isWorkflowStepClickable(step, selectedLetter) }]"
              :title="workflowStepHint(step)"
              @click="onWorkflowStepClick(step)"
            >
              <div class="wf-dot">
                <span class="wf-num">{{ idx + 1 }}</span>
                <span v-if="step.badge" class="wf-badge">{{ step.badge }}</span>
              </div>
              <div class="wf-label">{{ step.label }}</div>
            </div>
          </div>

          <!-- Letter completion guide -->
          <div v-if="showCompletionGuide(selectedLetter)" class="lt-completion-guide">
            <div class="lt-guide-title">📋 مراحل تکمیل نامه بعد از ارجاع</div>
            <div class="lt-guide-steps-row">
              <div :class="['lt-guide-step', { done: hasAnyReferral(selectedLetter), active: !hasAnyReferral(selectedLetter) }]">
                <span class="lt-guide-num">۱</span>
                <span class="lt-guide-lbl">ارجاع به همکار</span>
              </div>
              <div :class="['lt-guide-step', { done: openReferralsOnSelected.length === 0 && hasAnyReferral(selectedLetter), active: openReferralsOnSelected.length > 0 }]">
                <span class="lt-guide-num">۲</span>
                <span class="lt-guide-lbl">ثبت نتیجه توسط گیرنده</span>
              </div>
              <div :class="['lt-guide-step', { done: canArchiveLetter(selectedLetter), active: openReferralsOnSelected.length === 0 && hasAnyReferral(selectedLetter) && !canArchiveLetter(selectedLetter) }]">
                <span class="lt-guide-num">۳</span>
                <span class="lt-guide-lbl">بستن همه ارجاع‌ها</span>
              </div>
              <div :class="['lt-guide-step', { done: selectedLetter.is_archived, active: canArchiveLetter(selectedLetter) }]">
                <span class="lt-guide-num">۴</span>
                <span class="lt-guide-lbl">بایگانی نهایی</span>
              </div>
            </div>
            <div v-if="openReferralsOnSelected.length" class="lt-open-refs-box">
              <strong>⏳ {{ openReferralsOnSelected.length }} ارجاع باز:</strong>
              <span
                v-for="ref in openReferralsOnSelected"
                :key="'open-' + ref.id"
                class="lt-open-ref-tag"
              >
                {{ getUserDisplayName(ref.receiver_id) }}
                <template v-if="ref.receiver_id === username"> (شما)</template>
              </span>
            </div>
            <div v-else-if="hasAnyReferral(selectedLetter) && canArchiveLetter(selectedLetter)" class="lt-ready-archive-box">
              ✅ همه ارجاع‌ها بسته شد — نامه آماده بایگانی است.
              <button class="lt-btn-archive lt-btn-archive-inline" @click="archiveLetter(selectedLetter.id)">
                🗄️ تکمیل و بایگانی نامه
              </button>
            </div>
          </div>

          <!-- Follow-up / Referral action panel (prominent) -->
          <div
            v-if="showFollowupPanel(selectedLetter)"
            id="lt-followup-panel"
            class="lt-followup-panel"
          >
            <div class="lt-followup-panel-head">
              <div>
                <h3>📨 پیگیری و ارجاع نامه</h3>
                <p class="lt-followup-help">
                  <template v-if="myPendingReferralsForSelected.length">
                    این نامه برای <strong>اقدام شما</strong> ارجاع شده — نتیجه را بنویسید و «خاتمه ارجاع» بزنید.
                  </template>
                  <template v-else-if="canReferLetter(selectedLetter)">
                    برای پیگیری، نامه را به همکار دیگر <strong>ارجاع</strong> کنید (جهت اقدام / اطلاع / امضا).
                  </template>
                </p>
              </div>
            </div>

            <div v-if="myPendingReferralsForSelected.length" class="lt-my-actions-block">
              <div class="sub-title">✅ اقدامات منتظر پاسخ شما:</div>
              <div
                v-for="ref in myPendingReferralsForSelected"
                :key="'my-' + ref.id"
                class="lt-my-action-card"
              >
                <div class="lt-my-action-head">
                  <span class="lt-my-action-type">{{ actionTypeLabel(ref.action_type) }}</span>
                  <span class="lt-my-action-from">از {{ getUserDisplayName(ref.sender_id) }} · {{ formatPersianDate(ref.referred_at) }}</span>
                </div>
                <div v-if="ref.note" class="lt-my-action-note">💬 {{ ref.note }}</div>
                <textarea
                  v-model="referralCompletionNotes[ref.id]"
                  placeholder="نتیجه اقدام، پاسخ یا توضیحات پیگیری..."
                  class="lt-input textarea-mini"
                ></textarea>
                <button
                  class="lt-btn-complete"
                  :disabled="completingReferralId === ref.id"
                  @click="completeReferral(ref.id)"
                >
                  ✔ خاتمه ارجاع و ثبت نتیجه
                </button>
              </div>
            </div>

            <div v-if="canReferLetter(selectedLetter)" class="lt-refer-form-prominent">
              <div class="sub-title">➕ ارجاع جدید به همکار:</div>
              <div class="refer-inputs">
                <div class="refer-row-grid">
                  <select v-model="referForm.receiverId" class="lt-input">
                    <option value="">انتخاب گیرنده ارجاع... *</option>
                    <option v-for="u in users" :key="u.username" :value="u.username" :disabled="u.username === username">
                      {{ u.display_name }} ({{ u.role }})
                    </option>
                  </select>
                  <select v-model="referForm.actionType" class="lt-input">
                    <option value="for_action">📨 جهت اقدام و پیگیری</option>
                    <option value="for_information">👁️ جهت اطلاع</option>
                    <option value="for_signature">✍️ جهت امضا و تایید</option>
                  </select>
                </div>
                <textarea
                  v-model="referForm.note"
                  placeholder="دستور اقدام یا یادداشت پیگیری (مثلاً: پیگیری تایید کمیته خرید تا پایان هفته)"
                  class="lt-input textarea"
                ></textarea>
                <textarea
                  v-model="referForm.privateNote"
                  placeholder="یادداشت محرمانه (فقط فرستنده و گیرنده ارجاع)"
                  class="lt-input textarea"
                ></textarea>
                <button
                  class="lt-btn-save"
                  :disabled="!referForm.receiverId || referFormLoading"
                  @click="submitReferral"
                >
                  🚀 ثبت و ارجاع نامه
                </button>
              </div>
            </div>
          </div>

          <!-- Letter Body (Folio DOCX viewer) -->
          <div class="lt-details-body">
            <div class="section-title">📝 متن نامه:</div>
            <div class="lt-editor-wrap">
              <LetterBodyEditor
                v-if="selectedLetterDocx"
                :key="'view-' + selectedLetter.id"
                :document-buffer="selectedLetterDocx"
                read-only
                height="520px"
              />
              <div v-else-if="docxLoading" class="body-content-loading">در حال بارگذاری سند Word...</div>
              <div v-else class="body-content-html" v-html="renderBodyHtml(selectedLetter.body)"></div>
            </div>

            <div v-if="selectedLetter.sender_external || selectedLetter.sender_center_key" class="lt-external-info">
              🚪 <strong>فرستنده (مرکز):</strong> {{ selectedLetter.sender_external || selectedLetter.sender_center_key }}
            </div>
            <div v-if="selectedLetter.receiver_external || selectedLetter.receiver_center_key" class="lt-external-info">
              🚪 <strong>گیرنده (مرکز):</strong> {{ selectedLetter.receiver_external || selectedLetter.receiver_center_key }}
            </div>

            <!-- Signers Status Grid (for outgoing letters) -->
            <div v-if="selectedLetter.type === 'outgoing' && selectedLetter.signers && selectedLetter.signers.length > 0" class="lt-signers-status">
              <div class="sub-title">🖋️ وضعیت امضاکنندگان:</div>
              <div class="signers-list">
                <div v-for="s in selectedLetter.signers" :key="s.username" class="signer-status-badge" :class="s.status">
                  <span class="signer-name">{{ s.display_name || s.username }}</span>
                  <span class="signer-val">{{ s.status === 'signed' ? '✅ امضا شده' : '⏳ در انتظار امضا' }}</span>
                  <button
                    v-if="isSuperAdmin && s.status === 'signed'"
                    type="button"
                    class="lt-btn-admin-unsign"
                    title="حذف امضا (سوپر ادمین)"
                    @click="adminUnsignSigner(s.username, s.display_name || s.username)"
                  >
                    🚫 حذف امضا
                  </button>
                </div>
              </div>
            </div>

            <!-- Receivers List -->
            <div v-if="selectedLetter.receivers && selectedLetter.receivers.length > 0" class="lt-receivers-list">
              <div class="sub-title">👥 گیرندگان داخلی:</div>
              <div class="receivers-wrap">
                <span v-for="r in selectedLetter.receivers" :key="r.receiver_id" class="receiver-tag">
                  👤 {{ r.name }}
                </span>
              </div>
            </div>
          </div>

          <!-- Attachments Section -->
          <div class="lt-details-files">
            <div class="section-title">📂 ضمایم و فایل‌های پیوست:</div>
            <div v-if="filesLoading" class="files-loading">در حال بارگذاری فایل‌ها...</div>
            <div v-else-if="letterFiles.length === 0" class="no-files">بدون فایل پیوست</div>
            <div v-else class="files-grid">
              <div v-for="f in letterFiles" :key="f.id" class="file-item">
                <span class="file-icon">📄</span>
                <div class="file-info">
                  <div class="file-name" :title="f.filename">{{ f.filename }}</div>
                  <div class="file-size">{{ (f.file_size / 1024).toFixed(1) }} KB</div>
                </div>
                <button class="file-dl" title="دانلود فایل" @click="downloadFile(f.id, f.filename)">⬇</button>
              </div>
            </div>

            <div v-if="!selectedLetter.is_archived && !selectedLetter.is_deleted" class="file-upload-row">
              <input type="file" ref="fileInput" class="hidden-file-input" @change="uploadAttachment" />
              <button class="lt-btn-secondary" @click="$refs.fileInput.click()">
                📎 آپلود فایل ضمیمه جدید
              </button>
              <span v-if="uploading" class="upload-progress-text">در حال آپلود...</span>
            </div>
          </div>

          <!-- Change history -->
          <div v-if="letterHistory.length > 0" class="lt-history-section">
            <div class="section-title">🗃 تاریخچه تغییرات:</div>
            <div class="timeline">
              <div v-for="h in letterHistory" :key="h.id" class="timeline-item">
                <div class="timeline-badge history">📝</div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="timeline-title">{{ historyFieldLabel(h.field) }}</span>
                    <span class="timeline-date">{{ formatPersianDate(h.at) }}</span>
                  </div>
                  <div class="timeline-text">
                    توسط <strong>{{ getUserDisplayName(h.by) }}</strong>
                    — {{ historyChangeText(h) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Referral workflow timeline & response forms -->
          <div class="lt-referrals-section">
            <div class="section-title">🔄 تاریخچه گردش کار و ارجاعات نامه:</div>

            <div class="timeline">
              <!-- Initial Registration node -->
              <div class="timeline-item registration">
                <div class="timeline-badge">🟢</div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="timeline-title">ثبت اولیه نامه</span>
                    <span class="timeline-date">{{ formatPersianDate(selectedLetter.created_at) }}</span>
                  </div>
                  <div class="timeline-text">
                    توسط <strong>{{ selectedLetter.creator_name || selectedLetter.created_by }}</strong> در وضعیت پیش‌نویس ثبت شد.
                  </div>
                </div>
              </div>

              <!-- Referral nodes -->
              <div
                v-for="ref in selectedReferrals"
                :key="ref.id"
                :class="['timeline-item', { completed: ref.is_completed }]"
              >
                <div class="timeline-badge" :class="ref.action_type">{{ ref.action_type === 'for_signature' ? '✍️' : '🔵' }}</div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="timeline-title">
                      {{ actionTypeLabel(ref.action_type) }} به <strong>{{ getUserDisplayName(ref.receiver_id) }}</strong>
                    </span>
                    <span class="timeline-date">{{ formatPersianDate(ref.referred_at) }}</span>
                  </div>
                  <div class="timeline-text">
                    ارجاع‌دهنده: <strong>{{ getUserDisplayName(ref.sender_id) }}</strong>
                  </div>
                  <div v-if="ref.note" class="timeline-note">
                    💬 <strong>یادداشت:</strong> {{ ref.note }}
                  </div>
                  <div v-if="ref.private_note && (ref.sender_id === username || ref.receiver_id === username)" class="timeline-private-note">
                    🔒 <strong>یادداشت خصوصی:</strong> {{ ref.private_note }}
                  </div>

                  <!-- Action: Complete referral directed to current user (timeline view) -->
                  <div v-if="!ref.is_completed && ref.receiver_id === username && ref.action_type !== 'for_action'" class="timeline-complete-action">
                    <textarea
                      v-model="referralCompletionNotes[ref.id]"
                      placeholder="توضیحات یا نتیجه اقدام جهت مختومه کردن ارجاع..."
                      class="lt-input textarea-mini"
                    ></textarea>
                    <button
                      class="lt-btn-complete"
                      :disabled="completingReferralId === ref.id"
                      @click="completeReferral(ref.id)"
                    >
                      خاتمه و بایگانی ارجاع ✔
                    </button>
                  </div>

                  <div v-if="ref.is_completed" class="timeline-completion-box">
                    <div class="timeline-completion-header">
                      <span>✓ مختومه شده در {{ formatPersianDate(ref.completed_at) }}</span>
                    </div>
                    <div v-if="ref.completion_note" class="timeline-completion-note">
                      📝 <strong>توضیحات خاتمه:</strong> {{ ref.completion_note }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="canReferLetter(selectedLetter) && myPendingReferralsForSelected.length === 0" class="lt-refer-form-hint">
              💡 برای ارجاع جدید از پنل «پیگیری و ارجاع» در بالای صفحه استفاده کنید.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- NEW LETTER MODAL -->
    <div v-if="showNewModal" class="lt-modal-overlay lt-modal-overlay--compose" @click.self="closeNewModal">
      <div class="lt-modal modal-compose" dir="rtl">
        <div class="lt-modal-header">
          <span>{{ composeModalTitle }}</span>
          <button @click="closeNewModal">✕</button>
        </div>
        <div class="compose-modal-layout">
          <div class="compose-form-scroll lt-modal-body">
          <div class="modal-form-grid">
            <div class="modal-form-row">
              <label>نوع نامه *</label>
              <select v-model="newForm.type" class="lt-input">
                <option value="internal">داخلی (بین همکاران)</option>
                <option value="incoming">وارده (از شرکت/سازمان خارجی)</option>
                <option value="outgoing">صادره (به شرکت/سازمان خارجی)</option>
              </select>
            </div>
            <div class="modal-form-row">
              <label>پیشوند اندیکاتور دپارتمان</label>
              <select v-model="newForm.departmentPrefix" class="lt-input">
                <option value="الف">الف (اداری)</option>
                <option value="م">م (مالی)</option>
                <option value="ف">ف (فروش)</option>
                <option value="ب">ب (بایگانی)</option>
              </select>
            </div>
          </div>

          <div class="modal-form-grid">
            <div class="modal-form-row">
              <label>فوریت نامه</label>
              <select v-model="newForm.priority" class="lt-input">
                <option value="normal">عادی</option>
                <option value="high">فوری</option>
                <option value="immediate">آنی / خیلی فوری</option>
              </select>
            </div>
            <div class="modal-form-row">
              <label>طبقه بندی</label>
              <select v-model="newForm.classification" class="lt-input">
                <option value="normal">عادی</option>
                <option value="confidential">محرمانه</option>
                <option value="secret">سری</option>
              </select>
            </div>
          </div>

          <div class="modal-form-row">
            <label>موضوع نامه *</label>
            <input v-model="newForm.subject" placeholder="موضوع نامه اداری را وارد کنید..." class="lt-input" />
          </div>

          <div v-if="newForm.type === 'incoming'" class="modal-form-row">
            <label>فرستنده (مرکز CRM) *</label>
            <div class="center-picker">
              <input
                v-model="senderCenterQuery"
                placeholder="جستجوی نام مرکز..."
                class="lt-input"
                @input="debouncedCenterSearch('sender')"
                @focus="debouncedCenterSearch('sender')"
              />
              <div v-if="selectedSenderCenter" class="center-picked">
                <span>🏥 {{ selectedSenderCenter.name }} <small>({{ selectedSenderCenter.province }})</small></span>
                <button type="button" class="center-clear" @click="clearSenderCenter">✕</button>
              </div>
              <div v-if="senderCenterResults.length && !selectedSenderCenter" class="center-results">
                <button
                  v-for="c in senderCenterResults"
                  :key="c.centerKey"
                  type="button"
                  class="center-result-item"
                  @click="pickSenderCenter(c)"
                >
                  <strong>{{ c.name }}</strong>
                  <small>{{ c.province }}{{ c.owner ? ' — ' + c.owner : '' }}</small>
                </button>
              </div>
            </div>
          </div>

          <div v-if="newForm.type === 'outgoing'" class="modal-form-row">
            <label>گیرنده (مرکز CRM) *</label>
            <div class="center-picker">
              <input
                v-model="receiverCenterQuery"
                placeholder="جستجوی نام مرکز..."
                class="lt-input"
                @input="debouncedCenterSearch('receiver')"
                @focus="debouncedCenterSearch('receiver')"
              />
              <div v-if="selectedReceiverCenter" class="center-picked">
                <span>🏥 {{ selectedReceiverCenter.name }} <small>({{ selectedReceiverCenter.province }})</small></span>
                <button type="button" class="center-clear" @click="clearReceiverCenter">✕</button>
              </div>
              <div v-if="receiverCenterResults.length && !selectedReceiverCenter" class="center-results">
                <button
                  v-for="c in receiverCenterResults"
                  :key="c.centerKey"
                  type="button"
                  class="center-result-item"
                  @click="pickReceiverCenter(c)"
                >
                  <strong>{{ c.name }}</strong>
                  <small>{{ c.province }}{{ c.owner ? ' — ' + c.owner : '' }}</small>
                </button>
              </div>
            </div>
          </div>

          <!-- Multiple receivers list (Internal / Incoming) -->
          <div v-if="newForm.type !== 'outgoing'" class="modal-form-row">
            <label>گیرندگان داخلی نامه (چند انتخابی)</label>
            <div class="multi-select-wrap">
              <div v-for="u in users" :key="u.username" class="multi-select-item">
                <input type="checkbox" :id="'rec_' + u.username" :value="u.username" v-model="newForm.receivers" />
                <label :for="'rec_' + u.username">{{ u.display_name }} ({{ u.role }})</label>
              </div>
            </div>
          </div>

          <!-- Signers list (Outgoing only) -->
          <div v-if="newForm.type === 'outgoing'" class="modal-form-row">
            <label>امضاکنندگان نامه (حداکثر ۲ کاربر)</label>
            <div class="multi-select-wrap">
              <div v-for="u in users" :key="u.username" class="multi-select-item">
                <input type="checkbox" :id="'sig_' + u.username" :value="u.username" v-model="newForm.signers" :disabled="newForm.signers.length >= 2 && !newForm.signers.includes(u.username)" />
                <label :for="'sig_' + u.username">{{ u.display_name }} ({{ u.role }})</label>
              </div>
            </div>
          </div>

          <!-- Template selection -->
          <div class="modal-form-row" v-if="templates.length > 0">
            <label>درج از قالب‌های آماده</label>
            <select @change="applyTemplate" class="lt-input">
              <option value="">--- انتخاب قالب متنی نامه ---</option>
              <option v-for="t in templates" :key="t.id" :value="t.content">{{ t.title }}</option>
            </select>
          </div>
          </div>

          <div class="compose-editor-panel">
            <label class="compose-editor-label">متن نامه اداری (Word)</label>
            <LetterBodyEditor ref="letterEditorRef" height="100%" :author="username" />
          </div>
        </div>
        <div class="lt-modal-footer">
          <button class="lt-btn-cancel" @click="closeNewModal">انصراف</button>
          <template v-if="isSuperAdminEditingNonDraft">
            <button class="lt-btn-save" :disabled="!newForm.subject.trim() || newFormLoading" @click="saveLetter('draft', { preserveStatus: true })">
              💾 ذخیره تغییرات (مدیریت)
            </button>
          </template>
          <template v-else>
            <button class="lt-btn-save-draft" :disabled="!newForm.subject.trim() || newFormLoading" @click="saveLetter('draft')">
              💾 {{ editingLetterId ? 'ذخیره تغییرات پیش‌نویس' : 'ذخیره به عنوان پیش‌نویس' }}
            </button>
            <button class="lt-btn-save" :disabled="!newForm.subject.trim() || newFormLoading" @click="saveLetter('pending')">
              🚀 {{ editingLetterId ? 'ثبت نهایی تغییرات' : 'ثبت نهایی / ارسال جهت اقدام' }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- DIGITAL SIGNATURE MODAL -->
    <div v-if="showSignModal" class="lt-modal-overlay" @click.self="showSignModal = false">
      <div class="lt-modal modal-small" dir="rtl">
        <div class="lt-modal-header">
          <span>تایید و امضای دیجیتال نامه</span>
          <button @click="showSignModal = false">✕</button>
        </div>
        <div class="lt-modal-body">
          <p class="modal-alert-info">شما در حال تایید و ثبت امضای دیجیتال بر روی نامه «{{ selectedLetter?.subject }}» می‌باشید.</p>
          
          <div class="modal-form-row">
            <label>نوع امضا *</label>
            <select v-model="signForm.signType" class="lt-input">
              <option value="simple">امضای ساده دیجیتال</option>
              <option value="sign">درج تصویر امضا</option>
              <option value="stamp">درج تصویر مهر شرکت</option>
              <option value="both">درج همزمان مهر و امضا</option>
            </select>
          </div>

          <div class="modal-form-row checkbox-row">
            <input type="checkbox" id="use_letterhead" v-model="signForm.useLetterhead" />
            <label for="use_letterhead">صدور بر روی سربرگ رسمی آتنا زیست درمان</label>
          </div>

          <div class="modal-form-row">
            <label>پین‌کد امنیتی امضا *</label>
            <input type="password" v-model="signForm.pinCode" placeholder="پین‌کد امضا (پیش‌فرض: 1234)" class="lt-input text-center font-bold" />
          </div>
        </div>
        <div class="lt-modal-footer">
          <button class="lt-btn-cancel" @click="showSignModal = false">انصراف</button>
          <button class="lt-btn-save-sign" :disabled="!signForm.pinCode || signFormLoading" @click="submitSignature">
            🖋️ ثبت امضای دیجیتال
          </button>
        </div>
      </div>
    </div>

    <!-- UNSIGN MODAL -->
    <div v-if="showUnsignModal" class="lt-modal-overlay" @click.self="showUnsignModal = false">
      <div class="lt-modal modal-small" dir="rtl">
        <div class="lt-modal-header">
          <span>لغو امضای دیجیتال</span>
          <button @click="showUnsignModal = false">✕</button>
        </div>
        <div class="lt-modal-body">
          <p class="modal-alert-warning">آیا مطمئن هستید که می‌خواهید امضای خود را پس بگیرید؟ برای تایید، پین‌کد امضای خود را وارد کنید.</p>
          <div class="modal-form-row">
            <label>پین‌کد امنیتی امضا *</label>
            <input type="password" v-model="unsignForm.pinCode" placeholder="پین‌کد امضا" class="lt-input text-center font-bold" />
          </div>
        </div>
        <div class="lt-modal-footer">
          <button class="lt-btn-cancel" @click="showUnsignModal = false">انصراف</button>
          <button class="lt-btn-save-unsign" :disabled="!unsignForm.pinCode || unsignFormLoading" @click="submitUnsign">
            🚫 تایید لغو امضا
          </button>
        </div>
      </div>
    </div>

    <!-- PRINT TEMPLATE EDITOR MODAL -->
    <div v-if="showPrintTplModal" class="lt-modal-overlay" @click.self="showPrintTplModal = false">
      <div class="lt-modal modal-print-tpl" dir="rtl">
        <div class="lt-modal-header">
          <span>🖨 ویرایش قالب چاپ نامه</span>
          <button @click="showPrintTplModal = false">✕</button>
        </div>
        <div class="lt-modal-body print-tpl-body">
          <p class="modal-alert-info">
            قالب HTML با placeholderها — هنگام چاپ هر نامه، مقادیر واقعی جایگزین می‌شوند.
          </p>
          <div class="print-tpl-placeholders">
            <span
              v-for="ph in printTplPlaceholders"
              :key="ph"
              class="print-tpl-ph"
              @click="insertPrintPlaceholder(ph)"
            >{{ formatPlaceholder(ph) }}</span>
          </div>
          <textarea
            v-model="printTplForm.template"
            class="lt-input print-tpl-editor"
            spellcheck="false"
            dir="ltr"
          ></textarea>
        </div>
        <div class="lt-modal-footer">
          <button class="lt-btn-cancel" @click="resetPrintTemplate">بازگشت به پیش‌فرض</button>
          <button class="lt-btn-secondary" :disabled="!selectedLetter" @click="previewPrintTemplate">👁 پیش‌نمایش</button>
          <button class="lt-btn-save" :disabled="printTplLoading || !printTplForm.template.trim()" @click="savePrintTemplate">
            💾 ذخیره قالب
          </button>
        </div>
      </div>
    </div>

    <!-- CHANGE PIN CONFIG MODAL -->
    <div v-if="showPinModal" class="lt-modal-overlay" @click.self="showPinModal = false">
      <div class="lt-modal modal-small" dir="rtl">
        <div class="lt-modal-header">
          <span>تنظیمات پین‌کد امضا</span>
          <button @click="showPinModal = false">✕</button>
        </div>
        <div class="lt-modal-body">
          <div class="modal-form-row">
            <label>پین‌کد فعلی *</label>
            <input type="password" v-model="pinForm.currentPin" placeholder="پین‌کد قبلی" class="lt-input" />
          </div>
          <div class="modal-form-row">
            <label>پین‌کد جدید *</label>
            <input type="password" v-model="pinForm.newPin" placeholder="پین‌کد جدید" class="lt-input" />
          </div>
          <div class="modal-form-row sig-upload-row">
            <label>تصویر امضا (برای چاپ نامه)</label>
            <div class="sig-upload-wrap">
              <img v-if="signaturePreviewUrl" :src="signaturePreviewUrl" class="sig-preview-img" alt="پیش‌نمایش امضا" />
              <input type="file" ref="sigFileInput" accept="image/png,image/jpeg,image/webp" class="hidden-file-input" @change="uploadSignatureImage" />
              <button type="button" class="lt-btn-secondary" :disabled="sigUploadLoading" @click="($refs.sigFileInput as HTMLInputElement)?.click()">
                📷 {{ signaturePreviewUrl ? 'تغییر تصویر امضا' : 'آپلود تصویر امضا' }}
              </button>
            </div>
            <p class="sig-upload-hint">این تصویر در چاپ نامه (بالای «با تشکر») درج می‌شود.</p>
          </div>
        </div>
        <div class="lt-modal-footer">
          <button class="lt-btn-cancel" @click="showPinModal = false">انصراف</button>
          <button class="lt-btn-save" :disabled="!pinForm.currentPin || !pinForm.newPin || pinFormLoading" @click="updatePinCode">
            ثبت پین‌کد جدید
          </button>
        </div>
      </div>
    </div>

    <!-- INDICATOR START NUMBER (SUPER ADMIN) -->
    <div v-if="showIndicatorModal" class="lt-modal-overlay" @click.self="showIndicatorModal = false">
      <div class="lt-modal modal-small" dir="rtl">
        <div class="lt-modal-header">
          <span>🔢 شماره شروع نامه (سال {{ indicatorForm.jalaliYear || '—' }})</span>
          <button @click="showIndicatorModal = false">✕</button>
        </div>
        <div class="lt-modal-body">
          <p class="modal-alert-info">
            شمارنده در ابتدای هر سال شمسی از این عدد شروع می‌شود و الگوی شماره برای سال بعد تکرار می‌گردد.
            بخش تاریخ در شماره (مثلاً ۴۰۵۰۱) خودکار با سال/ماه جدید به‌روز می‌شود.
          </p>
          <div class="modal-form-row">
            <label>شماره شروع سالانه *</label>
            <input
              type="number"
              min="1"
              max="999999"
              v-model.number="indicatorForm.startNumber"
              class="lt-input"
              :disabled="!indicatorForm.canEdit"
            />
          </div>
          <div class="modal-form-row" v-if="indicatorForm.example">
            <label>نمونه شماره بعدی</label>
            <div class="lt-indicator" style="display:block;padding:8px 10px;background:#f8fafc;border-radius:8px">{{ indicatorForm.example }}</div>
          </div>
          <label class="lt-check-row" style="display:flex;gap:8px;align-items:center;font-size:13px;margin-top:8px">
            <input type="checkbox" v-model="indicatorForm.applyCurrentYear" :disabled="!indicatorForm.canEdit" />
            اعمال روی شمارنده سال جاری (نامه بعدی از این عدد؛ بدون عقب‌گرد روی شماره‌های صادرشده)
          </label>
          <div v-if="indicatorForm.counters.length" style="margin-top:14px">
            <div style="font-weight:700;font-size:13px;margin-bottom:6px">شمارنده‌های سال جاری</div>
            <div
              v-for="c in indicatorForm.counters"
              :key="c.department_prefix + '-' + c.letter_type"
              style="font-size:12px;color:#64748b;padding:4px 0;border-bottom:1px solid #f1f5f9"
            >
              {{ c.department_prefix }} / {{ letterTypeLabel(c.letter_type) }} → آخرین: {{ c.last_sequence }}
            </div>
          </div>
        </div>
        <div class="lt-modal-footer">
          <button class="lt-btn-cancel" @click="showIndicatorModal = false">بستن</button>
          <button
            v-if="indicatorForm.canEdit"
            class="lt-btn-save"
            :disabled="indicatorLoading || !indicatorForm.startNumber || indicatorForm.startNumber < 1"
            @click="saveIndicatorSettings"
          >
            💾 ذخیره
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, nextTick, watch } from 'vue';
import LetterBodyEditor from './LetterBodyEditor.vue';
import { arrayBufferToBase64, fetchLetterDocx } from '../utils/letterDocx';

interface User {
  username: string;
  display_name: string;
  role: string;
  active: boolean;
}

interface Customer {
  id: string;
  company_name: string;
  company_code: string;
}

interface Template {
  id: number;
  title: string;
  content: string;
}

interface LetterCenter {
  centerKey: string;
  name: string;
  province: string;
  owner: string;
}

interface LetterHistoryEntry {
  id: number;
  at: string;
  by: string;
  field: string;
  val: string | { action?: string; old?: unknown; new?: unknown; note?: string };
}

interface Letter {
  id: number;
  indicator_number: string;
  subject: string;
  body: string;
  has_docx?: boolean;
  type: 'incoming' | 'outgoing' | 'internal';
  status: 'draft' | 'pending_action' | 'approved_for_sign' | 'registered' | 'in_referral' | 'archived';
  priority: 'normal' | 'high' | 'immediate';
  classification: 'normal' | 'confidential' | 'secret';
  department_prefix: string;
  sender_external: string;
  receiver_external: string;
  sender_center_key?: string;
  receiver_center_key?: string;
  created_by: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  is_deleted: boolean;
  my_signer_status?: string | null;
  my_signer_type?: string | null;
  total_signers?: number;
  completed_signers?: number;
  signers?: Array<{ username: string; display_name: string; status: string }>;
  receivers?: Array<{ receiver_id: string; receiver_type: string; name: string }>;
}

interface Referral {
  id: number;
  letter_id: number;
  sender_id: string;
  receiver_id: string;
  action_type: string;
  note: string;
  private_note?: string;
  is_read: boolean;
  referred_at: string;
  is_completed: boolean;
  completed_at?: string;
  completion_note?: string;
}

interface LetterFile {
  id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

const props = defineProps<{
  username: string;
  userRole: string;
  isManager: boolean;
}>();

const VIEW_TABS = [
  { key: 'incoming', label: '📥 وارده' },
  { key: 'outgoing', label: '📤 صادره' },
  { key: 'internal', label: '🏢 داخلی' },
  { key: 'archived', label: '🗄️ بایگانی' },
  { key: 'trash', label: '🗑️ زباله' },
];

const loading = ref(false);
const letters = ref<Letter[]>([]);
const referrals = ref<Referral[]>([]);
const users = ref<User[]>([]);
const customers = ref<Customer[]>([]);
const templates = ref<Template[]>([]);
const activeTab = ref('pending');
const searchQuery = ref('');
const selectedLetter = ref<Letter | null>(null);
const selectedLetterDocx = ref<ArrayBuffer | null>(null);
const docxLoading = ref(false);
const letterEditorRef = ref<InstanceType<typeof LetterBodyEditor> | null>(null);

// Letter attachments
const letterFiles = ref<LetterFile[]>([]);
const filesLoading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// Referral completion states
const referralCompletionNotes = ref<Record<number, string>>({});
const completingReferralId = ref<number | null>(null);

// Forms & Modals toggle
const showNewModal = ref(false);
const editingLetterId = ref<number | null>(null);
const editingLetterStatus = ref<string>('draft');
const newFormLoading = ref(false);
const newForm = reactive({
  type: 'internal' as 'incoming' | 'outgoing' | 'internal',
  departmentPrefix: 'الف',
  priority: 'normal' as 'normal' | 'high' | 'immediate',
  classification: 'normal' as 'normal' | 'confidential' | 'secret',
  subject: '',
  body: '',
  bodyDocx: '' as string,
  receivers: [] as string[],
  signers: [] as string[],
});

// Center picker (CRM centers list)
const senderCenterQuery = ref('');
const receiverCenterQuery = ref('');
const senderCenterResults = ref<LetterCenter[]>([]);
const receiverCenterResults = ref<LetterCenter[]>([]);
const selectedSenderCenter = ref<LetterCenter | null>(null);
const selectedReceiverCenter = ref<LetterCenter | null>(null);
let centerSearchTimer: ReturnType<typeof setTimeout> | null = null;

// Change history
const letterHistory = ref<LetterHistoryEntry[]>([]);

// Signature Form
const showSignModal = ref(false);
const signFormLoading = ref(false);
const signForm = reactive({
  signType: 'simple',
  useLetterhead: false,
  pinCode: '',
});

// Unsign Form
const showUnsignModal = ref(false);
const unsignFormLoading = ref(false);
const unsignForm = reactive({
  pinCode: '',
});

// Update PIN Form
const showPinModal = ref(false);
const showPrintTplModal = ref(false);
const showIndicatorModal = ref(false);
const indicatorLoading = ref(false);
const indicatorForm = reactive({
  jalaliYear: 0,
  startNumber: 1,
  example: '',
  canEdit: false,
  applyCurrentYear: true,
  counters: [] as Array<{ department_prefix: string; letter_type: string; last_sequence: number }>,
});

const isSuperAdmin = computed(() => props.userRole === 'سوپر ادمین');

const isSuperAdminEditingNonDraft = computed(() =>
  isSuperAdmin.value && editingLetterId.value != null && editingLetterStatus.value !== 'draft'
);

const composeModalTitle = computed(() => {
  if (!editingLetterId.value) return 'ثبت نامه اداری جدید';
  if (isSuperAdminEditingNonDraft.value) return 'ویرایش نامه (سوپر ادمین)';
  return 'ویرایش پیش‌نویس نامه';
});

function letterTypeLabel(t: string) {
  if (t === 'outgoing') return 'صادره';
  if (t === 'incoming') return 'وارده';
  if (t === 'internal') return 'داخلی';
  return t || '—';
}

async function openIndicatorModal() {
  showIndicatorModal.value = true;
  indicatorLoading.value = true;
  try {
    const r = await fetch('/api/letters/indicator-settings', { credentials: 'include' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'خطا');
    indicatorForm.jalaliYear = data.jalali_year || 0;
    indicatorForm.startNumber = data.start_number || 1;
    indicatorForm.example = data.example || '';
    indicatorForm.canEdit = !!data.can_edit;
    indicatorForm.counters = Array.isArray(data.counters) ? data.counters : [];
  } catch (e: any) {
    alert(e.message || 'خطا در بارگذاری تنظیمات شماره');
    showIndicatorModal.value = false;
  } finally {
    indicatorLoading.value = false;
  }
}

async function saveIndicatorSettings() {
  if (!indicatorForm.canEdit) return;
  const n = Number(indicatorForm.startNumber);
  if (!Number.isFinite(n) || n < 1) {
    alert('شماره شروع نامعتبر است');
    return;
  }
  indicatorLoading.value = true;
  try {
    const r = await fetch('/api/letters/indicator-settings', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_number: n,
        apply_to_current_year: !!indicatorForm.applyCurrentYear,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'خطا در ذخیره');
    alert('شماره شروع ذخیره شد. از سال بعد شمارنده از همین عدد ریست می‌شود.');
    showIndicatorModal.value = false;
  } catch (e: any) {
    alert(e.message || 'خطا');
  } finally {
    indicatorLoading.value = false;
  }
}
const pinFormLoading = ref(false);
const pinForm = reactive({
  currentPin: '',
  newPin: '',
});

const printTplLoading = ref(false);
const printTplPlaceholders = ref<string[]>([
  'letterhead', 'indicator_number', 'type', 'date', 'creator',
  'sender_block', 'receiver_block', 'subject', 'body', 'signers_block',
]);
const wfAnimating = ref(false);
const signaturePreviewUrl = ref('');
const sigUploadLoading = ref(false);
const sigFileInput = ref<HTMLInputElement | null>(null);
const printTplForm = reactive({
  template: '',
  defaultTemplate: '',
});

// Refer New Form
const referFormLoading = ref(false);
const referForm = reactive({
  receiverId: '',
  actionType: 'for_action',
  note: '',
  privateNote: '',
});

// Counters
const statPendingCount = computed(() => {
  return letters.value.filter(l => {
    if (l.is_archived || l.is_deleted) return false;
    const isPendingLetter = (l.type !== 'outgoing' && ['pending_action', 'registered', 'in_referral'].includes(l.status)) ||
                            (l.type === 'outgoing' && ['pending_action', 'in_referral', 'approved_for_sign'].includes(l.status));
    
    if (!isPendingLetter) return false;
    
    if (props.isManager || props.userRole === 'مدیر' || props.userRole === 'سوپر ادمین') return true;

    // Check if created by me or has active referrals receiver_id = me
    const isCreator = l.created_by === props.username;
    const hasActiveRef = referrals.value.some(r => r.letter_id === l.id && r.receiver_id === props.username && !r.is_completed);
    return isCreator || hasActiveRef;
  }).length;
});

const statSignDeskCount = computed(() => {
  return letters.value.filter(l => {
    if (l.is_deleted || l.status !== 'approved_for_sign') return false;
    if (l.my_signer_status === 'pending') return true;
    return referrals.value.some(r => r.letter_id === l.id && r.receiver_id === props.username && r.action_type === 'for_signature' && !r.is_completed);
  }).length;
});

const statFollowupCount = computed(() => {
  const letterIds = new Set<number>();
  referrals.value.forEach(r => {
    if (!r.is_completed && r.action_type === 'for_action' && r.receiver_id === props.username) {
      letterIds.add(r.letter_id);
    }
  });
  return letterIds.size;
});

const statDraftsCount = computed(() => {
  return letters.value.filter(l => l.status === 'draft' && !l.is_deleted).length;
});

const myPendingReferralsForSelected = computed(() => {
  if (!selectedLetter.value) return [];
  return selectedReferrals.value.filter(
    r => !r.is_completed && r.receiver_id === props.username && r.action_type === 'for_action'
  );
});

const openReferralsOnSelected = computed(() => {
  if (!selectedLetter.value) return [];
  return selectedReferrals.value.filter(r => !r.is_completed && r.action_type === 'for_action');
});

function hasAnyReferral(l: Letter): boolean {
  return referrals.value.some(r => r.letter_id === l.id);
}

function showCompletionGuide(l: Letter): boolean {
  if (l.is_archived || l.is_deleted || l.status === 'draft') return false;
  if (['registered', 'in_referral'].includes(l.status)) return true;
  if (l.status === 'approved_for_sign' && l.type !== 'outgoing') return false;
  return false;
}

function myOpenReferralCount(l: Letter): number {
  return referrals.value.filter(
    r => r.letter_id === l.id && !r.is_completed && r.receiver_id === props.username && r.action_type === 'for_action'
  ).length;
}

function showFollowupPanel(l: Letter): boolean {
  if (l.is_archived || l.is_deleted) return false;
  const myPending = referrals.value.filter(
    r => r.letter_id === l.id && !r.is_completed && r.receiver_id === props.username && r.action_type === 'for_action'
  );
  if (myPending.length > 0) return true;
  return canReferLetter(l);
}

function canReferLetter(l: Letter): boolean {
  if (l.is_archived || l.is_deleted) return false;
  if (!['registered', 'in_referral'].includes(l.status)) return false;
  if (props.isManager || props.userRole === 'مدیر' || props.userRole === 'سوپر ادمین') return true;
  if (l.created_by === props.username) return true;
  return referrals.value.some(
    r => r.letter_id === l.id && (r.sender_id === props.username || r.receiver_id === props.username)
  );
}

function scrollToFollowupPanel() {
  nextTick(() => {
    const el = document.getElementById('lt-followup-panel');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

const filteredLetters = computed(() => {
  let list = letters.value;

  // Search logic already handled by API query param, but fallback client-side search:
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(l =>
      l.subject.toLowerCase().includes(q) ||
      (l.indicator_number || '').toLowerCase().includes(q) ||
      (l.body || '').toLowerCase().includes(q)
    );
  }

  return list;
});

const selectedReferrals = computed(() => {
  if (!selectedLetter.value) return [];
  return referrals.value
    .filter(r => r.letter_id === selectedLetter.value!.id)
    .sort((a, b) => new Date(a.referred_at).getTime() - new Date(b.referred_at).getTime());
});

// Methods
function selectTab(key: string) {
  activeTab.value = key;
  selectedLetter.value = null;
  load();
}

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      tab: activeTab.value,
      search: searchQuery.value.trim(),
    });

    const r = await fetch(`/api/letters?${params.toString()}`);
    if (r.ok) {
      const data = await r.json();
      letters.value = data.letters || [];
      referrals.value = data.referrals || [];
    }

    // Lazy load users, customers and templates once if empty
    if (users.value.length === 0) {
      const rUsers = await fetch('/api/letters/users');
      if (rUsers.ok) {
        const uData = await rUsers.json();
        users.value = uData.users || [];
      }
    }
    if (customers.value.length === 0) {
      const rCust = await fetch('/api/letters/customers');
      if (rCust.ok) {
        const cData = await rCust.json();
        customers.value = cData.customers || [];
      }
    }
    if (templates.value.length === 0) {
      const rTemp = await fetch('/api/letters/templates');
      if (rTemp.ok) {
        const tData = await rTemp.json();
        templates.value = tData.templates || [];
      }
    }
  } catch (e) {
    console.error('[letters load error]', e);
  } finally {
    loading.value = false;
  }
}

async function selectLetter(l: Letter) {
  selectedLetter.value = l;
  selectedLetterDocx.value = null;
  referForm.receiverId = '';
  referForm.note = '';
  referForm.privateNote = '';
  referForm.actionType = 'for_action';

  if (l.has_docx) {
    docxLoading.value = true;
    try {
      selectedLetterDocx.value = await fetchLetterDocx(l.id);
    } catch (e) {
      console.warn('[letters] docx load failed', e);
    } finally {
      docxLoading.value = false;
    }
  }

  loadLetterFiles(l.id);
  loadLetterReferrals(l.id);
  loadLetterHistory(l.id);
}

async function loadLetterHistory(letterId: number) {
  try {
    const r = await fetch(`/api/letters/${letterId}/history`);
    if (r.ok) {
      const data = await r.json();
      letterHistory.value = (data.history || []).slice().reverse();
    } else {
      letterHistory.value = [];
    }
  } catch {
    letterHistory.value = [];
  }
}

function parseHistoryVal(val: LetterHistoryEntry['val']) {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as Record<string, unknown>;
    } catch {
      return { new: val };
    }
  }
  return (val || {}) as Record<string, unknown>;
}

function historyFieldLabel(field: string): string {
  const map: Record<string, string> = {
    subject: 'موضوع',
    body: 'متن نامه',
    body_docx: 'سند Word',
    type: 'نوع نامه',
    priority: 'فوریت',
    classification: 'طبقه‌بندی',
    sender_external: 'فرستنده',
    receiver_external: 'گیرنده',
    sender_center_key: 'مرکز فرستنده',
    receiver_center_key: 'مرکز گیرنده',
    status: 'وضعیت',
    letters: 'ایجاد نامه',
  };
  return map[field] || field;
}

function historyChangeText(h: LetterHistoryEntry): string {
  const v = parseHistoryVal(h.val);
  if (v.action === 'create') {
    const subj = v.subject ? ` — ${String(v.subject)}` : '';
    return `نامه ایجاد شد${subj}`;
  }
  if (h.field === 'body_docx') {
    return v.note ? String(v.note) : 'سند Word به‌روزرسانی شد';
  }
  const oldV = v.old;
  const newV = v.new;
  if (oldV !== undefined && newV !== undefined) {
    const o = String(oldV).slice(0, 100);
    const n = String(newV).slice(0, 100);
    if (!o) return `→ ${n}`;
    return `${o} → ${n}`;
  }
  return v.note ? String(v.note) : 'تغییر ثبت شد';
}

function resetCenterPicker() {
  senderCenterQuery.value = '';
  receiverCenterQuery.value = '';
  senderCenterResults.value = [];
  receiverCenterResults.value = [];
  selectedSenderCenter.value = null;
  selectedReceiverCenter.value = null;
}

function debouncedCenterSearch(which: 'sender' | 'receiver') {
  if (centerSearchTimer) clearTimeout(centerSearchTimer);
  centerSearchTimer = setTimeout(() => searchCenters(which), 250);
}

async function searchCenters(which: 'sender' | 'receiver') {
  const q = which === 'sender' ? senderCenterQuery.value.trim() : receiverCenterQuery.value.trim();
  if (q.length < 1) {
    if (which === 'sender') senderCenterResults.value = [];
    else receiverCenterResults.value = [];
    return;
  }
  try {
    const r = await fetch(`/api/letters/centers?q=${encodeURIComponent(q)}&limit=25`);
    const ct = r.headers.get('content-type') || '';
    if (!r.ok) {
      console.warn('[letters center search] HTTP', r.status);
      return;
    }
    if (!ct.includes('application/json')) {
      console.warn('[letters center search] non-JSON response — سرور را ری‌استارت کنید');
      return;
    }
    const data = await r.json();
    const list = data.centers || [];
    if (which === 'sender') senderCenterResults.value = list;
    else receiverCenterResults.value = list;
  } catch (e) {
    console.warn('[letters center search]', e);
  }
}

function pickSenderCenter(c: LetterCenter) {
  selectedSenderCenter.value = c;
  senderCenterQuery.value = '';
  senderCenterResults.value = [];
}

function pickReceiverCenter(c: LetterCenter) {
  selectedReceiverCenter.value = c;
  receiverCenterQuery.value = '';
  receiverCenterResults.value = [];
}

function clearSenderCenter() {
  selectedSenderCenter.value = null;
  senderCenterQuery.value = '';
  senderCenterResults.value = [];
}

function clearReceiverCenter() {
  selectedReceiverCenter.value = null;
  receiverCenterQuery.value = '';
  receiverCenterResults.value = [];
}

async function loadLetterFiles(letterId: number) {
  filesLoading.value = true;
  try {
    const r = await fetch(`/api/letters/${letterId}/files`);
    if (r.ok) {
      const data = await r.json();
      letterFiles.value = data.files || [];
    }
  } finally {
    filesLoading.value = false;
  }
}

async function loadLetterReferrals(letterId: number) {
  try {
    const r = await fetch(`/api/letters/${letterId}/referrals`);
    if (r.ok) {
      const data = await r.json();
      referrals.value = referrals.value.filter(x => x.letter_id !== letterId).concat(data.referrals || []);
    }
  } catch (e) {}
}

async function refreshSelectedLetter() {
  if (!selectedLetter.value) return;
  const id = selectedLetter.value.id;
  const updated = letters.value.find(l => l.id === id);
  if (updated) selectedLetter.value = updated;
}

// Letter registration / approvals
async function approveInternalLetter(letter: Letter) {
  if (!confirm('آیا از تایید نهایی و صدور شماره اندیکاتور برای این نامه اطمینان دارید؟')) return;
  try {
    const r = await fetch(`/api/letters/${letter.id}/approve-internal`, { method: 'POST' });
    if (r.ok) {
      const data = await r.json();
      alert(`نامه با موفقیت شماره‌گذاری شد. شماره اندیکاتور: ${data.indicator_number}`);
      load();
      selectedLetter.value = null;
    } else {
      const err = await r.json();
      alert(err.error || 'خطا در ثبت نهایی نامه');
    }
  } catch (e) {
    alert('خطای ارتباط با سرور');
  }
}

async function approveOutgoingLetter(letter: Letter) {
  if (!confirm('آیا می‌خواهید این نامه را به میز کار امضاکنندگان ارسال کنید؟')) return;
  try {
    const r = await fetch(`/api/letters/${letter.id}/approve-outgoing`, { method: 'POST' });
    if (r.ok) {
      const res = await r.json();
      alert('نامه به میز کار امضا ارسال شد.');
      await load();
      if (res.letter) {
        await selectLetter(res.letter);
        pulseWorkflow();
      }
    } else {
      const err = await r.json();
      alert(err.error || 'خطا در ارسال جهت امضا');
    }
  } catch (e) {
    alert('خطای ارتباط با سرور');
  }
}

// Signature Dialog Action
function openSignModal() {
  signForm.signType = 'simple';
  signForm.useLetterhead = false;
  signForm.pinCode = '';
  showSignModal.value = true;
}

async function submitSignature() {
  if (!selectedLetter.value) return;
  signFormLoading.value = true;
  try {
    const r = await fetch(`/api/letters/${selectedLetter.value.id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sign_type: signForm.signType,
        use_letterhead: signForm.useLetterhead,
        pin_code: signForm.pinCode,
      }),
    });
    if (r.ok) {
      const res = await r.json();
      if (res.status === 'signed_complete') {
        alert(`نامه با موفقیت امضا و شماره اندیکاتور نهایی صادر گردید: ${res.indicator_number}`);
      } else {
        alert('امضای شما ثبت شد. نامه منتظر امضای بقیه گیرندگان است.');
      }
      showSignModal.value = false;
      await load();
      if (selectedLetter.value) {
        const refreshed = letters.value.find(x => x.id === selectedLetter.value!.id);
        if (refreshed) {
          await selectLetter(refreshed);
          pulseWorkflow();
        }
      }
    } else {
      const err = await r.json();
      alert(err.error || 'خطا در تایید امضای دیجیتال');
    }
  } catch (e) {
    alert('خطا در برقراری ارتباط');
  } finally {
    signFormLoading.value = false;
  }
}

// Unsign Dialog Action
function openUnsignModal() {
  unsignForm.pinCode = '';
  showUnsignModal.value = true;
}

async function adminUnsignSigner(username: string, displayName: string) {
  if (!selectedLetter.value) return;
  const note = prompt(`حذف امضای «${displayName}» — توضیح (اختیاری):`);
  if (note === null) return;
  if (!confirm(`آیا از حذف امضای «${displayName}» مطمئن هستید؟`)) return;
  try {
    const r = await fetch(`/api/letters/${selectedLetter.value.id}/admin-unsign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, note: String(note).trim() }),
    });
    if (r.ok) {
      alert('امضا با موفقیت حذف شد.');
      const prevId = selectedLetter.value.id;
      await load();
      const found = letters.value.find(l => l.id === prevId);
      if (found) await selectLetter(found);
    } else {
      const err = await r.json();
      alert(err.error || 'خطا در حذف امضا');
    }
  } catch {
    alert('خطا در برقراری ارتباط');
  }
}

async function submitUnsign() {
  if (!selectedLetter.value) return;
  unsignFormLoading.value = true;
  try {
    const r = await fetch(`/api/letters/${selectedLetter.value.id}/unsign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin_code: unsignForm.pinCode,
      }),
    });
    if (r.ok) {
      alert('امضای شما با موفقیت لغو و نامه بازگردانده شد.');
      showUnsignModal.value = false;
      load();
      selectedLetter.value = null;
    } else {
      const err = await r.json();
      alert(err.error || 'خطا در لغو امضا');
    }
  } catch (e) {
    alert('خطا در برقراری ارتباط');
  } finally {
    unsignFormLoading.value = false;
  }
}

async function updatePinCode() {
  pinFormLoading.value = true;
  try {
    const r = await fetch('/api/letters/update-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_pin: pinForm.currentPin,
        new_pin: pinForm.newPin,
      }),
    });
    if (r.ok) {
      alert('پین‌کد امضای شما با موفقیت تغییر یافت.');
      showPinModal.value = false;
      pinForm.currentPin = '';
      pinForm.newPin = '';
    } else {
      const err = await r.json();
      alert(err.error || 'خطا در تغییر پین‌کد');
    }
  } catch (e) {
    alert('خطای برقراری ارتباط');
  } finally {
    pinFormLoading.value = false;
  }
}

async function openPrintTplModal() {
  showPrintTplModal.value = true;
  printTplLoading.value = true;
  try {
    const r = await fetch('/api/letters/print-template');
    if (r.ok) {
      const data = await r.json();
      printTplForm.template = data.template || '';
      printTplForm.defaultTemplate = data.default_template || data.template || '';
      if (Array.isArray(data.placeholders) && data.placeholders.length) {
        printTplPlaceholders.value = data.placeholders;
      }
    }
  } catch (e) {
    alert('خطا در بارگذاری قالب چاپ');
  } finally {
    printTplLoading.value = false;
  }
}

function insertPrintPlaceholder(ph: string) {
  printTplForm.template += `{{${ph}}}`;
}

function formatPlaceholder(ph: string): string {
  return `{{${ph}}}`;
}

function resetPrintTemplate() {
  if (!confirm('قالب به حالت پیش‌فرض بازگردانده شود؟')) return;
  printTplForm.template = printTplForm.defaultTemplate;
}

function previewPrintTemplate() {
  if (selectedLetter.value) {
    printLetter(selectedLetter.value.id);
  } else {
    alert('ابتدا یک نامه را از لیست انتخاب کنید، سپس پیش‌نمایش بزنید.');
  }
}

async function savePrintTemplate() {
  if (!printTplForm.template.trim()) return;
  printTplLoading.value = true;
  try {
    const r = await fetch('/api/letters/print-template', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: printTplForm.template }),
    });
    if (r.ok) {
      alert('قالب چاپ با موفقیت ذخیره شد.');
      showPrintTplModal.value = false;
    } else {
      const err = await r.json();
      alert(err.error || 'خطا در ذخیره قالب');
    }
  } catch (e) {
    alert('خطای ارتباط با سرور');
  } finally {
    printTplLoading.value = false;
  }
}

// Refer Letter
async function submitReferral() {
  if (!selectedLetter.value || !referForm.receiverId) return;
  referFormLoading.value = true;
  try {
    const r = await fetch(`/api/letters/${selectedLetter.value.id}/refer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiverId: referForm.receiverId,
        action_type: referForm.actionType,
        note: referForm.note,
        private_note: referForm.privateNote,
      }),
    });
    if (r.ok) {
      alert('نامه با موفقیت ارجاع گردید.');
      referForm.receiverId = '';
      referForm.note = '';
      referForm.privateNote = '';
      referForm.actionType = 'for_action';
      await loadLetterReferrals(selectedLetter.value.id);
      await load();
      await refreshSelectedLetter();
    } else {
      const err = await r.json();
      alert(err.error || 'خطا در ثبت ارجاع');
    }
  } finally {
    referFormLoading.value = false;
  }
}

// Complete Referral action
async function completeReferral(refId: number) {
  completingReferralId.value = refId;
  const completionNote = referralCompletionNotes.value[refId] || '';
  try {
    const r = await fetch(`/api/letters/referrals/${refId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completion_note: completionNote }),
    });
    if (r.ok) {
      alert('ارجاع با موفقیت مختومه شد.');
      delete referralCompletionNotes.value[refId];
      if (selectedLetter.value) {
        await loadLetterReferrals(selectedLetter.value.id);
        await load();
        await refreshSelectedLetter();
      }
    } else {
      alert('خطا در ثبت خاتمه ارجاع');
    }
  } catch (e) {
    alert('خطای ارتباط با سرور');
  } finally {
    completingReferralId.value = null;
  }
}

// Archive
async function archiveLetter(letterId: number) {
  if (!confirm('آیا از بایگانی نهایی این نامه اطمینان دارید؟ تمامی ارجاعات فعال باید مختومه شده باشند.')) return;
  try {
    const r = await fetch(`/api/letters/${letterId}/archive`, { method: 'POST' });
    if (r.ok) {
      alert('نامه با موفقیت بایگانی گردید.');
      load();
      selectedLetter.value = null;
    } else {
      const err = await r.json();
      alert(err.error || 'خطا در بایگانی نامه');
    }
  } catch (e) {
    alert('خطا در ثبت اطلاعات');
  }
}

// Delete Letter
async function deleteLetter(letterId: number) {
  if (!confirm('آیا مایل به حذف این نامه هستید؟')) return;
  try {
    const r = await fetch(`/api/letters/${letterId}/delete`, { method: 'POST' });
    if (r.ok) {
      alert('نامه حذف و به زباله‌دان منتقل شد.');
      load();
      selectedLetter.value = null;
    } else {
      alert('خطا در حذف نامه');
    }
  } catch (e) {
    alert('خطا در برقراری ارتباط');
  }
}

// Restore Letter
async function restoreLetter(letterId: number) {
  try {
    const r = await fetch(`/api/letters/${letterId}/restore`, { method: 'POST' });
    if (r.ok) {
      alert('نامه با موفقیت بازیابی شد.');
      load();
      selectedLetter.value = null;
    } else {
      alert('خطا در بازیابی نامه');
    }
  } catch (e) {
    alert('خطا در برقراری ارتباط');
  }
}

// File uploads & downloads
async function uploadAttachment() {
  if (!fileInput.value || !fileInput.value.files || fileInput.value.files.length === 0 || !selectedLetter.value) return;
  const file = fileInput.value.files[0];
  const formData = new FormData();
  formData.append('file', file);

  uploading.value = true;
  try {
    const r = await fetch(`/api/letters/${selectedLetter.value.id}/files`, {
      method: 'POST',
      body: formData,
    });
    if (r.ok) {
      alert('ضمیمه با موفقیت بارگذاری شد.');
      loadLetterFiles(selectedLetter.value.id);
    } else {
      alert('خطا در آپلود ضمیمه');
    }
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function downloadFile(fileId: number, filename: string) {
  window.open(`/api/letters/files/${fileId}?dl=1`, '_blank');
}

// Composition Modal
function openNewModal() {
  editingLetterId.value = null;
  newForm.type = 'internal';
  newForm.departmentPrefix = 'الف';
  newForm.priority = 'normal';
  newForm.classification = 'normal';
  newForm.subject = '';
  newForm.body = '';
  newForm.bodyDocx = '';
  newForm.receivers = [];
  newForm.signers = [];
  resetCenterPicker();
  showNewModal.value = true;
  nextTick(() => letterEditorRef.value?.reset());
}

async function openEditDraft(letter: Letter) {
  if (!canEditLetter(letter)) return;
  editingLetterId.value = letter.id;
  editingLetterStatus.value = letter.status;
  newForm.type = letter.type;
  newForm.departmentPrefix = letter.department_prefix || 'الف';
  newForm.priority = letter.priority;
  newForm.classification = letter.classification;
  newForm.subject = letter.subject;
  newForm.body = letter.body || '';
  newForm.bodyDocx = '';
  newForm.receivers = (letter.receivers || [])
    .filter(r => r.receiver_type === 'user')
    .map(r => r.receiver_id);
  newForm.signers = (letter.signers || []).map(s => s.username);
  resetCenterPicker();

  if (letter.sender_center_key) {
    selectedSenderCenter.value = {
      centerKey: letter.sender_center_key,
      name: letter.sender_external || letter.sender_center_key,
      province: '',
      owner: '',
    };
  }
  if (letter.receiver_center_key) {
    selectedReceiverCenter.value = {
      centerKey: letter.receiver_center_key,
      name: letter.receiver_external || letter.receiver_center_key,
      province: '',
      owner: '',
    };
  }

  showNewModal.value = true;
  await nextTick();

  if (letter.has_docx) {
    try {
      const buf = await fetchLetterDocx(letter.id);
      await letterEditorRef.value?.loadBuffer(buf);
    } catch {
      letterEditorRef.value?.loadFromHtml(letter.body || '');
    }
  } else {
    letterEditorRef.value?.loadFromHtml(letter.body || '');
  }
}

function closeNewModal() {
  showNewModal.value = false;
  editingLetterId.value = null;
  editingLetterStatus.value = 'draft';
  resetCenterPicker();
}

async function syncEditorBody() {
  const editor = letterEditorRef.value;
  if (!editor) return;
  const buf = await editor.exportDocx();
  if (buf) {
    newForm.bodyDocx = arrayBufferToBase64(buf);
    newForm.body = editor.getMarkdown() || editor.getPlainPreview() || newForm.subject.trim();
  }
}

function renderBodyHtml(body: string): string {
  if (!body || !body.trim()) return 'بدون متن';
  const esc = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  let html = esc(body);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function pulseWorkflow() {
  wfAnimating.value = true;
  setTimeout(() => { wfAnimating.value = false; }, 600);
}

function isWorkflowStepClickable(step: WorkflowStep, l: Letter): boolean {
  if (!l || l.is_archived || l.is_deleted) return false;
  if (step.key === 'sign') {
    if (canSignLetter(l)) return true;
    if (l.type === 'outgoing' && l.status === 'pending_action' && isLetterOwner(l)) return true;
  }
  if (step.key === 'followup' && (showFollowupPanel(l) || openReferralsOnSelected.value.length > 0)) return true;
  if (step.key === 'draft' && l.status === 'draft' && isLetterOwner(l)) return true;
  if (step.key === 'archived' && canArchiveLetter(l)) return true;
  return step.active;
}

function workflowStepHint(step: WorkflowStep): string {
  if (step.key === 'sign') {
    if (selectedLetter.value?.status === 'pending_action') return 'ارسال به میز کار امضا';
    return 'رفتن به امضای دیجیتال';
  }
  if (step.key === 'followup') return 'رفتن به پنل پیگیری و ارجاع';
  if (step.key === 'draft') return 'ویرایش پیش‌نویس';
  if (step.key === 'registered') return 'ارسال به میز کار امضا';
  if (step.key === 'archived') return 'بایگانی نامه';
  return step.label;
}

function onWorkflowStepClick(step: WorkflowStep) {
  if (!selectedLetter.value) return;
  const l = selectedLetter.value;
  if (step.key === 'sign') {
    if (canSignLetter(l)) {
      showSignModal.value = true;
      return;
    }
    if (l.type === 'outgoing' && l.status === 'pending_action' && isLetterOwner(l)) {
      approveOutgoingLetter(l);
      return;
    }
  }
  if (step.key === 'followup') {
    scrollToFollowupPanel();
    return;
  }
  if (step.key === 'draft' && l.status === 'draft' && isLetterOwner(l)) {
    openEditDraft(l);
    return;
  }
  if (step.key === 'archived' && canArchiveLetter(l)) {
    archiveLetter(l.id);
    return;
  }
  if (step.active) pulseWorkflow();
}

async function loadSignaturePreview() {
  try {
    const st = await fetch('/api/letters/signature-image/status');
    if (!st.ok) return;
    const meta = await st.json() as { has_image?: boolean };
    if (!meta.has_image) {
      if (signaturePreviewUrl.value) {
        URL.revokeObjectURL(signaturePreviewUrl.value);
        signaturePreviewUrl.value = '';
      }
      return;
    }
    const r = await fetch(`/api/letters/signature-image/${encodeURIComponent(props.username)}`);
    if (r.ok) {
      const blob = await r.blob();
      if (signaturePreviewUrl.value) URL.revokeObjectURL(signaturePreviewUrl.value);
      signaturePreviewUrl.value = URL.createObjectURL(blob);
    }
  } catch {
    /* preview optional */
  }
}

async function uploadSignatureImage(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  sigUploadLoading.value = true;
  try {
    const fd = new FormData();
    fd.append('image', file);
    const r = await fetch('/api/letters/signature-image', { method: 'POST', body: fd });
    if (r.ok) {
      await loadSignaturePreview();
      alert('تصویر امضا ذخیره شد.');
    } else {
      const err = await r.json().catch(() => ({}));
      alert((err as { error?: string }).error || 'خطا در آپلود تصویر امضا');
    }
  } catch {
    alert('خطا در آپلود تصویر امضا');
  } finally {
    sigUploadLoading.value = false;
    input.value = '';
  }
}

async function onLetterSSE(data: { letter_id?: number; by?: string }) {
  if (data.by === props.username) return;
  const prevId = selectedLetter.value?.id;
  await load();
  if (prevId) {
    const found = letters.value.find(l => l.id === prevId);
    if (found) {
      pulseWorkflow();
      await selectLetter(found);
    }
  }
}

async function saveLetter(actionStatus: 'draft' | 'pending', opts?: { preserveStatus?: boolean }) {
  if (!newForm.subject.trim()) {
    alert('موضوع نامه الزامی است.');
    return;
  }
  if (newForm.type === 'incoming' && !selectedSenderCenter.value) {
    alert('انتخاب فرستنده از لیست مراکز CRM الزامی است.');
    return;
  }
  if (newForm.type === 'outgoing' && !selectedReceiverCenter.value) {
    alert('انتخاب گیرنده از لیست مراکز CRM الزامی است.');
    return;
  }
  if (newForm.type === 'outgoing' && newForm.signers.length === 0 && actionStatus === 'pending' && !opts?.preserveStatus) {
    alert('انتخاب حداقل یک امضاکننده برای نامه‌های صادره الزامی است.');
    return;
  }

  await syncEditorBody();

  const payload = {
    type: newForm.type,
    department_prefix: newForm.departmentPrefix,
    priority: newForm.priority,
    classification: newForm.classification,
    subject: newForm.subject,
    body: newForm.body,
    body_docx: newForm.bodyDocx || undefined,
    sender_center_key: selectedSenderCenter.value?.centerKey || undefined,
    receiver_center_key: selectedReceiverCenter.value?.centerKey || undefined,
    sender_external: selectedSenderCenter.value?.name || '',
    receiver_external: selectedReceiverCenter.value?.name || '',
    receivers: newForm.receivers,
    signers: newForm.signers,
    status: opts?.preserveStatus && editingLetterStatus.value ? editingLetterStatus.value : actionStatus,
  };

  const isEdit = editingLetterId.value != null;
  const url = isEdit ? `/api/letters/${editingLetterId.value}` : '/api/letters';
  const method = isEdit ? 'PUT' : 'POST';

  newFormLoading.value = true;
  try {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      const res = await r.json();
      if (opts?.preserveStatus) {
        alert('تغییرات نامه با موفقیت ذخیره شد.');
      } else if (actionStatus === 'draft') {
        alert(isEdit ? 'پیش‌نویس با موفقیت به‌روزرسانی شد.' : 'نامه با موفقیت به عنوان پیش‌نویس ذخیره گردید.');
      } else {
        alert(isEdit ? 'نامه با موفقیت به‌روزرسانی و ثبت شد.' : 'نامه با موفقیت ثبت نهایی شد.');
      }
      closeNewModal();
      load();
      if (res.letter) selectLetter(res.letter);
    } else {
      const err = await r.json();
      alert(err.error || 'خطا در ثبت نامه');
    }
  } catch (e) {
    alert('خطا در برقراری ارتباط با سرور');
  } finally {
    newFormLoading.value = false;
  }
}

// Templates helper
function applyTemplate(event: Event) {
  const select = event.target as HTMLSelectElement;
  const content = select.value;
  if (!content) return;
  letterEditorRef.value?.loadFromHtml(content);
  select.value = '';
}

function isLetterOwner(l: Letter): boolean {
  return l.created_by === props.username || props.isManager;
}

function canEditLetter(l: Letter): boolean {
  if (l.is_deleted) return false;
  if (isSuperAdmin.value) return true;
  return l.status === 'draft' && isLetterOwner(l);
}

function canRegisterInternal(l: Letter): boolean {
  return l.status === 'draft' && (l.type === 'internal' || l.type === 'incoming') && isLetterOwner(l);
}

function canSendToSignDesk(l: Letter): boolean {
  if (l.type !== 'outgoing' || !isLetterOwner(l)) return false;
  if (l.status === 'draft' || l.status === 'pending_action') return true;
  return false;
}

function canSignLetter(l: Letter): boolean {
  return l.status === 'approved_for_sign' && l.my_signer_status === 'pending';
}

function canArchiveLetter(l: Letter): boolean {
  if (l.is_archived || l.is_deleted) return false;
  if (l.status === 'registered' || l.status === 'in_referral') {
    const openRefs = referrals.value.filter(r => r.letter_id === l.id && !r.is_completed);
    return openRefs.length === 0;
  }
  return false;
}

function pendingSignersText(l: Letter): string {
  if (l.type !== 'outgoing' || l.status !== 'approved_for_sign') return '';
  const pending = (l.signers || []).filter(s => s.status !== 'signed');
  if (!pending.length) return '';
  return pending.map(s => s.display_name || s.username).join('، ');
}

function statusDescription(l: Letter): string {
  const stage = workflowStageKey(l);
  if (stage === 'draft') return 'نامه در حالت پیش‌نویس است. پس از تکمیل متن، آن را ثبت نهایی کنید.';
  if (l.status === 'pending_action' && l.type === 'outgoing') {
    return 'نامه ثبت شده اما هنوز به امضاکنندگان ارسال نشده — دکمه «ارسال به میز کار امضا» را بزنید.';
  }
  if (stage === 'sign') {
    if (canSignLetter(l)) return 'این نامه منتظر امضای دیجیتال شماست.';
    return 'نامه در میز کار امضا است و منتظر تایید امضاکنندگان می‌باشد.';
  }
  if (stage === 'registered') return 'نامه ثبت و شماره‌گذاری شده — برای پیگیری، از پنل «پیگیری و ارجاع» همکار را انتخاب کنید.';
  if (stage === 'followup') {
    const mine = referrals.value.filter(r => r.letter_id === l.id && !r.is_completed && r.receiver_id === props.username && r.action_type === 'for_action');
    if (mine.length) return `📨 ${mine.length} ارجاع منتظر اقدام شماست — نتیجه را بنویسید و «خاتمه ارجاع» بزنید.`;
    return 'نامه در مرحله پیگیری است — ارجاع‌های باز را در پنل بالا تکمیل کنید یا ارجاع جدید ثبت کنید.';
  }
  if (stage === 'done') return 'تمام ارجاعات تکمیل شده — آماده بایگانی.';
  if (stage === 'archived') return 'نامه بایگانی شده است.';
  return '';
}

function workflowProgressPct(l: Letter): number {
  const steps = workflowStepsFor(l);
  const doneCount = steps.filter(s => s.done).length;
  const activeCount = steps.filter(s => s.active).length;
  const progress = doneCount + (activeCount ? 0.5 : 0);
  return Math.round((progress / steps.length) * 100);
}

function printLetter(letterId: number) {
  window.open(`/api/letters/${letterId}/print`, '_blank');
}

interface WorkflowStep {
  key: string;
  label: string;
  icon: string;
  active: boolean;
  done: boolean;
  badge?: number;
}

function workflowStageKey(l: Letter): string {
  if (l.is_archived) return 'archived';
  if (l.status === 'draft') return 'draft';
  if (l.status === 'pending_action') return 'sign';
  if (l.status === 'approved_for_sign') return 'sign';
  if (l.status === 'in_referral') return 'followup';
  if (l.status === 'registered') {
    const openRefs = referrals.value.filter(r => r.letter_id === l.id && !r.is_completed && r.action_type === 'for_action');
    if (openRefs.length) return 'followup';
    const allRefs = referrals.value.filter(r => r.letter_id === l.id && r.action_type === 'for_action');
    if (allRefs.length && allRefs.every(r => r.is_completed)) return 'done';
    return 'registered';
  }
  return l.status;
}

function workflowStageLabel(l: Letter): string {
  if (l.is_archived) return '🗄️ بایگانی شده';
  if (l.status === 'draft') return '✏️ پیش‌نویس';
  if (l.status === 'pending_action') return '📤 ثبت شده — نیاز به ارسال به امضا';
  if (l.status === 'approved_for_sign') {
    const pending = (l.signers || []).filter(s => s.status !== 'signed');
    if (canSignLetter(l)) return '✍️ منتظر امضای شما';
    if (pending.length) return `✍️ منتظر امضا (${pending.length} نفر)`;
    return '✍️ در میز کار امضا';
  }
  if (l.status === 'in_referral') return '📨 در پیگیری';
  if (l.status === 'registered') {
    const openRefs = referrals.value.filter(r => r.letter_id === l.id && !r.is_completed);
    if (openRefs.length) return '📨 در پیگیری';
    return '🔢 صادر شده';
  }
  return l.status;
}

function workflowStepsFor(l: Letter): WorkflowStep[] {
  const openFollowups = referrals.value.filter(r => r.letter_id === l.id && !r.is_completed && r.action_type === 'for_action').length;
  const myPendingSign = canSignLetter(l);
  const stage = workflowStageKey(l);
  const isOutgoing = l.type === 'outgoing';

  if (isOutgoing) {
    return [
      { key: 'draft', label: 'پیش‌نویس', icon: '1', active: stage === 'draft', done: stage !== 'draft' },
      { key: 'sign', label: 'میز امضا', icon: '2', active: stage === 'sign', done: ['registered', 'followup', 'done', 'archived'].includes(stage), badge: myPendingSign ? 1 : undefined },
      { key: 'registered', label: 'صدور شماره', icon: '3', active: stage === 'registered', done: ['followup', 'done', 'archived'].includes(stage) },
      { key: 'followup', label: 'پیگیری', icon: '4', active: stage === 'followup', done: ['done', 'archived'].includes(stage), badge: openFollowups || undefined },
      { key: 'done', label: 'تکمیل', icon: '5', active: stage === 'done', done: stage === 'archived' },
      { key: 'archived', label: 'بایگانی', icon: '6', active: stage === 'archived', done: stage === 'archived' },
    ];
  }

  return [
    { key: 'draft', label: 'پیش‌نویس', icon: '1', active: stage === 'draft', done: stage !== 'draft' },
    { key: 'registered', label: 'ثبت و شماره', icon: '2', active: stage === 'registered', done: ['followup', 'done', 'archived'].includes(stage) },
    { key: 'followup', label: 'پیگیری', icon: '3', active: stage === 'followup', done: ['done', 'archived'].includes(stage), badge: openFollowups || undefined },
    { key: 'done', label: 'تکمیل', icon: '4', active: stage === 'done', done: stage === 'archived' },
    { key: 'archived', label: 'بایگانی', icon: '5', active: stage === 'archived', done: stage === 'archived' },
  ];
}

// Label Helpers
function typeLabel(type: string): string {
  if (type === 'incoming') return '📥 وارده';
  if (type === 'outgoing') return '📤 صادره';
  return '🏢 داخلی';
}

function priorityLabel(p: string): string {
  if (p === 'immediate') return '🚨 خیلی فوری';
  if (p === 'high') return '⚡ فوری';
  return 'عادی';
}

function classificationLabel(c: string): string {
  if (c === 'confidential') return '🔒 محرمانه';
  if (c === 'secret') return '🛑 سری';
  return 'عادی';
}

function actionTypeLabel(t: string): string {
  if (t === 'for_signature') return '✍️ ارجاع جهت امضا';
  if (t === 'for_information') return '👁️ ارجاع جهت اطلاع';
  return '📨 ارجاع جهت اقدام';
}

function getUserDisplayName(username: string): string {
  const u = users.value.find(x => x.username === username);
  return u ? u.display_name : username;
}

function formatPersianDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return dateStr;
  }
}

onMounted(() => {
  load();
  (window as unknown as { _lettersOnSSE?: (d: { letter_id?: number; by?: string }) => void })._lettersOnSSE = onLetterSSE;
});

watch(showPinModal, (open) => {
  if (open) loadSignaturePreview();
});

onUnmounted(() => {
  if (signaturePreviewUrl.value) URL.revokeObjectURL(signaturePreviewUrl.value);
  delete (window as unknown as { _lettersOnSSE?: unknown })._lettersOnSSE;
});

defineExpose({ load });
</script>

<style scoped>
.lt-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  height: 100%;
  box-sizing: border-box;
  font-family: inherit;
  background: #f8fafc;
}

/* Stats Summary Cards */
.lt-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.lt-stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-right: 5px solid #cbd5e1;
}
.lt-stat-card:hover, .lt-stat-card.active {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.12);
}
.lt-stat-card.active {
  border-right-width: 8px;
  background: #fdfdfd;
}
.border-action { border-right-color: #6366f1; }
.border-followup { border-right-color: #2563eb; }
.border-sign { border-right-color: #f59e0b; }
.border-drafts { border-right-color: #64748b; }

.lt-stat-hint {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}
.text-followup { color: #2563eb; }

.lt-stat-val {
  font-size: 26px;
  font-weight: 800;
  line-height: 1.2;
}
.text-action { color: #6366f1; }
.text-sign { color: #f59e0b; }
.text-drafts { color: #64748b; }
.text-pin { color: #10b981; }

.lt-stat-lbl {
  font-size: 13px;
  color: #64748b;
  margin-top: 6px;
  font-weight: 700;
}

/* Main Grid */
.lt-grid {
  display: grid;
  grid-template-columns: 390px 1fr;
  gap: 18px;
  min-height: 600px;
}
@media (max-width: 1024px) {
  .lt-grid {
    grid-template-columns: 1fr;
  }
}

.lt-list-col {
  background: #fff;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  gap: 14px;
  border: 1px solid #e2e8f0;
}

.lt-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: stretch;
}
.lt-search-wrap {
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
}
.search-inp {
  padding-left: 38px;
  border-radius: 10px;
  height: 42px;
  width: 100%;
}
.search-icon {
  position: absolute;
  left: 12px;
  color: #94a3b8;
  pointer-events: none;
}
.lt-new-btn {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: #fff;
  border: none;
  height: 38px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  transition: all 0.2s;
  box-shadow: 0 4px 10px rgba(79, 70, 229, 0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 12px;
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  text-align: center;
}
.lt-new-btn:hover {
  background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
  box-shadow: 0 6px 15px rgba(79, 70, 229, 0.3);
}

.lt-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
  align-items: stretch;
}
.lt-toolbar-actions > .lt-new-btn {
  flex: 1 1 100%;
}
.lt-toolbar-actions > .lt-pin-btn {
  flex: 1 1 calc(33.333% - 6px);
  min-width: 88px;
}
.lt-pin-btn {
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #64748b;
  height: 38px;
  padding: 0 8px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
  min-width: 0;
  overflow: hidden;
}
.lt-btn-icon {
  line-height: 1;
  flex-shrink: 0;
}
.lt-btn-text {
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lt-pin-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.lt-nav-groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 4px;
}
.lt-nav-group-label {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.lt-nav-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.lt-chip-btn {
  padding: 8px 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.lt-chip-btn:hover {
  border-color: #cbd5e1;
  color: #475569;
}
.lt-chip-btn.active {
  background: #eef2ff;
  border-color: #6366f1;
  color: #6366f1;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
}

.lt-tab-help {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #1e40af;
  line-height: 1.6;
}

.lt-tab-help {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #1e40af;
  line-height: 1.6;
}
.lt-help-steps {
  margin: 8px 20px 0 0;
  padding: 0;
  line-height: 1.8;
}

.lt-card-action-hint {
  margin-top: 8px;
  padding: 6px 10px;
  background: #fef3c7;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #92400e;
  text-align: center;
}

.lt-completion-guide {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.lt-guide-title {
  font-weight: 800;
  font-size: 14px;
  color: #334155;
  margin-bottom: 12px;
}
.lt-guide-steps-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
@media (max-width: 900px) {
  .lt-guide-steps-row { grid-template-columns: repeat(2, 1fr); }
}
.lt-guide-step {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 8px;
  text-align: center;
  opacity: 0.55;
}
.lt-guide-step.active {
  opacity: 1;
  border-color: #6366f1;
  background: #eef2ff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.12);
}
.lt-guide-step.done {
  opacity: 1;
  border-color: #86efac;
  background: #f0fdf4;
}
.lt-guide-num {
  display: block;
  font-size: 16px;
  font-weight: 800;
  color: #6366f1;
  margin-bottom: 4px;
}
.lt-guide-step.done .lt-guide-num { color: #16a34a; }
.lt-guide-lbl {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  line-height: 1.4;
}
.lt-open-refs-box {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  font-size: 13px;
  color: #9a3412;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.lt-open-ref-tag {
  background: #ffedd5;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}
.lt-ready-archive-box {
  margin-top: 12px;
  padding: 12px;
  background: #ecfdf5;
  border: 1px solid #86efac;
  border-radius: 8px;
  font-size: 13px;
  color: #166534;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.lt-btn-archive-inline {
  margin-right: auto;
}

.lt-my-action-badge {
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
}

.lt-followup-panel {
  background: linear-gradient(180deg, #eff6ff 0%, #fff 100%);
  border: 2px solid #93c5fd;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 16px;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.08);
}
.lt-followup-panel-head h3 {
  margin: 0 0 6px;
  font-size: 17px;
  color: #1e3a8a;
}
.lt-followup-help {
  margin: 0;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
}
.lt-my-actions-block {
  margin-top: 16px;
}
.lt-my-action-card {
  background: #fff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  padding: 14px;
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lt-my-action-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.lt-my-action-type {
  font-weight: 800;
  color: #1d4ed8;
  font-size: 14px;
}
.lt-my-action-from {
  font-size: 12px;
  color: #64748b;
}
.lt-my-action-note {
  background: #f8fafc;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: #334155;
}
.lt-refer-form-prominent {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed #93c5fd;
}
.lt-refer-form-hint {
  margin-top: 12px;
  font-size: 12px;
  color: #64748b;
  background: #f8fafc;
  padding: 10px 12px;
  border-radius: 8px;
}

.lt-btn-refer {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
}
.lt-btn-refer:hover {
  filter: brightness(1.05);
}

.modal-print-tpl {
  width: min(920px, 96vw);
  max-height: 92vh;
}
.print-tpl-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.print-tpl-placeholders {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.print-tpl-ph {
  background: #eef2ff;
  color: #4338ca;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 11px;
  font-family: monospace;
  cursor: pointer;
  user-select: none;
}
.print-tpl-ph:hover {
  background: #e0e7ff;
}
.print-tpl-editor {
  min-height: 360px;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  direction: ltr;
  text-align: left;
  resize: vertical;
}

.lt-tabs-nav {
  display: flex;
  gap: 6px;
  border-bottom: 2px solid #f1f5f9;
  padding-bottom: 6px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.lt-tab-btn {
  padding: 8px 12px;
  background: none;
  border: none;
  font-size: 13px;
  color: #64748b;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  margin-bottom: -8px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}
.lt-tab-btn:hover {
  color: #475569;
}
.lt-tab-btn.active {
  color: #6366f1;
  border-bottom-color: #6366f1;
}
.lt-tab-badge {
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 800;
}

.lt-list-container {
  overflow-y: auto;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lt-item-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.2s;
  background: #ffffff;
}
.lt-item-card:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  transform: scale(1.01);
}
.lt-item-card.active {
  background: #f0f3ff;
  border-color: #6366f1;
}

.lt-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.lt-indicator {
  font-size: 11px;
  font-weight: 800;
  color: #64748b;
}
.lt-badge-type {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 700;
}
.lt-badge-type.internal { background: #f1f5f9; color: #475569; }
.lt-badge-type.incoming { background: #d1fae5; color: #065f46; }
.lt-badge-type.outgoing { background: #dbeafe; color: #1e40af; }

.lt-card-subject {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.5;
  margin-bottom: 8px;
}

.lt-card-meta-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.priority-badge, .classification-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 700;
}
.priority-badge.normal { background: #f1f5f9; color: #475569; }
.priority-badge.high { background: #fef3c7; color: #92400e; }
.priority-badge.immediate { background: #fee2e2; color: #991b1b; }

.classification-badge.normal { background: #f1f5f9; color: #475569; }
.classification-badge.confidential { background: #f3e8ff; color: #6b21a8; }
.classification-badge.secret { background: #fce7f3; color: #9d174d; }

.lt-card-footer {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
  border-top: 1px dashed #f1f5f9;
  padding-top: 6px;
}

/* Right Column Details */
.lt-details-col {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
}

.lt-empty-details {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px;
  text-align: center;
  color: #94a3b8;
  flex: 1;
}
.empty-icon {
  font-size: 72px;
  margin-bottom: 20px;
}

.lt-details-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  max-height: calc(100vh - 220px);
  padding-left: 4px;
}

.lt-details-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 16px;
  gap: 16px;
}

.lt-details-subject {
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 10px 0;
}

.lt-details-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: #64748b;
}
.meta-tag {
  background: #f1f5f9;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 600;
}

.lt-details-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.lt-btn-approve, .lt-btn-sign, .lt-btn-unsign, .lt-btn-archive, .lt-btn-restore, .lt-btn-delete, .lt-btn-print {
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.lt-btn-approve { background: #6366f1; color: #fff; }
.lt-btn-approve:hover { background: #4f46e5; }

.lt-btn-sign { background: #f59e0b; color: #fff; }
.lt-btn-sign:hover { background: #d97706; }

.lt-btn-unsign { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
.lt-btn-unsign:hover { background: #fecaca; }

.lt-btn-archive { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
.lt-btn-archive:hover { background: #d1fae5; }

.lt-btn-restore { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.lt-btn-restore:hover { background: #dbeafe; }

.lt-btn-delete { background: #fff5f5; color: #e11d48; border: 1px solid #ffe4e6; }
.lt-btn-delete:hover { background: #ffe4e6; }

.lt-btn-print { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
.lt-btn-print:hover { background: #e2e8f0; }

/* Status banner */
.lt-status-banner {
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.lt-status-banner.stage-draft { background: #f9fafb; border-color: #d1d5db; }
.lt-status-banner.stage-sign { background: #fffbeb; border-color: #fde68a; }
.lt-status-banner.stage-registered { background: #ecfdf5; border-color: #a7f3d0; }
.lt-status-banner.stage-followup { background: #eff6ff; border-color: #bfdbfe; }
.lt-status-banner.stage-done { background: #f0fdf4; border-color: #bbf7d0; }
.lt-status-banner.stage-archived { background: #f1f5f9; border-color: #cbd5e1; }
.lt-status-chip {
  display: inline-block;
  font-size: 13px;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 4px;
}
.lt-status-desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
}
.lt-status-waiting {
  font-size: 12px;
  color: #b45309;
  background: #fef3c7;
  padding: 6px 12px;
  border-radius: 8px;
  white-space: nowrap;
}

/* Workflow tracker v2 */
.lt-workflow-tracker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
  padding: 20px 12px 12px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  position: relative;
}
.lt-workflow-tracker:has(.wf-step:nth-child(5):last-child) {
  grid-template-columns: repeat(5, 1fr);
}
.lt-workflow-tracker::before {
  content: '';
  position: absolute;
  top: 34px;
  right: 10%;
  left: 10%;
  height: 3px;
  background: #e2e8f0;
  border-radius: 2px;
  z-index: 0;
}
.lt-workflow-tracker::after {
  content: '';
  position: absolute;
  top: 34px;
  right: 10%;
  width: var(--wf-pct, 0%);
  max-width: 80%;
  height: 3px;
  background: linear-gradient(270deg, #6366f1, #22c55e);
  border-radius: 2px;
  z-index: 0;
  transition: width 0.55s cubic-bezier(0.4, 0, 0.2, 1);
}
.lt-workflow-tracker.wf-live::after {
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.45);
}
.wf-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
  min-width: 0;
}
.wf-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 8px;
}
.wf-num {
  font-size: 12px;
  font-weight: 800;
  color: #94a3b8;
}
.wf-step.active .wf-dot {
  border-color: #6366f1;
  background: #6366f1;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
}
.wf-step.active .wf-num { color: #fff; }
.wf-step.done .wf-dot {
  border-color: #22c55e;
  background: #22c55e;
}
.wf-step.done .wf-num { color: #fff; }
.wf-step.pending .wf-dot { background: #f8fafc; }
.wf-step.clickable { cursor: pointer; }
.wf-step.clickable:hover .wf-dot { transform: scale(1.08); box-shadow: 0 2px 8px rgba(99,102,241,.25); }
.wf-step.clickable:hover .wf-label { color: #6366f1; }
.wf-step .wf-dot { transition: transform 0.2s ease, box-shadow 0.2s ease; }
.wf-badge {
  position: absolute;
  top: -6px;
  left: -6px;
  background: #ef4444;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
.wf-label {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-align: center;
  line-height: 1.3;
  max-width: 72px;
}
.wf-step.active .wf-label { color: #6366f1; font-weight: 800; }
.wf-step.done .wf-label { color: #16a34a; }

.wf-stage-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  background: #eef2ff;
  color: #4338ca;
}
.wf-stage-badge.sign, .wf-stage-badge.approved_for_sign { background: #fef3c7; color: #b45309; }
.wf-stage-badge.followup, .wf-stage-badge.in_referral { background: #dbeafe; color: #1d4ed8; }
.wf-stage-badge.done { background: #dcfce7; color: #15803d; }
.wf-stage-badge.archived { background: #f1f5f9; color: #64748b; }
.wf-stage-badge.draft { background: #f3f4f6; color: #6b7280; }

.lt-details-body {
  background: #f8fafc;
  border-radius: 10px;
  padding: 20px;
  border: 1px solid #e2e8f0;
  position: relative;
  z-index: 0;
  isolation: isolate;
}
.lt-editor-wrap {
  position: relative;
  overflow: hidden;
  min-height: 200px;
  max-height: 540px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e2e8f0;
  margin-bottom: 12px;
}
.lt-editor-wrap :deep(.letter-body-editor) {
  overflow: hidden !important;
}
.body-content-html {
  font-size: 14px;
  color: #334155;
  line-height: 1.8;
}
.body-content-html table {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
}
.body-content-html td,
.body-content-html th {
  border: 1px solid #cbd5e1;
  padding: 6px 10px;
}
.body-content-html ul,
.body-content-html ol {
  padding-right: 1.5em;
}
.sig-upload-row { margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0; }
.sig-upload-wrap { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.sig-preview-img { max-height: 48px; max-width: 120px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; background: #fff; }
.sig-upload-hint { font-size: 11px; color: #64748b; margin: 6px 0 0; }

.lt-external-info {
  margin-top: 14px;
  font-size: 12px;
  color: #475569;
  background: #fff;
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  border-radius: 8px;
  display: inline-block;
}

.lt-signers-status, .lt-receivers-list {
  margin-top: 16px;
  border-top: 1px solid #e2e8f0;
  padding-top: 12px;
}
.sub-title {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  margin-bottom: 8px;
}
.signers-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.signer-status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #cbd5e1;
}
.signer-status-badge.signed { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
.signer-status-badge.pending { background: #fffbeb; border-color: #fde68a; color: #b45309; }
.lt-btn-admin-unsign {
  margin-right: auto;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid #fca5a5;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.lt-btn-admin-unsign:hover { background: #fecaca; }

.receivers-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.receiver-tag {
  font-size: 11px;
  font-weight: 600;
  background: #fff;
  border: 1px solid #e2e8f0;
  padding: 4px 8px;
  border-radius: 6px;
  color: #475569;
}

/* Files / Attachments */
.lt-details-files {
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 20px;
  position: relative;
  z-index: 2;
  background: #fff;
  clear: both;
  margin-top: 4px;
}
.no-files {
  font-size: 12px;
  color: #94a3b8;
  padding: 8px 0;
}
.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.file-item {
  display: flex;
  align-items: center;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  gap: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.01);
}
.file-info {
  flex: 1;
  min-width: 0;
}
.file-name {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-size {
  font-size: 10px;
  color: #94a3b8;
}
.file-dl {
  background: #f1f5f9;
  border: none;
  color: #4f46e5;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}
.file-dl:hover {
  background: #e0e7ff;
}

.file-upload-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.hidden-file-input { display: none; }
.lt-btn-secondary {
  background: #fff;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.lt-btn-secondary:hover {
  background: #f8fafc;
}
.upload-progress-text {
  font-size: 12px;
  color: #94a3b8;
}

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 18px;
  position: relative;
  padding-right: 18px;
  margin-bottom: 24px;
}
.timeline::before {
  content: '';
  position: absolute;
  right: 8px;
  top: 10px;
  bottom: 10px;
  width: 2px;
  background: #e2e8f0;
}
.timeline-item {
  display: flex;
  gap: 14px;
  position: relative;
}
.timeline-badge {
  z-index: 1;
  background: #fff;
  font-size: 12px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.timeline-content {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  flex: 1;
  box-shadow: 0 2px 5px rgba(0,0,0,0.01);
}
.timeline-item.completed .timeline-content {
  border-color: #a7f3d0;
  background: #f0fdf4;
}
.timeline-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
}
.timeline-title {
  font-weight: 800;
  color: #1e293b;
}
.timeline-date { color: #94a3b8; }
.timeline-text { font-size: 12px; color: #475569; }
.timeline-note {
  margin-top: 8px;
  background: #fffbeb;
  border: 1px solid #fef3c7;
  color: #b45309;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
}
.timeline-private-note {
  margin-top: 8px;
  background: #faf5ff;
  border: 1px solid #f3e8ff;
  color: #6b21a8;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
}
.timeline-complete-action {
  margin-top: 10px;
  border-top: 1px dashed #cbd5e1;
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.textarea-mini {
  min-height: 50px;
  font-size: 12px;
}
.lt-btn-complete {
  align-self: flex-end;
  background: #10b981;
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.timeline-completion-box {
  margin-top: 10px;
  border-top: 1px solid #a7f3d0;
  padding-top: 8px;
}
.timeline-completion-header {
  font-size: 11px;
  font-weight: 700;
  color: #047857;
  display: flex;
  justify-content: space-between;
}
.timeline-completion-note {
  margin-top: 4px;
  font-size: 12px;
  color: #065f46;
}

.lt-refer-form {
  background: #f8fafc;
  border-radius: 10px;
  padding: 18px;
  border: 1px solid #e2e8f0;
}
.refer-inputs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.refer-row-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

/* Modals & Inputs */
.lt-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  box-sizing: border-box;
  background: #fff;
  color: #1e293b;
  transition: all 0.2s;
}
.lt-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
.lt-input.textarea {
  min-height: 80px;
  resize: vertical;
}

.lt-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lt-modal {
  background: #fff;
  border-radius: 14px;
  width: 650px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid #cbd5e1;
}
.lt-modal.modal-small {
  width: 420px;
}
.lt-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
  font-weight: 800;
  font-size: 14px;
  color: #0f172a;
}
.lt-modal-header button {
  background: none;
  border: none;
  cursor: pointer;
  color: #64748b;
  font-size: 18px;
}
.lt-modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.modal-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.modal-form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.modal-form-row label {
  font-size: 12px;
  font-weight: 800;
  color: #475569;
}
.textarea-modal {
  min-height: 120px;
  resize: vertical;
}
.body-content-loading {
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
}
.letter-editor-row {
  min-height: 500px;
}
.lt-modal-overlay--compose {
  backdrop-filter: none;
  background: rgba(15, 23, 42, 0.72);
}
.lt-modal.modal-compose {
  max-width: min(1100px, 96vw);
  width: 1100px;
  max-height: 94vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.compose-modal-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.compose-form-scroll {
  flex: 0 1 auto;
  max-height: min(38vh, 320px);
  overflow-y: auto;
  border-bottom: 1px solid #e2e8f0;
}
.compose-editor-panel {
  flex: 1;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 20px 16px;
  overflow: visible;
  background: #f8fafc;
}
.compose-editor-label {
  font-size: 12px;
  font-weight: 800;
  color: #475569;
  flex-shrink: 0;
}
.compose-editor-panel .letter-body-editor {
  flex: 1;
  min-height: 380px;
}

.multi-select-wrap {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  max-height: 120px;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #f8fafc;
}
.multi-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.multi-select-item label {
  font-weight: 600;
  cursor: pointer;
}

.lt-modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
}
.lt-btn-cancel {
  background: #e2e8f0;
  color: #334155;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  transition: all 0.2s;
}
.lt-btn-cancel:hover { background: #cbd5e1; }

.lt-btn-save-draft {
  background: #64748b;
  color: #fff;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
}
.lt-btn-save-draft:hover { background: #475569; }

.lt-btn-save {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  transition: opacity 0.15s;
}

.lt-btn-save-sign {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
}

.lt-btn-save-unsign {
  background: #dc2626;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
}

.checkbox-row {
  flex-direction: row !important;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.modal-alert-info {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
}
.modal-alert-warning {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
}

/* Center picker */
.center-picker {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.center-picked {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
}
.center-picked small {
  color: #64748b;
}
.center-clear {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #64748b;
  font-size: 14px;
  padding: 2px 6px;
}
.center-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  max-height: 220px;
  overflow-y: auto;
}
.center-result-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: right;
  font-family: inherit;
  border-bottom: 1px solid #f1f5f9;
}
.center-result-item:hover {
  background: #f8fafc;
}
.center-result-item small {
  color: #64748b;
  font-size: 11px;
}

/* Change history */
.lt-history-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed #e2e8f0;
}
.timeline-badge.history {
  background: #f1f5f9;
  color: #475569;
}

.text-center { text-align: center; }
.font-bold { font-weight: 800; }

.lt-loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  gap: 12px;
  color: #64748b;
}
.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin .7s linear infinite;
}
.lt-empty-state {
  text-align: center;
  padding: 50px;
  color: #94a3b8;
  font-size: 13px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
</style>
