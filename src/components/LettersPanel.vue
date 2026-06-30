<template>
  <div class="lt-panel animate-fade-in" dir="rtl">
    <!-- TOP NOTIFICATION BADGES / STATS ROW -->
    <div class="lt-stats-row">
      <div class="lt-stat-card border-action" :class="{ active: activeTab === 'pending' }" @click="selectTab('pending')">
        <div class="lt-stat-val text-action">{{ statPendingCount }}</div>
        <div class="lt-stat-lbl">⏳ کارتابل من (اقدام لازم)</div>
      </div>
      <div class="lt-stat-card border-sign" :class="{ active: activeTab === 'sign_desk' }" @click="selectTab('sign_desk')">
        <div class="lt-stat-val text-sign">{{ statSignDeskCount }}</div>
        <div class="lt-stat-lbl">✍️ میز کار امضا</div>
      </div>
      <div class="lt-stat-card border-drafts" :class="{ active: activeTab === 'drafts' }" @click="selectTab('drafts')">
        <div class="lt-stat-val text-drafts">{{ statDraftsCount }}</div>
        <div class="lt-stat-lbl">✏️ پیش‌نویس‌ها</div>
      </div>
      <div class="lt-stat-card border-pin" @click="showPinModal = true">
        <div class="lt-stat-val text-pin">⚙️</div>
        <div class="lt-stat-lbl">تغییر پین‌کد امضا</div>
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
          <button class="lt-new-btn" @click="openNewModal">➕ ثبت نامه جدید</button>
        </div>

        <div class="lt-tabs-nav">
          <button
            v-for="t in TABS"
            :key="t.key"
            :class="['lt-tab-btn', { active: activeTab === t.key }]"
            @click="selectTab(t.key)"
          >
            <span class="tab-label">{{ t.label }}</span>
            <span v-if="tabBadge(t.key) > 0" class="lt-tab-badge">{{ tabBadge(t.key) }}</span>
          </button>
        </div>

        <div v-if="loading" class="lt-loading-spinner">
          <div class="spinner"></div>
          <span>در حال بارگذاری نامه‌ها...</span>
        </div>

        <div v-else-if="filteredLetters.length === 0" class="lt-empty-state">
          <span>📭 نامه‌ای یافت نشد</span>
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
              <span class="priority-badge" :class="l.priority">{{ priorityLabel(l.priority) }}</span>
              <span class="classification-badge" :class="l.classification">{{ classificationLabel(l.classification) }}</span>
            </div>
            <div class="lt-card-footer">
              <span class="lt-creator">👤 {{ l.creator_name || l.created_by }}</span>
              <span class="lt-date">📅 {{ formatPersianDate(l.created_at) }}</span>
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
              <!-- Action: Register & Issue Indicator (for draft internal/incoming) -->
              <button
                v-if="selectedLetter.status === 'draft' && (selectedLetter.type === 'internal' || selectedLetter.type === 'incoming') && (selectedLetter.created_by === username || isManager)"
                class="lt-btn-approve"
                @click="approveInternalLetter(selectedLetter)"
              >
                📝 ثبت نهایی و صدور شماره اندیکاتور
              </button>

              <!-- Action: Send for Signature (for draft outgoing) -->
              <button
                v-if="selectedLetter.status === 'draft' && selectedLetter.type === 'outgoing' && (selectedLetter.created_by === username || isManager)"
                class="lt-btn-approve"
                @click="approveOutgoingLetter(selectedLetter)"
              >
                ✍️ ارسال به میز کار امضا
              </button>

              <!-- Action: Digital Signature / PIN Verification Modal -->
              <button
                v-if="selectedLetter.status === 'approved_for_sign' && selectedLetter.my_signer_status === 'pending'"
                class="lt-btn-sign"
                @click="openSignModal"
              >
                🖋️ تایید و امضای دیجیتال نامه
              </button>

              <!-- Action: Cancel Signature -->
              <button
                v-if="selectedLetter.status === 'approved_for_sign' && selectedLetter.my_signer_status === 'signed'"
                class="lt-btn-unsign"
                @click="openUnsignModal"
              >
                🚫 لغو امضای من
              </button>

              <!-- Action: Archive (only for registered active letters) -->
              <button
                v-if="selectedLetter.status === 'registered' && !selectedLetter.is_archived && !selectedLetter.is_deleted"
                class="lt-btn-archive"
                @click="archiveLetter(selectedLetter.id)"
              >
                🗄️ بایگانی نامه و اتمام اقدام
              </button>

              <!-- Action: Restore from Trash -->
              <button
                v-if="selectedLetter.is_deleted"
                class="lt-btn-restore"
                @click="restoreLetter(selectedLetter.id)"
              >
                ♻️ بازیابی از زباله‌دان
              </button>

              <!-- Action: Delete Draft / Trash -->
              <button
                v-if="!selectedLetter.is_deleted && (selectedLetter.status === 'draft' || isManager)"
                class="lt-btn-delete"
                @click="deleteLetter(selectedLetter.id)"
              >
                🗑️ حذف نامه
              </button>
            </div>
          </div>

          <!-- Letter Body HTML Content -->
          <div class="lt-details-body">
            <div class="section-title">📝 متن نامه / خلاصه موضوع:</div>
            <div class="body-content-html" v-html="selectedLetter.body || 'بدون متن'"></div>

            <!-- External Info -->
            <div v-if="selectedLetter.sender_external" class="lt-external-info">
              🚪 <strong>فرستنده خارجی:</strong> {{ selectedLetter.sender_external }}
            </div>
            <div v-if="selectedLetter.receiver_external" class="lt-external-info">
              🚪 <strong>گیرنده خارجی:</strong> {{ selectedLetter.receiver_external }}
            </div>

            <!-- Signers Status Grid (for outgoing letters) -->
            <div v-if="selectedLetter.type === 'outgoing' && selectedLetter.signers && selectedLetter.signers.length > 0" class="lt-signers-status">
              <div class="sub-title">🖋️ وضعیت امضاکنندگان:</div>
              <div class="signers-list">
                <div v-for="s in selectedLetter.signers" :key="s.username" class="signer-status-badge" :class="s.status">
                  <span class="signer-name">{{ s.display_name }}</span>
                  <span class="signer-val">{{ s.status === 'signed' ? '✅ امضا شده' : '⏳ در انتظار امضا' }}</span>
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

                  <!-- Action: Complete referral directed to current user -->
                  <div v-if="!ref.is_completed && ref.receiver_id === username" class="timeline-complete-action">
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

            <!-- Compose Referral Form -->
            <div v-if="selectedLetter.status === 'registered' && !selectedLetter.is_archived && !selectedLetter.is_deleted" class="lt-refer-form">
              <div class="section-title">✍️ ارجاع یا پیگیری جدید:</div>
              <div class="refer-inputs">
                <div class="refer-row-grid">
                  <select v-model="referForm.receiverId" class="lt-input">
                    <option value="">انتخاب گیرنده ارجاع... *</option>
                    <option v-for="u in users" :key="u.username" :value="u.username">
                      {{ u.display_name }} ({{ u.role }})
                    </option>
                  </select>
                  <select v-model="referForm.actionType" class="lt-input">
                    <option value="for_action">جهت اقدام و پیگیری</option>
                    <option value="for_information">جهت اطلاع</option>
                    <option value="for_signature">جهت امضا و تایید</option>
                  </select>
                </div>
                <textarea
                  v-model="referForm.note"
                  placeholder="دستور اقدام، یادداشت پیگیری یا پاسخ خود را بنویسید..."
                  class="lt-input textarea"
                ></textarea>
                <textarea
                  v-model="referForm.privateNote"
                  placeholder="یادداشت محرمانه/خصوصی (فقط برای فرستنده و گیرنده ارجاع نمایش داده می‌شود)"
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
        </div>
      </div>
    </div>

    <!-- NEW LETTER MODAL -->
    <div v-if="showNewModal" class="lt-modal-overlay" @click.self="closeNewModal">
      <div class="lt-modal" dir="rtl">
        <div class="lt-modal-header">
          <span>ثبت نامه اداری جدید</span>
          <button @click="closeNewModal">✕</button>
        </div>
        <div class="lt-modal-body">
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

          <!-- Dynamic external fields -->
          <div v-if="newForm.type === 'incoming'" class="modal-form-row">
            <label>فرستنده خارجی (مبدا) *</label>
            <input v-model="newForm.senderExternal" placeholder="مثال: بیمارستان شهید بهشتی / شرکت مهندسی فرادیس" class="lt-input" />
          </div>

          <div v-if="newForm.type === 'outgoing'" class="modal-form-row">
            <label>گیرنده خارجی (مقصد) *</label>
            <input v-model="newForm.receiverExternal" placeholder="مثال: دانشگاه علوم پزشکی گیلان / دکتر احمدی" class="lt-input" />
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

          <div class="modal-form-row">
            <label>متن نامه اداری</label>
            <textarea id="letter-body-editor" class="lt-input textarea-modal"></textarea>
          </div>
        </div>
        <div class="lt-modal-footer">
          <button class="lt-btn-cancel" @click="closeNewModal">انصراف</button>
          <button class="lt-btn-save-draft" :disabled="!newForm.subject.trim() || newFormLoading" @click="saveLetter('draft')">
            💾 ذخیره به عنوان پیش‌نویس
          </button>
          <button class="lt-btn-save" :disabled="!newForm.subject.trim() || newFormLoading" @click="saveLetter('pending')">
            🚀 ثبت نهایی / ارسال جهت اقدام
          </button>
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
        </div>
        <div class="lt-modal-footer">
          <button class="lt-btn-cancel" @click="showPinModal = false">انصراف</button>
          <button class="lt-btn-save" :disabled="!pinForm.currentPin || !pinForm.newPin || pinFormLoading" @click="updatePinCode">
            ثبت پین‌کد جدید
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch, nextTick, onBeforeUnmount } from 'vue';

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

