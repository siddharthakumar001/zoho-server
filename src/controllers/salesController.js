// controllers/reportControllers.js

import InvoiceModel from "../models/Invoice.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import { zohoGet } from "../services/zohoHelpers.js";

/* ---------------------- utils ---------------------- */

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Parse incoming `date` query into a month prefix + UTC month boundaries.
 * Accepts: "DD-MM-YYYY" or "YYYY-MM-DD" (any day is ignored; month is used)
 * Returns: { year, month, monthStr, datePrefix, start, end } or null
 */
function parseDateToPrefix(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const s = dateStr.trim();

  // DD-MM-YYYY
  let m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (m) {
    const [, , mm, yyyy] = m;
    const year = Number(yyyy);
    const month = Number(mm);
    if (!year || month < 1 || month > 12) return null;
    const monthStr = String(month).padStart(2, "0");
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)); // exclusive
    return { year, month, monthStr, datePrefix: `${year}-${monthStr}`, start, end };
  }

  // YYYY-MM-DD
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const [, yyyy, mm] = m;
    const year = Number(yyyy);
    const month = Number(mm);
    if (!year || month < 1 || month > 12) return null;
    const monthStr = String(month).padStart(2, "0");
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)); // exclusive
    return { year, month, monthStr, datePrefix: `${year}-${monthStr}`, start, end };
  }

  return null;
}


const validateParams = (req) => {
  // Accept both personName and salesperson (back-compat), trim spaces
  const salespersonRaw = (req.query.personName ?? req.query.salesperson ?? "").trim();
  const dateInput = (req.query.date || "").trim();

  // Only date is mandatory
  if (!dateInput) {
    const err = new Error("Missing/invalid query param(s): date");
    err.status = 400;
    throw err;
  }

  const parsed = parseDateToPrefix(dateInput);
  if (!parsed) {
    const err = new Error("Invalid date format. Use DD-MM-YYYY or YYYY-MM-DD.");
    err.status = 400;
    throw err;
  }

  // Treat "", "all", or "*" as "no salesperson filter"
  const isAll = salespersonRaw === "" || /^(all|\*)$/i.test(salespersonRaw);
  const salesperson = isAll ? null : salespersonRaw;

  return { ...parsed, salesperson, isAll };
};

/**
 * Build a case-insensitive, space-tolerant exact regex for salesperson name.
 * e.g. "Bibhas Sinha" => /^\s*Bibhas\s+Sinha\s*$/i
 */
function makeNameRegex(personName) {
  const norm = personName.trim().split(/\s+/).map(escapeRegex).join("\\s+");
  return new RegExp(`^\\s*${norm}\\s*$`, "i");
}

/**
 * Stage to normalize a document's date field into a real Date (dateAsDate).
 * Supports:
 *   - BSON Date
 *   - "YYYY-MM-DD"
 *   - "DD-MM-YYYY"
 */
function buildDateNormalizationStage(field = "date") {
  return {
    $addFields: {
      dateAsDate: {
        $switch: {
          branches: [
            {
              case: { $eq: [{ $type: `$${field}` }, "date"] },
              then: `$${field}`,
            },
            {
              case: {
                $and: [
                  { $eq: [{ $type: `$${field}` }, "string"] },
                  { $regexMatch: { input: `$${field}`, regex: /^\d{4}-\d{2}-\d{2}$/ } },
                ],
              },
              then: { $toDate: `$${field}` },
            },
            {
              case: {
                $and: [
                  { $eq: [{ $type: `$${field}` }, "string"] },
                  { $regexMatch: { input: `$${field}`, regex: /^\d{2}-\d{2}-\d{4}$/ } },
                ],
              },
              then: { $dateFromString: { dateString: `$${field}`, format: "%d-%m-%Y" } },
            },
          ],
          default: null,
        },
      },
    },
  };
}

/**
* Common pagination helper with consistent limits and validation
*/
function getPaginationParams(req, defaultLimit = 10, maxLimit = 100) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(maxLimit, parseInt(req.query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
* Common pagination metadata response helper
*/
function buildPaginationMeta(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
}

/**
* Common facet to paginate + compute count & total in ONE roundtrip with optimized limits.
*/
function buildFacet(page, limit, maxLimit = 100) {
  // Ensure limits are reasonable for performance
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, Math.min(maxLimit, parseInt(limit, 10) || 10));
  const skip = (safePage - 1) * safeLimit;

  return {
    $facet: {
      data: [{ $skip: skip }, { $limit: safeLimit }],
      stats: [
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: {
              $sum: {
                $convert: { input: "$total", to: "double", onNull: 0, onError: 0 },
              },
            },
          },
        },
      ],
    },
  };
}


