import { Router } from "express";
import {
  getInvoiceById,
  getPurchaseOrderById,
  listInvoices,
  listInvoicesOnly,
  listPiSummaryOnly,
  listPOs,
} from "../controllers/salesController.js";
import Invoice from "../models/Invoice.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import { backfillAll } from "../services/zohoBooksBackfillAll.js";
import {
  addSalesMember,
  deleteSalesMember,
  getSalesMemberById,
  listSalesMembers,
  updateSalesMember,
  updateSalesMemberStatus,
} from "../controllers/salesMemberController.js";

// NEW: Sales auth (single-token) imports
import {
  loginSales,
  logoutSales,
  meSales,
} from "../controllers/salesAuthController.js";
import { requireSalesAuth } from "../middlewares/salesAuth.js";

const router = Router();

/* ---------------- Sales Auth Routes (NEW) ---------------- */
// Base: /api/sales/auth
router.post("/api/sales/auth/login", loginSales);
router.post("/api/sales/auth/logout", logoutSales);
router.get("/api/sales/auth/me", requireSalesAuth, meSales);

/* ---------------- Protected Data Routes ---------------- */
// Read routes (serve from DB; no Zoho calls here) - ALL REQUIRE AUTH
router.get("/api/invoices", requireSalesAuth, listInvoices(Invoice, PurchaseOrder));
router.get("/api/invoices-only", requireSalesAuth, listInvoicesOnly(Invoice));
router.get("/api/pi-summary", requireSalesAuth, listPiSummaryOnly(Invoice, PurchaseOrder));
router.get("/api/purchaseorders", requireSalesAuth, listPOs(PurchaseOrder));
router.get("/api/invoices/:id", requireSalesAuth, getInvoiceById(Invoice));
router.get("/api/purchaseorders/:id", requireSalesAuth, getPurchaseOrderById(PurchaseOrder));

/* Admin backfill - REQUIRES AUTH */
router.post("/api/admin/zoho/backfill-all", requireSalesAuth, async (req, res) => {
  try {
    const result = await backfillAll();
    res.json({ status: "OK", ...result });
  } catch (error) {
    console.error("Backfill error:", error);
    res.status(500).json({ 
      status: "ERROR", 
      message: error?.message || String(error) 
    });
  }
});

/* ---------------- Sales Member routes - ALL REQUIRE AUTH ---------------- */
// Base: /api/admin/sales-members
router
  .route("/api/admin/sales-members")
  .get(requireSalesAuth, listSalesMembers)
  .post(requireSalesAuth, addSalesMember);

router
  .route("/api/admin/sales-members/:id")
  .get(requireSalesAuth, getSalesMemberById)
  .put(requireSalesAuth, updateSalesMember)
  .delete(requireSalesAuth, deleteSalesMember);

// Quick status toggle
router.patch("/api/admin/sales-members/:id/status", requireSalesAuth, updateSalesMemberStatus);

export default router;