interface Letter {
  id: number;
  indicator_number: string;
  subject: string;
  body: string;
  type: 'incoming' | 'outgoing' | 'internal';
  status: 'draft' | 'pending_action' | 'approved_for_sign' | 'registered' | 'archived';
  priority: 'normal' | 'high' | 'immediate';
  classification: 'normal' | 'confidential' | 'secret';
  department_prefix: string;
  sender_external: string;
  receiver_external: string;
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

const TABS = [
  { key: 'pending', label: '⏳ کارتابل من' },
  { key: 'sign_desk', label: '✍️ میز کار امضا' },
  { key: 'incoming', label: '📥 نامه‌های وارده' },
  { key: 'outgoing', label: '📤 نامه‌های صادره' },
  { key: 'internal', label: '🏢 نامه‌های داخلی' },
  { key: 'drafts', label: '✏️ پیش‌نویس‌ها' },
  { key: 'archived', label: '🗄️ بایگانی شده' },
  { key: 'trash', label: '🗑️ زباله‌دان' },
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
const newFormLoading = ref(false);
const newForm = reactive({
  type: 'internal' as 'incoming' | 'outgoing' | 'internal',
  departmentPrefix: 'الف',
  priority: 'normal' as 'normal' | 'high' | 'immediate',
  classification: 'normal' as 'normal' | 'confidential' | 'secret',
  subject: '',
  body: '',
  senderExternal: '',
  receiverExternal: '',
  receivers: [] as string[],
  signers: [] as string[],
});

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
const pinFormLoading = ref(false);
const pinForm = reactive({
  currentPin: '',
  newPin: '',
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
    if (l.is_deleted || l.status === 'draft') return false;
    return referrals.value.some(r => r.letter_id === l.id && r.receiver_id === props.username && r.action_type === 'for_signature' && !r.is_completed);
  }).length;
});