export const listInvoices = (Invoice = InvoiceModel, PurchaseOrder = PurchaseOrder) =>
  async (req, res, next) => {
    try {
      const { salesperson, start, end, datePrefix } = validateParams(req);

      // NEW: detect admin "All"
      const isAll =
        !salesperson ||
        /^(all|\*)$/i.test(String(salesperson).trim());

      // Only build a name regex if NOT "All"
      const nameRegex = !isAll ? makeNameRegex(salesperson) : null;

      // Get pagination parameters with reasonable defaults
      const { page, limit } = getPaginationParams(req, 10, 50); // Default: 10, Max: 50

      // Base match: month range

      const invoiceMatch = {
        dateAsDate: { $gte: start, $lt: end },
        status: { $nin: ["void", "cancelled", "draft"] },
      };

      // NEW: add salesperson filter only when not "All"
      if (!isAll) {
        invoiceMatch.$or = [
          { salesperson_name: nameRegex },
          { salesperson: nameRegex },
        ];
      }

      // ==== Main paged pipeline with improved pagination ====
      const pipeline = [
        buildDateNormalizationStage('date'),
        { $match: invoiceMatch },
        { $sort: { dateAsDate: -1, _id: -1 } },
        buildFacet(page, limit, 50), // Max 50 items per page for performance
      ];


      const result = await Invoice.aggregate(pipeline);

      // console.log("result check invoice",result[0].length)

      const { data = [], stats = [] } = result[0] || {};
      const meta = stats[0] || { count: 0, total: 0 };
      
      // Build consistent pagination metadata
      const pagination = buildPaginationMeta(page, limit, meta.count);

      // ... (rest of your function stays the same)
      // NOTE: invOverallAgg and invByPiAgg already reuse `invoiceMatch`,
      // so when isAll=true, they automatically aggregate across ALL salespeople.

      // PIs from paged data

      const piNumbers = [...new Set(data.map(d => d.cf_sales_order_number).filter(Boolean))];


      // console.log("piNumberspiNumbers",piNumbers)


      const toAmount = (v) => {
        if (typeof v === 'number') return v;
        if (!v) return 0;
        if (typeof v === 'string') {
          const cleaned = v.replace(/[,\s₹$]/g, '');
          const n = Number(cleaned);
          return Number.isFinite(n) ? n : 0;
        }
        return 0;
      };

      const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

      let piRollup = [];

      let piRollupMap = {};

      let piSummary = [];

      if (piNumbers.length) {
        const [allInvoices, allPOs] = await Promise.all([
          // Invoice.find({ cf_sales_order_number: { $in: piNumbers } }).lean(),
          Invoice.find({
            cf_sales_order_number: { $in: piNumbers },
            status: { $nin: ["void", "cancelled", "draft"] },
            date: { $gte: start.toISOString().slice(0, 10), $lt: end.toISOString().slice(0, 10) },
          }).lean(),
          PurchaseOrder.find({ cf_proforma_invoice_number: { $in: piNumbers } }).lean(),
        ]);

        // console.log("eallInvoicesallInvoices", allInvoices.length)

        // console.log(" start.toISOString().slice(0, 10)",  start.toISOString().slice(0, 10))

        const invMap = {};

        const invSum = {};

        for (const doc of allInvoices) {
          const k = doc.cf_sales_order_number;
          (invMap[k] ||= []).push(doc);
          invSum[k] = (invSum[k] || 0) + toAmount(doc.total);
        }

        const poMap = {};

        const poSum = {};

        for (const doc of allPOs) {
          const k = doc.cf_proforma_invoice_number;
          (poMap[k] ||= []).push(doc);
          poSum[k] = (poSum[k] || 0) + toAmount(doc.total);
        }

        // console.log("poMap",poMap)
        // console.log("poSum",poSum)

        piRollup = piNumbers.map((pi) => {

          const invoices = invMap[pi] || [];

          const pos = poMap[pi] || [];

          const invoiceTotal = round2(invSum[pi] || 0);

          const poTotal = round2(poSum[pi] || 0);

          const firstInv = invoices[0] || {};

          const salespersonName = firstInv.salesperson_name ?? firstInv.salesperson ?? null;

          const customerName = firstInv.customer_name ?? firstInv.customer ?? null;

          const hasInv = invoices.length > 0 && invoiceTotal > 0;

          const hasPO = pos.length > 0 && poTotal > 0;


          // const profit = (hasInv && hasPO) ? round2(invoiceTotal - poTotal) : 0;


          let profit = 0;

          if (hasInv && hasPO) {
            if (poTotal < 5) {
              // special case: minimal PO → 0.5% of invoice total
              profit = round2(invoiceTotal * 0.005);
            } else {
              // normal case
              profit = round2(invoiceTotal - poTotal);
            }
          }

          // const hasInv = invoices.length > 0;
          // const hasPO = pos.length > 0;
          // const profit = (hasInv && hasPO) ? round2(invoiceTotal - poTotal) : 0;


          return {
            pi,
            invoicesByPi: invoices,
            poByPi: pos,
            invoiceCount: invoices.length,
            poCount: pos.length,
            invoiceAmountTotal: invoiceTotal,
            poAmountTotal: poTotal,
            grandTotal: round2(invoiceTotal + poTotal),
            profit,
            salespersonName,
            customerName,
          };
        });

        // console.log("pi roll up check",piRollup)

        piRollupMap = Object.fromEntries(
          piRollup.map((row) => [row.pi, {
            invoicesByPi: row.invoicesByPi,
            poByPi: row.poByPi,
            invoiceCount: row.invoiceCount,
            poCount: row.poCount,
            invoiceAmountTotal: row.invoiceAmountTotal,
            poAmountTotal: row.poAmountTotal,
            grandTotal: row.grandTotal,
            profit: row.profit,
            salespersonName: row.salespersonName,
            customerName: row.customerName,
          }]),
        );

        piSummary = piRollup.map((row) => ({
          pi: row.pi,
          salespersonName: row.salespersonName,
          customerName: row.customerName,
          invoiceTotal: row.invoiceAmountTotal,
          poTotal: row.poAmountTotal,
          difference: row.profit,
        }));

      }

      // ==== OVERALL totals (these already honor isAll via invoiceMatch) ====

      const invOverallAgg = await Invoice.aggregate([
        buildDateNormalizationStage('date'),
        { $match: invoiceMatch },
        {
          $project: {
            pi: '$cf_sales_order_number',
            numTotal: {
              $toDouble: {
                $cond: [
                  { $isNumber: '$total' }, '$total',
                  {
                    $replaceAll: {
                      input: { $replaceAll: { input: { $replaceAll: { input: { $ifNull: ['$total', '0'] }, find: ',', replacement: '' } }, find: '₹', replacement: '' } },
                      find: { $literal: '$' }, replacement: '',
                    },
                  },
                ],
              },
            },
          },
        },
        { $group: { _id: null, invoiceSum: { $sum: '$numTotal' }, piSet: { $addToSet: '$pi' }, invoiceCount: { $sum: 1 } } },
      ]);

      console.log("invOverallAgg",invOverallAgg)

      const overallPiSet = (invOverallAgg[0]?.piSet || []).filter(Boolean);

      const overallInvoiceCount = invOverallAgg[0]?.invoiceCount || 0;

      const invByPiAgg = await Invoice.aggregate([
        buildDateNormalizationStage('date'),
        { $match: invoiceMatch },
        {
          $project: {
            pi: '$cf_sales_order_number',
            numTotal: {
              $toDouble: {
                $cond: [
                  { $isNumber: '$total' }, '$total',
                  {
                    $replaceAll: {
                      input: { $replaceAll: { input: { $replaceAll: { input: { $ifNull: ['$total', '0'] }, find: ',', replacement: '' } }, find: '₹', replacement: '' } },
                      find: { $literal: '$' }, replacement: '',
                    },
                  },
                ],
              },
            },
          },
        },
        { $group: { _id: '$pi', invoiceSum: { $sum: '$numTotal' } } },
      ]);

      const invByPiMap = Object.fromEntries(invByPiAgg.map(r => [r._id, Math.round((r.invoiceSum || 0) * 100) / 100]));

      let overallPoSumPaired = 0;

      let overallPoCount = 0;

      let overallInvoiceSumPaired = 0;

      let overallProfitPaired = 0;

      if (overallPiSet.length) {
        const poOverallAgg = await PurchaseOrder.aggregate([
          { $match: { cf_proforma_invoice_number: { $in: overallPiSet } } },
          {
            $project: {
              pi: '$cf_proforma_invoice_number',
              numTotal: {
                $toDouble: {
                  $cond: [
                    { $isNumber: '$total' }, '$total',
                    {
                      $replaceAll: {
                        input: { $replaceAll: { input: { $replaceAll: { input: { $ifNull: ['$total', '0'] }, find: ',', replacement: '' } }, find: '₹', replacement: '' } },
                        find: { $literal: '$' }, replacement: '',
                      },
                    },
                  ],
                },
              },
            },
          },
          { $group: { _id: '$pi', poSum: { $sum: '$numTotal' }, count: { $sum: 1 } } },
        ]);

        overallPoCount = poOverallAgg.reduce((acc, r) => acc + (r.count || 0), 0);
        const poByPiMap = Object.fromEntries(poOverallAgg.map(r => [r._id, Math.round((r.poSum || 0) * 100) / 100]));

        const pairedPis = Object.keys(invByPiMap).filter(pi => poByPiMap[pi] != null);
        for (const pi of pairedPis) {
          const invSum = invByPiMap[pi];
          const poSum = poByPiMap[pi];
          overallInvoiceSumPaired = Math.round((overallInvoiceSumPaired + invSum) * 100) / 100;
          overallPoSumPaired = Math.round((overallPoSumPaired + poSum) * 100) / 100;
          overallProfitPaired = Math.round((overallProfitPaired + (invSum - poSum)) * 100) / 100;
        }
      }

      const overall = {
        invoiceSum: overallInvoiceSumPaired,
        poSum: overallPoSumPaired,
        profit: overallProfitPaired,
        difference: overallProfitPaired,
        counts: {
          invoices: overallInvoiceCount,
          pos: overallPoCount,
          uniquePIs: overallPiSet.length,
        },
      };

      res.json({
        filters: { month: datePrefix, personName: isAll ? 'all' : salesperson },
        pagination,
        count: meta.count, // Keep for backward compatibility
        total: meta.total, // Keep for backward compatibility
        data,
        piSummary,
        piRollup,
        piRollupMap,
        overall,
      });

    } catch (err) {
      err.status = err.status || 500;
      next(err);
    }
  };



