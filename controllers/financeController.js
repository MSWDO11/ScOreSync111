import { db } from "../models/firebaseConfig.js";
import {
  collection, addDoc, getDocs, getDoc, doc,
  deleteDoc, serverTimestamp,
} from "firebase/firestore";

const EVENTS = "events";

// ─── Add income/expense entry ─────────────────────────────────────────────────
export const storeFinanceEntry = async (req, res) => {
  const { eventId } = req.params;
  const { type, category, description, amount } = req.body;
  try {
    if (!type || !amount || isNaN(Number(amount))) {
      req.flash("error_msg", "Type and a valid amount are required.");
      return res.redirect(`/events/${eventId}`);
    }
    await addDoc(collection(db, EVENTS, eventId, "finance"), {
      type:        type,                        // "income" | "expense"
      category:    category    || "other",
      description: description || "",
      amount:      parseFloat(Number(amount).toFixed(2)),
      createdBy:   req.session.userId,
      createdAt:   serverTimestamp(),
    });
    req.flash("success_msg", `${type === "income" ? "Income" : "Expense"} entry of ₱${Number(amount).toLocaleString()} added.`);
    res.redirect(`/events/${eventId}#finance`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to save entry. " + err.message);
    res.redirect(`/events/${eventId}`);
  }
};

// ─── Delete finance entry ─────────────────────────────────────────────────────
export const deleteFinanceEntry = async (req, res) => {
  const { eventId, entryId } = req.params;
  try {
    await deleteDoc(doc(db, EVENTS, eventId, "finance", entryId));
    req.flash("success_msg", "Entry removed.");
    res.redirect(`/events/${eventId}#finance`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to delete entry.");
    res.redirect(`/events/${eventId}`);
  }
};

// ─── Helper: fetch + summarise finance for an event ──────────────────────────
export async function getFinanceSummary(eventId) {
  try {
    const snap = await getDocs(collection(db, EVENTS, eventId, "finance"));
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Sort newest first (in JS — avoids composite index)
    entries.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

    const totalIncome  = entries.filter(e => e.type === "income") .reduce((s, e) => s + (e.amount || 0), 0);
    const totalExpense = entries.filter(e => e.type === "expense").reduce((s, e) => s + (e.amount || 0), 0);
    const netBalance   = totalIncome - totalExpense;

    return {
      entries,
      totalIncome:  totalIncome .toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      netBalance:   netBalance  .toFixed(2),
      isProfit:     netBalance >= 0,
    };
  } catch {
    return { entries: [], totalIncome: "0.00", totalExpense: "0.00", netBalance: "0.00", isProfit: true };
  }
}
