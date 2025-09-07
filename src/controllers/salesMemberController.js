import SalesMember from '../models/SalesMember.js';

// Utility to safely pick fields for responses
const toPublic = (doc) => {
  if (!doc) return null;
  const {
    _id,
    name,
    email,
    phone,
    monthlyTarget,
    isActive,
    createdAt,
    updatedAt,
    topLine
  } = doc;
  return {
    _id,
    name,
    email,
    phone,
    monthlyTarget,
    topLine,
    
    isActive,
    createdAt,
    updatedAt,
  };
};

// @desc    Create sales member
// @route   POST /api/admin/sales-members
// @access  Admin
export const addSalesMember = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      topLine = null,
      monthlyTarget = null,
      isActive = true,
    } = req.body;


    if (!name?.trim()) throw Object.assign(new Error('Name is required'), { status: 400 });
    if (!email) throw Object.assign(new Error('Email is required'), { status: 400 });
    if (!phone) throw Object.assign(new Error('Phone is required'), { status: 400 });
    if (!password || String(password).length < 6)
      throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });

    // Ensure uniqueness
    const existing = await SalesMember.findOne({ $or: [{ email: email.toLowerCase() }, { phone: String(phone).trim() }] }).lean();
    if (existing) throw Object.assign(new Error('Email or phone already in use'), { status: 409 });

    const doc = await SalesMember.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: String(phone).trim(),
      password,
      topLine: topLine === '' ? null : topLine,
      monthlyTarget: monthlyTarget === '' ? null : monthlyTarget,
      isActive: !!isActive,
    });



    res.status(201).json({ message: 'Sales member created', member: toPublic(doc) });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
};

// @desc    Get a sales member by ID
// @route   GET /api/admin/sales-members/:id
// @access  Admin
export const getSalesMemberById = async (req, res, next) => {
  try {
    const doc = await SalesMember.findById(req.params.id).lean();
    if (!doc) throw Object.assign(new Error('Sales member not found'), { status: 404 });
    res.json({ member: toPublic(doc) });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
};

// @desc    Update sales member
// @route   PUT /api/admin/sales-members/:id
// @access  Admin
export const updateSalesMember = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password, // optional
      monthlyTarget,
      topLine,
      isActive,
    } = req.body;


    const doc = await SalesMember.findById(req.params.id).select('+password');
    if (!doc) throw Object.assign(new Error('Sales member not found'), { status: 404 });

    // If email/phone changed, ensure uniqueness
    if (email && email.toLowerCase().trim() !== doc.email) {
      const exists = await SalesMember.findOne({ email: email.toLowerCase().trim(), _id: { $ne: doc._id } }).lean();
      if (exists) throw Object.assign(new Error('Email already in use'), { status: 409 });
      doc.email = email.toLowerCase().trim();
    }
    if (phone && String(phone).trim() !== doc.phone) {
      const exists = await SalesMember.findOne({ phone: String(phone).trim(), _id: { $ne: doc._id } }).lean();
      if (exists) throw Object.assign(new Error('Phone already in use'), { status: 409 });
      doc.phone = String(phone).trim();
    }

    if (name !== undefined) doc.name = String(name).trim();
    if (monthlyTarget !== undefined) doc.monthlyTarget = monthlyTarget === '' ? null : Number(monthlyTarget);
    if (topLine !== undefined) doc.topLine = topLine === '' ? null : Number(topLine);




    if (isActive !== undefined) doc.isActive = !!isActive;

    if (password) {
      if (String(password).length < 6)
        throw Object.assign(new Error('If changing password, minimum 6 characters'), { status: 400 });
      doc.password = String(password);
    }

    // console.log("request body check", doc)


    await doc.save();

    res.json({ 
      success: true,
      message: 'Sales member updated successfully', 
      data: toPublic(doc.toObject()) 
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
};

// @desc    List sales members with pagination/search/sort
// @route   GET /api/admin/sales-members
// @access  Admin
export const listSalesMembers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '', // name/email/phone
      isActive,    // true/false/undefined
      sortBy = 'createdAt', // createdAt | name | email | joinedAt
      sortOrder = 'desc',    // asc | desc
    } = req.query;

    // Improved pagination with reasonable limits
    const p = Math.max(1, Number(page));
    const l = Math.max(1, Math.min(50, Number(limit))); // Max 50 items per page

    const filter = {};
    if (search) {
      const s = String(search).trim();
      filter.$or = [
        { name: new RegExp(s, 'i') },
        { email: new RegExp(s, 'i') },
        { phone: new RegExp(s, 'i') },
      ];
    }
    if (isActive === 'true' || isActive === 'false') {
      filter.isActive = isActive === 'true';
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [items, count] = await Promise.all([
      SalesMember.find(filter)
        .sort(sort)
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      SalesMember.countDocuments(filter),
    ]);

    // Build consistent pagination metadata
    const totalPages = Math.max(1, Math.ceil(count / l));
    const pagination = {
      page: p,
      limit: l,
      total: count,
      totalPages,
      hasNextPage: p < totalPages,
      hasPrevPage: p > 1
    };

    res.json({
      pagination,
      data: items.map(toPublic),
      // Keep backward compatibility
      page: p,
      limit: l,
      count,
      items: items.map(toPublic),
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
};

// (Optional) Toggle status quickly
// @route   PATCH /api/admin/sales-members/:id/status
export const updateSalesMemberStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const doc = await SalesMember.findByIdAndUpdate(
      req.params.id,
      { isActive: !!isActive },
      { new: true }
    ).lean();
    if (!doc) throw Object.assign(new Error('Sales member not found'), { status: 404 });
    res.json({ message: 'Status updated', member: toPublic(doc) });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
};

// (Optional) Delete
// @route   DELETE /api/admin/sales-members/:id
export const deleteSalesMember = async (req, res, next) => {
  try {
    const doc = await SalesMember.findByIdAndDelete(req.params.id).lean();
    if (!doc) throw Object.assign(new Error('Sales member not found'), { status: 404 });
    res.json({ message: 'Sales member deleted' });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
};