export const listPiSummaryOnly = (Invoice = InvoiceModel, PurchaseOrder = PurchaseOrder) =>
  async (req, res, next) => {
    try {
      const { salesperson, start, end, datePrefix } = validateParams(req);

      // Detect admin "All" exactly like listInvoices
      const isAll =
        !salesperson ||
        /^(all|\*)$/i.test(String(salesperson).trim());

      // Only build a name regex if NOT "All"
      const nameRegex = !isAll ? makeNameRegex(salesperson) : null;

      // Get pagination parameters with reasonable defaults for PI summary
      const { page, limit } = getPaginationParams(req, 25, 100); // Default: 25, Max: 100

      // Base match: month range
      const invoiceMatch = {
        dateAsDate: { $gte: start, $lt: end },
      };

      // Add salesperson filter only when not "All"
      if (!isAll) {
        invoiceMatch.$or = [
          { salesperson_name: nameRegex },
          { salesperson: nameRegex }, // some docs might use this field
        ];
      }

      // ===== Main paged pipeline with improved pagination =====
      const pipeline = [
        buildDateNormalizationStage('date'),
        { $match: invoiceMatch },
        { $sort: { dateAsDate: -1, _id: -1 } },
        buildFacet(page, limit, 100), // Max 100 items for PI summary
      ];

      const result = await Invoice.aggregate(pipeline);
      const { data = [], stats = [] } = result[0] || {};
      const meta = stats[0] || { count: 0, total: 0 };

      // Build consistent pagination metadata
      const pagination = buildPaginationMeta(page, limit, meta.count);

      // ===== Roll up PI summary from the paged data (same approach) =====
      const piNumbers = [...new Set(data.map(d => d.cf_sales_order_number).filter(Boolean))];

      const toAmount = (v) => {
        if (typeof v === 'number') return v;
        if (!v) return 0;
        if (typeof v === 'string') {
          const cleaned = v.replace(/[,\s₹$]/g, '');
          const n = Number(cleaned);
          return Number.isFinite(n) ? n : 0;
        }
        return 0;
      };
      const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

      let piSummary = [];

      if (piNumbers.length) {
        const [allInvoices, allPOs] = await Promise.all([
          // Pull all invoices for the PIs visible in this page
          Invoice.find({ cf_sales_order_number: { $in: piNumbers } }).lean(),
          // Pull all POs for those PIs
          PurchaseOrder.find({ cf_proforma_invoice_number: { $in: piNumbers } }).lean(),
        ]);

        const invSum = {};
        const invFirst = {};
        for (const doc of allInvoices) {
          const k = doc.cf_sales_order_number;
          invSum[k] = (invSum[k] || 0) + toAmount(doc.total);
          if (!invFirst[k]) invFirst[k] = doc; // capture one for names
        }

        const poSum = {};
        for (const doc of allPOs) {
          const k = doc.cf_proforma_invoice_number;
          poSum[k] = (poSum[k] || 0) + toAmount(doc.total);
        }

        piSummary = piNumbers.map((pi) => {
          const invoiceTotal = round2(invSum[pi] || 0);
          const poTotal = round2(poSum[pi] || 0);

          const firstInv = invFirst[pi] || {};
          const salespersonName = firstInv.salesperson_name ?? firstInv.salesperson ?? null;
          const customerName = firstInv.customer_name ?? firstInv.customer ?? null;

          const hasInv = invoiceTotal > 0;
          const hasPO = poTotal > 0;
          const profit = (hasInv && hasPO) ? round2(invoiceTotal - poTotal) : 0;

          return {
            pi,
            salespersonName,
            customerName,
            invoiceTotal,
            poTotal,
            difference: profit, // 0 unless both sides exist
          };
        });
      }

      // ===== Response: Optimized PI Summary with pagination =====
      res.json({
        filters: { month: datePrefix, personName: isAll ? 'all' : salesperson },
        pagination,
        page: pagination.page,     // Keep for backward compatibility
        limit: pagination.limit,   // Keep for backward compatibility
        count: meta.count,         // Keep for backward compatibility
        total: meta.total,         // Keep for backward compatibility
        data: piSummary,           // <-- only piSummary returned
      });
    } catch (err) {
      err.status = err.status || 500;
      next(err);
    }
  };


