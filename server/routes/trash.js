'use strict';

const express = require('express');
const { requireAuth, requireManager } = require('../auth');
const { isManagerRole } = require('../lib/roles');
const {
  listTrash,
  getTrashItem,
  restoreTrashItem,
  purgeTrashItem,
  entityLabel,
  SENSITIVE_TYPES,
} = require('../lib/soft-delete');

const router = express.Router();
router.use(requireAuth);

// GET /api/trash — لیست حذف‌شده‌های قابل بازیابی (مدیر)
router.get('/', requireManager, async function (req, res) {
  try {
    const items = await listTrash({
      entityType: req.query.type || null,
      q: req.query.q || req.query.search || null,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ items, count: items.length });
  } catch (e) {
    console.error('[trash GET /]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// GET /api/trash/:id — جزئیات یک رکورد حذف‌شده
router.get('/:id', requireManager, async function (req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'شناسه نامعتبر' });
    const item = await getTrashItem(id);
    if (!item) return res.status(404).json({ error: 'یافت نشد' });
    res.json({
      id: item.id,
      entityType: item.entity_type,
      entityId: item.entity_id,
      centerKey: item.center_key,
      title: item.title,
      label: entityLabel(item.entity_type),
      deletedAt: item.deleted_at,
      deletedBy: item.deleted_by,
      deleteReason: item.delete_reason,
      payload: item.payload,
      sensitive: SENSITIVE_TYPES.has(item.entity_type),
    });
  } catch (e) {
    console.error('[trash GET /:id]', e.message);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// POST /api/trash/:id/restore — بازیابی
router.post('/:id/restore', requireManager, async function (req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'شناسه نامعتبر' });
    const result = await restoreTrashItem(id, req.user.username);
    res.json(result);
  } catch (e) {
    console.error('[trash POST /:id/restore]', e.message);
    res.status(400).json({ error: e.message || 'خطای بازیابی' });
  }
});

// DELETE /api/trash/:id/purge — حذف دائمی (فقط سوپر ادمین / مدیر)
router.delete('/:id/purge', requireManager, async function (req, res) {
  try {
    if (!isManagerRole(req.user.role)) {
      return res.status(403).json({ error: 'فقط مدیر می‌تواند حذف دائمی انجام دهد' });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'شناسه نامعتبر' });
    const result = await purgeTrashItem(id, req.user.username);
    res.json(result);
  } catch (e) {
    console.error('[trash DELETE /:id/purge]', e.message);
    res.status(400).json({ error: e.message || 'خطای حذف دائمی' });
  }
});

module.exports = router;