const statDraftsCount = computed(() => {
  return letters.value.filter(l => l.status === 'draft' && !l.is_deleted).length;
});

function tabBadge(key: string): number {
  if (key === 'pending') return statPendingCount.value;
  if (key === 'sign_desk') return statSignDeskCount.value;
  if (key === 'drafts') return statDraftsCount.value;
  return 0;
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
  referForm.receiverId = '';
  referForm.note = '';
  referForm.privateNote = '';
  referForm.actionType = 'for_action';
  
  loadLetterFiles(l.id);
  loadLetterReferrals(l.id);
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
  if (!confirm('آیا می‌خواهید این نامه صادره را جهت امضا و تایید برای امضاکنندگان ارسال کنید؟')) return;
  try {
    const r = await fetch(`/api/letters/${letter.id}/approve-outgoing`, { method: 'POST' });
    if (r.ok) {
      alert('نامه با موفقیت به میز کار امضاکنندگان منتقل شد.');
      load();
      selectedLetter.value = null;
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
      load();
      selectedLetter.value = null;
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

// Update Signature Pin Code
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
      loadLetterReferrals(selectedLetter.value.id);
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
        loadLetterReferrals(selectedLetter.value.id);
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
  newForm.type = 'internal';
  newForm.departmentPrefix = 'الف';
  newForm.priority = 'normal';
  newForm.classification = 'normal';
  newForm.subject = '';
  newForm.body = '';
  newForm.senderExternal = '';
  newForm.receiverExternal = '';
  newForm.receivers = [];
  newForm.signers = [];
  showNewModal.value = true;
}

function closeNewModal() {
  showNewModal.value = false;
}

async function saveLetter(actionStatus: 'draft' | 'pending') {
  if (!newForm.subject.trim()) {
    alert('موضوع نامه الزامی است.');
    return;
  }
  if (newForm.type === 'outgoing' && newForm.signers.length === 0 && actionStatus === 'pending') {
    alert('انتخاب حداقل یک امضاکننده برای نامه‌های صادره الزامی است.');
    return;
  }

  newFormLoading.value = true;
  try {
    const r = await fetch('/api/letters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: newForm.type,
        department_prefix: newForm.departmentPrefix,
        priority: newForm.priority,
        classification: newForm.classification,
        subject: newForm.subject,
        body: newForm.body,
        sender_external: newForm.senderExternal,
        receiver_external: newForm.receiverExternal,
        receivers: newForm.receivers,
        signers: newForm.signers,
        status: actionStatus,
      }),
    });
    if (r.ok) {
      const res = await r.json();
      if (actionStatus === 'draft') {
        alert('نامه با موفقیت به عنوان پیش‌نویس ذخیره گردید.');
      } else {
        alert('نامه با موفقیت ثبت نهایی شد.');
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
function applyTemplate(event: any) {
  const content = event.target.value;
  if (!content) return;
  newForm.body = content;
  if ((window as any).tinymce) {
    const editor = (window as any).tinymce.get('letter-body-editor');
    if (editor) editor.setContent(content);
  }
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

// TinyMCE editor initialization in modal
watch(showNewModal, (newVal) => {
  if (newVal) {
    nextTick(() => {
      if ((window as any).tinymce) {
        (window as any).tinymce.init({
          selector: '#letter-body-editor',
          height: 250,
          directionality: 'rtl',
          language: 'fa',
          plugins: 'directionality link table lists code',
          toolbar: 'undo redo | blocks | bold italic forecolor backcolor | ltr rtl | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | code',
          setup: (editor: any) => {
            editor.on('change keyup', () => {
              newForm.body = editor.getContent();
            });
          }
        });
      }
    });
  } else {
    if ((window as any).tinymce) {
      (window as any).tinymce.remove('#letter-body-editor');
    }
  }
});

onBeforeUnmount(() => {
  if ((window as any).tinymce) {
    (window as any).tinymce.remove('#letter-body-editor');
  }
});

onMounted(() => {
  load();
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
.border-sign { border-right-color: #f59e0b; }
.border-drafts { border-right-color: #64748b; }
.border-pin { border-right-color: #10b981; }

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
}
.lt-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.search-inp {
  padding-left: 38px;
  border-radius: 10px;
  height: 42px;
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
  height: 42px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  transition: all 0.2s;
  box-shadow: 0 4px 10px rgba(79, 70, 229, 0.2);
}
.lt-new-btn:hover {
  background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
  box-shadow: 0 6px 15px rgba(79, 70, 229, 0.3);
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

.lt-btn-approve, .lt-btn-sign, .lt-btn-unsign, .lt-btn-archive, .lt-btn-restore, .lt-btn-delete {
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

.lt-details-body {
  background: #f8fafc;
  border-radius: 10px;
  padding: 20px;
  border: 1px solid #e2e8f0;
}
.body-content-html {
  font-size: 14px;
  color: #334155;
  line-height: 1.8;
}

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