export const listInvoicesOnly = (Invoice = InvoiceModel) =>
  async (req, res, next) => {
    try {
      // Reuse your existing helper (must accept req and read req.query.date, req.query.salesperson/personName)
      // It should return: { salesperson, start, end, datePrefix }
      const { salesperson, start, end, datePrefix } = validateParams(req);

      // accept either ?personName=... OR ?salesperson=...
      const personName = req.query.personName ?? salesperson;

      // Detect admin "All"
      const isAll = !personName || /^(all|\*)$/i.test(String(personName).trim());

      // Get pagination parameters with reasonable defaults
      const { page, limit, skip } = getPaginationParams(req, 25, 100); // Default: 25, Max: 100

      // --------- Filters ----------
      const match = {
        // month range on normalized date
        dateAsDate: { $gte: start, $lt: end },
      };

      // Salesperson filter (only when not All)
      if (!isAll) {
        const nameRegex = makeNameRegex(personName); // your existing helper
        match.$or = [
          { salesperson_name: nameRegex },
          { salesperson: nameRegex },
        ];
      }

      // Optional search across a few common fields
      const search = (req.query.search || '').toString().trim();
      if (search) {
        const s = new RegExp(escapeRegex(search), 'i');
        match.$and = (match.$and || []).concat([{
          $or: [
            { invoice_number: s },
            { customer_name: s },
            { customer: s },
            { email: s },
          ],
        }]);
      }

      // --------- Aggregation (paged) ----------
      const pipeline = [
        // Ensure we have a proper dateAsDate; reuse your helper
        buildDateNormalizationStage('date'),
        { $match: match },
        { $sort: { dateAsDate: -1, _id: -1 } },

        // Optional: project just the fields the UI needs
        {
          $project: {
            _id: 1,
            invoice_id: 1,
            invoice_number: 1,
            date: 1,
            dateAsDate: 1,
            customer_name: 1,
            customer: 1,
            salesperson_name: 1,
            salesperson: 1,
            status: 1,
            total: 1,
            invoice_url: 1,
          },
        },

        // Count + page
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: limit },
            ],
            stats: [
              { $count: 'count' },
            ],
          },
        },
        {
          $addFields: {
            total: { $ifNull: [{ $arrayElemAt: ['$stats.count', 0] }, 0] },
          },
        },
      ];

      const agg = await Invoice.aggregate(pipeline);
      const doc = agg?.[0] || { data: [], total: 0 };

      const total = Number(doc.total || 0);
      const pagination = buildPaginationMeta(page, limit, total);
      const items = Array.isArray(doc.data) ? doc.data : [];

      // --------- Response (invoices only) with improved pagination ----------
      res.json({
        pagination,
        data: items,
        // Keep backward compatibility
        raw: {
          data: items,
          page,
          limit,
          total,
          pages: pagination.totalPages,
          filters: {
            month: datePrefix,                 // e.g. "2025-08"
            personName: isAll ? 'all' : personName,
            search: search || undefined,
          },
        },
      });
    } catch (err) {
      err.status = err.status || 500;
      next(err);
    }
  };


