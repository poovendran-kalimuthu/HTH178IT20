import { getPool, getDBStatus } from '../config/db.js';

// Get all items
export const getItems = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database connection is not ready. Check MySQL configuration in server/.env',
        dbStatus: getDBStatus()
      });
    }

    const { status, search } = req.query;
    let query = 'SELECT * FROM items';
    const params = [];
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search && search.trim() !== '') {
      conditions.push('(title LIKE ? OR description LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    next(err);
  }
};

// Get single item by ID
export const getItemById = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// Create a new item
export const createItem = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const { title, description = '', status = 'pending', priority = 'medium' } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO items (title, description, status, priority) VALUES (?, ?, ?, ?)',
      [title.trim(), description.trim(), status, priority]
    );

    const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
};

// Update an item
export const updateItem = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const { id } = req.params;
    const { title, description, status, priority } = req.body;

    // Check if exists
    const [existing] = await pool.query('SELECT * FROM items WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided to update' });
    }

    params.push(id);
    await pool.query(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.query('SELECT * FROM items WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Item updated successfully',
      data: updated[0]
    });
  } catch (err) {
    next(err);
  }
};

// Delete an item
export const deleteItem = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM items WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({
      success: true,
      message: 'Item deleted successfully',
      id: Number(id)
    });
  } catch (err) {
    next(err);
  }
};

// Get stats / metrics
export const getStats = async (req, res, next) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    const [total] = await pool.query('SELECT COUNT(*) as count FROM items');
    const [byStatus] = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM items 
      GROUP BY status
    `);
    const [byPriority] = await pool.query(`
      SELECT priority, COUNT(*) as count 
      FROM items 
      GROUP BY priority
    `);

    res.json({
      success: true,
      data: {
        total: total[0]?.count || 0,
        statusCounts: byStatus.reduce((acc, row) => ({ ...acc, [row.status]: row.count }), {}),
        priorityCounts: byPriority.reduce((acc, row) => ({ ...acc, [row.priority]: row.count }), {})
      }
    });
  } catch (err) {
    next(err);
  }
};
