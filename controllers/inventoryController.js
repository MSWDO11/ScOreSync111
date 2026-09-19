import { db } from "../models/firebaseConfig.js";
import {
  collection, addDoc, getDocs, getDoc, doc,
  updateDoc, deleteDoc, query, orderBy, where, serverTimestamp,
} from "firebase/firestore";

const INVENTORY = "inventory";
const EVENTS    = "events";

// ─── Helper: fetch all events for the dropdown ────────────────────────────────
async function getEvents() {
  const snap = await getDocs(query(collection(db, EVENTS), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── List inventory (optionally filter by eventId) ───────────────────────────
export const listInventory = async (req, res) => {
  try {
    const { eventId } = req.query;
    const events = await getEvents();

    let items = [];
    if (eventId) {
      const q = query(
        collection(db, INVENTORY),
        where("eventId", "==", eventId),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      const q = query(collection(db, INVENTORY), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // Attach event name to each item
    const eventMap = Object.fromEntries(events.map(e => [e.id, e.name]));
    items = items.map(item => ({
      ...item,
      eventName: eventMap[item.eventId] || "—",
    }));

    // Find selected event
    const selectedEvent = eventId ? events.find(e => e.id === eventId) : null;

    res.render("inventory/index", {
      title:         "Inventory",
      items,
      events,
      selectedEvent: selectedEvent || null,
      filterEventId: eventId || "",
      userName:      req.session.userName,
      userRole:      req.session.userRole,
      userInitial:   (req.session.userName || "U")[0].toUpperCase(),
      isAdmin:       req.session.userRole === "admin",
      isJudge:       req.session.userRole === "judge",
      isEncoder:     req.session.userRole === "encoder",
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Could not load inventory.");
    res.redirect("/dashboard");
  }
};

// ─── Add inventory item ───────────────────────────────────────────────────────
export const storeInventoryItem = async (req, res) => {
  const { eventId, name, category, quantity, unit, condition, notes } = req.body;
  try {
    if (!eventId || !name) {
      req.flash("error_msg", "Event and item name are required.");
      return res.redirect("/inventory");
    }
    await addDoc(collection(db, INVENTORY), {
      eventId:   eventId,
      name:      name.trim(),
      category:  category  || "general",
      quantity:  Number(quantity) || 1,
      unit:      unit      || "pcs",
      condition: condition || "good",
      notes:     notes     || "",
      createdBy: req.session.userId,
      createdAt: serverTimestamp(),
    });
    req.flash("success_msg", `Item "${name}" added to inventory.`);
    res.redirect(`/inventory?eventId=${eventId}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to add item. " + err.message);
    res.redirect("/inventory");
  }
};

// ─── Update inventory item ────────────────────────────────────────────────────
export const updateInventoryItem = async (req, res) => {
  const { name, category, quantity, unit, condition, notes, eventId } = req.body;
  try {
    await updateDoc(doc(db, INVENTORY, req.params.id), {
      name:      name.trim(),
      category:  category  || "general",
      quantity:  Number(quantity) || 1,
      unit:      unit      || "pcs",
      condition: condition || "good",
      notes:     notes     || "",
    });
    req.flash("success_msg", `Item "${name}" updated.`);
    res.redirect(`/inventory?eventId=${eventId}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to update item.");
    res.redirect("/inventory");
  }
};

// ─── Delete inventory item ────────────────────────────────────────────────────
export const deleteInventoryItem = async (req, res) => {
  const { eventId } = req.body;
  try {
    await deleteDoc(doc(db, INVENTORY, req.params.id));
    req.flash("success_msg", "Item removed from inventory.");
    res.redirect(`/inventory?eventId=${eventId || ""}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Failed to delete item.");
    res.redirect("/inventory");
  }
};