export const getInvoiceById = (Invoice = InvoiceModel) => async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1) Try DB lookups first
    let doc = await Invoice.findOne({ invoice_id: id }).lean();
    if (!doc && /^[0-9a-fA-F]{24}$/.test(id)) {
      doc = await Invoice.findById(id).lean();
    }

    // 2) If not found in DB, try Zoho (optional fallback)
    if (!doc) {
      try {
        // If your zohoGet wrapper auto-injects orgId, this is enough:
        const zres = await zohoGet(`/invoices/${id}`, req.query);
        doc = zres?.invoice || zres || null;
      } catch (zerr) {
        // Ignore here; we’ll return 404 if nothing found
      }
    }

    if (!doc) {
      return res.status(404).json({ 
        message: 'Invoice not found',
        details: 'Searched by both Zoho ID and MongoDB ObjectId formats',
        searchedId: id,
        idFormat: /^[0-9a-fA-F]{24}$/.test(id) ? 'MongoDB ObjectId' : 'Zoho ID'
      });
    }

    return res.json({ invoice: doc });
  } catch (err) {
    err.status = err.status || 500;
    return next(err);
  }
};

export const getPurchaseOrderById =
  (PurchaseOrderModel = PurchaseOrder) =>
    async (req, res, next) => {
      try {
        const { id } = req.params;

        // 1) Try DB lookups first
        let doc = await PurchaseOrderModel.findOne({ purchaseorder_id: id }).lean();
        if (!doc && /^[0-9a-fA-F]{24}$/.test(id)) {
          doc = await PurchaseOrderModel.findById(id).lean();
        }

        // 2) If not found in DB, try Zoho (optional fallback)
        if (!doc) {
          try {
            const zres = await zohoGet(`/purchaseorders/${id}`, req.query);
            doc = zres?.purchaseorder || zres || null;
          } catch (zerr) {
            // Ignore here; we’ll return 404 if nothing found
          }
        }

        if (!doc) {
          return res.status(404).json({ 
            message: "Purchase order not found",
            details: 'Searched by both Zoho ID and MongoDB ObjectId formats',
            searchedId: id,
            idFormat: /^[0-9a-fA-F]{24}$/.test(id) ? 'MongoDB ObjectId' : 'Zoho ID'
          });
        }

        return res.json({ purchaseorder: doc });
      } catch (err) {
        err.status = err.status || 500;
        return next(err);
      }
    };


export const listPOs = (PurchaseOrder) => async (req, res, next) => {
  try {
    // validateParams requires ?date=YYYY-MM-DD (any day of that month is fine)
    const { salesperson, isAll, start, end, datePrefix } = validateParams(req);

    // Get pagination parameters with reasonable defaults
    const { page, limit, skip } = getPaginationParams(req, 25, 100); // Default: 25, Max: 100

    // Base month range
    const match = { dateAsDate: { $gte: start, $lt: end } };

    // Salesperson filter only if not "All"
    if (!isAll && salesperson) {
      const nameRegex = makeNameRegex(salesperson);
      match.$or = [
        { cf_sales_person: nameRegex },
        { salesperson_name: nameRegex },
        { sales_person: nameRegex },
      ];
    }

    const pipeline = [
      buildDateNormalizationStage("date"),
      { $match: match },
      { $sort: { dateAsDate: -1, _id: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          stats: [{ $count: "count" }],
        },
      },
      {
        $addFields: {
          total: { $ifNull: [{ $arrayElemAt: ["$stats.count", 0] }, 0] },
        },
      },
    ];

    const agg = await PurchaseOrder.aggregate(pipeline);
    const doc = agg?.[0] || { data: [], total: 0 };

    const total = Number(doc.total || 0);
    const pagination = buildPaginationMeta(page, limit, total);

    res.json({
      pagination,
      data: doc.data || [],
      // Keep backward compatibility
      items: doc.data || [],
      page,
      limit,
      total,
      pages: pagination.totalPages,
      filters: {
        month: datePrefix,
        personName: isAll ? "all" : salesperson,
      },
    });
  } catch (err) {
    err.status = err.status || 500;
    next(err);
  }
};




