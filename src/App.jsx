import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Search, X, ArrowLeft, Trash2, Pencil, BookOpen, Check, Smartphone, Copy } from "lucide-react";
import { db } from "./firebase.js";
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

/* ---------------------------------------------------------------------- */
/* Config                                                                  */
/* ---------------------------------------------------------------------- */

const STORAGE_KEY = "bookshelf:data";
const CODE_KEY = "bookshelf:syncCode";

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars (0/O, 1/I)
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const PALETTE = [
  { bg: "#DCE8DF", fg: "#4F6D58", name: "เซจ" },
  { bg: "#DCE6EE", fg: "#48657D", name: "ฟ้าฝุ่น" },
  { bg: "#F0DEDC", fg: "#8C5A54", name: "โรสฝุ่น" },
  { bg: "#EFE4CB", fg: "#8A6D2C", name: "ทราย" },
  { bg: "#E4DCEE", fg: "#6E5A87", name: "ลาเวนเดอร์" },
  { bg: "#DCEAE6", fg: "#3F7A6B", name: "มินต์" },
];

const TYPES = [
  { key: "manga", label: "มังงะ", bg: "#DCEBE0", fg: "#3F7A57" },
  { key: "novel", label: "นิยาย", bg: "#DCE6EE", fg: "#3F5E85" },
];
const typeOf = (key) => TYPES.find((t) => t.key === key) || TYPES[0];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function hashTone(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const i = Math.abs(hash) % PALETTE.length;
  return PALETTE[i];
}

function seedData() {
  const collections = [
    { id: "c1", name: "Luckpim", colorIndex: 0 },
    { id: "c2", name: "First Page Pro", colorIndex: 1 },
    { id: "c3", name: "Siam Inter", colorIndex: 2 },
    { id: "c4", name: "Phoenix Next", colorIndex: 3 },
    { id: "c5", name: "Animag", colorIndex: 4 },
    { id: "c6", name: "Zenshu", colorIndex: 5 },
  ];
  const series = [
    { id: "s1", collectionId: "c1", title: "ตำนานเทพเจ้าจันทรา", publisher: "Luckpim", genre: "Fantasy", type: "manga", coverUrl: "" },
    { id: "s2", collectionId: "c1", title: "บันทึกนักฝันแห่งราตรี", publisher: "Luckpim", genre: "Romance", type: "novel", coverUrl: "" },
    { id: "s3", collectionId: "c5", title: "สาวน้อยนักเวทกับก็อบลิน", publisher: "Animag", genre: "Comedy", type: "manga", coverUrl: "" },
    { id: "s4", collectionId: "c3", title: "ราชันย์เงาแห่งรัตติกาล", publisher: "Siam Inter", genre: "Action", type: "novel", coverUrl: "" },
  ];
  const volumes = [
    { id: "v1", seriesId: "s1", number: 1, coverUrl: "", read: true },
    { id: "v2", seriesId: "s1", number: 2, coverUrl: "", read: true },
    { id: "v3", seriesId: "s1", number: 3, coverUrl: "", read: false },
    { id: "v4", seriesId: "s2", number: 1, coverUrl: "", read: false },
    { id: "v5", seriesId: "s3", number: 1, coverUrl: "", read: true },
    { id: "v6", seriesId: "s3", number: 2, coverUrl: "", read: true },
    { id: "v7", seriesId: "s4", number: 1, coverUrl: "", read: true },
    { id: "v8", seriesId: "s4", number: 2, coverUrl: "", read: false },
    { id: "v9", seriesId: "s4", number: 3, coverUrl: "", read: false },
  ];
  return { collections, series, volumes };
}

/* ---------------------------------------------------------------------- */
/* Styles — clean, minimal, easy on the eyes                               */
/* ---------------------------------------------------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');

:root {
  --bg: #FAF9F6;
  --surface: #FFFFFF;
  --surface-soft: #F2F1EC;
  --ink: #2E2D28;
  --ink-soft: #8B897E;
  --ink-faint: #B7B5A9;
  --border: #E9E7E0;
  --accent: #6E8C77;
  --accent-soft: #DCE8DF;
  --accent-ink: #4F6D58;
  --font-display: 'Inter', 'Noto Sans Thai', sans-serif;
  --font-body: 'Inter', 'Noto Sans Thai', sans-serif;
}

html, body { background: var(--bg); margin: 0; }

/* ---------- Global top bar (spans full width, every page) ---------- */
.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  background: #DAD7CD;
  box-shadow: 0 2px 0 rgba(46,45,40,0.06);
}
.topbar-inner {
  max-width: 1420px;
  margin: 0 auto;
  padding: 22px 32px;
  box-sizing: border-box;
}
.topbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.topbar-title-line { display: flex; align-items: baseline; gap: 14px; min-width: 0; }
.topbar-back {
  width: 34px; height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(46,45,40,0.18);
  background: transparent;
  color: var(--ink-soft);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  align-self: center;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.topbar-back:hover { border-color: var(--ink); color: var(--ink); }
.topbar-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 24px;
  color: var(--ink);
  line-height: 1.3;
  text-transform: uppercase;
  letter-spacing: 0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topbar-meta { font-size: 14px; color: var(--ink-soft); font-weight: 500; white-space: nowrap; }
.topbar-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
.topbar-type-toggle { display: flex; align-items: center; gap: 10px; }
.topbar-secondary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.topbar-secondary-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.topbar .search-box { background: var(--surface); max-width: 320px; }

.bs-root {
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  padding: 28px 32px 56px;
  max-width: 1420px;
  margin: 0 auto;
  box-sizing: border-box;
}
.bs-root * { box-sizing: border-box; }
.bs-root button { font-family: inherit; cursor: pointer; }
.bs-root input { font-family: inherit; }
.topbar button { font-family: inherit; cursor: pointer; }
.topbar input { font-family: inherit; }

.muted { color: var(--ink-soft); }

/* ---------- Home ---------- */
.home-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 48px;
}
.home-header h1 {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(28px, 3.6vw, 42px);
  margin: 0 0 6px;
  color: var(--ink);
}
.home-header p { margin: 0; font-size: 16px; color: var(--ink-soft); }
.sync-banner {
  background: #F0DEDC;
  color: #8C4A43;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  margin-bottom: 20px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--ink);
  color: #fff;
  border: none;
  padding: 13px 22px;
  border-radius: 10px;
  font-weight: 500;
  font-size: 15px;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.btn-primary:hover { opacity: 0.86; transform: translateY(-1px); }
.btn-primary.small { padding: 8px 14px; font-size: 13px; border-radius: 8px; }

.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--border);
  padding: 12px 18px;
  border-radius: 10px;
  font-size: 15px;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.btn-outline:hover { border-color: var(--ink-faint); background: var(--surface-soft); }

.collection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 28px;
}

.collection-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 26px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  cursor: pointer;
}
.collection-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px -14px rgba(46,45,40,0.18);
  border-color: var(--ink-faint);
}
.collection-icon {
  width: 88px; height: 88px;
  border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 32px;
  margin-bottom: 20px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.collection-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 10px;
  box-sizing: border-box;
}
.collection-card-actions {
  position: absolute;
  top: 12px; right: 12px;
  display: none;
  gap: 6px;
}
.collection-card:hover .collection-card-actions { display: flex; }
.card-edit {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: none;
  background: var(--surface-soft);
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}
.card-edit:hover { background: var(--border); color: var(--ink); }
.collection-card-actions .card-del { position: static; }
.paste-zone {
  border: 1.5px dashed var(--border);
  border-radius: 12px;
  min-height: 92px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  background: var(--bg);
  transition: border-color 0.15s ease, background 0.15s ease;
  outline: none;
}
.paste-zone:hover, .paste-zone:focus, .paste-zone.drag-over {
  border-color: var(--accent);
  background: var(--surface-soft);
}
.paste-hint {
  font-size: 12.5px;
  color: var(--ink-soft);
  text-align: center;
  line-height: 1.6;
  padding: 10px;
}
.paste-preview {
  max-width: 72px;
  max-height: 72px;
  object-fit: contain;
  border-radius: 8px;
}
.paste-remove {
  position: absolute;
  top: 6px; right: 6px;
  width: 22px; height: 22px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(46,45,40,0.15);
}
.collection-name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 19px;
  color: var(--ink);
  margin: 0 0 3px;
  line-height: 1.3;
}
.collection-count { font-size: 13.5px; color: var(--ink-soft); }
.card-del {
  position: absolute;
  top: 12px; right: 12px;
  width: 26px; height: 26px;
  border-radius: 50%;
  border: none;
  background: var(--surface-soft);
  color: var(--ink-soft);
  display: none;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}
.collection-card:hover .card-del { display: flex; }
.series-card-wrap:hover .card-del { display: flex; }
.card-del:hover { background: var(--border); color: var(--ink); }
.card-del.confirming { display: flex; background: #F0DEDC; color: #8C4A43; }

.empty-state {
  border: 1px dashed var(--border);
  border-radius: 16px;
  padding: 64px 24px;
  text-align: center;
  color: var(--ink-soft);
  background: var(--surface);
}
.empty-state h3 { font-family: var(--font-display); color: var(--ink); font-size: 19px; margin: 12px 0 6px; font-weight: 600; }
.empty-state p { margin: 0; font-size: 14px; }

/* ---------- Sub view header ---------- */
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--ink-soft);
  font-size: 14px;
  margin-bottom: 20px;
  padding: 4px 0;
  transition: color 0.15s ease;
}
.back-btn:hover { color: var(--ink); }

.collection-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(24px, 3vw, 34px);
  margin: 0 0 26px;
  color: var(--ink);
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.collection-title .count-tag { font-size: 15px; font-weight: 400; color: var(--ink-soft); font-family: var(--font-body); }

.toolbar {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-bottom: 34px;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 16px;
  flex: 1;
  min-width: 220px;
  max-width: 380px;
  color: var(--ink-soft);
}
.search-box input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--ink);
  font-size: 15px;
  width: 100%;
}
.search-box input::placeholder { color: var(--ink-faint); }

/* ---------- Series grid ---------- */
.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 30px 28px;
}
.shelf-rows { display: flex; flex-direction: column; }
.shelf-row { margin-bottom: 48px; }
.shelf-row:last-child { margin-bottom: 8px; }
.shelf-row-cards { display: flex; gap: 28px; }
.shelf-plank {
  position: relative;
  height: 22px;
  margin-top: 10px;
  border-radius: 7px;
  background: linear-gradient(to bottom, #C79A62 0%, #9C6B3E 45%, #6E4425 100%);
  box-shadow: 0 14px 20px -6px rgba(35,22,10,0.45), inset 0 1px 0 rgba(255,255,255,0.25);
}
.series-card-wrap {
  position: relative;
  cursor: pointer;
}
.stack-layer {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  overflow: hidden;
}
.stack-layer.stack-1 { transform: translate(6px, 7px); z-index: 1; }
.stack-layer.stack-2 { transform: translate(12px, 14px); z-index: 0; opacity: 0.85; }
.stack-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.series-card {
  position: relative;
  z-index: 2;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.series-card-wrap:hover .series-card {
  transform: translateY(-3px);
  box-shadow: 0 12px 26px -16px rgba(46,45,40,0.2);
  border-color: var(--ink-faint);
}
.cover {
  position: relative;
  aspect-ratio: 2 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: hidden;
}
.cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 16px;
  text-align: center;
  line-height: 1.4;
  position: relative;
  z-index: 1;
}
.type-pill {
  position: absolute;
  bottom: 8px; left: 8px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 11px;
  border-radius: 20px;
}

/* ---------- Series detail ---------- */
.series-toolbar {
  position: sticky;
  top: 12px;
  z-index: 30;
  background: var(--ink);
  border-radius: 18px;
  padding: 18px 22px 16px;
  margin-bottom: 30px;
  box-shadow: 0 14px 30px -12px rgba(20,16,10,0.45);
}
.series-toolbar .back-btn { color: rgba(255,255,255,0.55); }
.series-toolbar .back-btn:hover { color: #fff; }
.series-toolbar .series-header h2 { color: #fff; }
.series-toolbar .series-header .meta { color: rgba(255,255,255,0.5); }
.series-toolbar .icon-btn { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.75); }
.series-toolbar .icon-btn:hover { border-color: #fff; color: #fff; }
.series-toolbar .status-row { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
.series-toolbar .status-pill { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }
.series-toolbar .status-pill:not(.active):hover { border-color: #fff; color: #fff; }
.series-toolbar .btn-primary { background: #fff; color: var(--ink); }
.series-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 22px;
}
.series-header h2 {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(22px, 3vw, 28px);
  margin: 0 0 6px;
  color: var(--ink);
}
.series-header .meta { font-size: 13px; color: var(--ink-soft); margin: 0; }
.header-actions { display: flex; gap: 8px; }
.icon-btn {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.icon-btn:hover { border-color: var(--ink-faint); color: var(--ink); }
.icon-btn.danger.confirming { border-color: #F0DEDC; background: #F0DEDC; color: #8C4A43; }

.status-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.status-pill {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-soft);
  padding: 8px 15px;
  border-radius: 20px;
  font-size: 13px;
  transition: all 0.15s ease;
}
.status-pill.active { border-color: transparent; font-weight: 600; }

.volume-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 30px 28px;
}
.volume-card { width: auto; }
.volume-face {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.volume-card:hover .volume-face { transform: translateY(-3px); box-shadow: 0 10px 20px -14px rgba(46,45,40,0.25); }
.volume-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.volume-number-text {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 22px;
  position: relative;
  z-index: 1;
}
.volume-number-label {
  position: absolute;
  bottom: 8px; left: 8px;
  background: rgba(255,255,255,0.88);
  color: var(--ink);
  font-size: 12px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 20px;
}
.volume-del {
  position: absolute;
  top: 7px; right: 7px;
  width: 22px; height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.9);
  color: var(--ink-soft);
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}
.volume-card:hover .volume-del { display: flex; }
.volume-del.confirming { display: flex; background: #F0DEDC; color: #8C4A43; }
.read-toggle {
  margin-top: 9px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ink-faint);
  background: transparent;
  border: none;
  padding: 0;
}
.read-toggle .box {
  width: 16px; height: 16px;
  border-radius: 5px;
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: #fff;
}
.read-toggle.read .box { background: var(--accent); border-color: var(--accent); }
.read-toggle.read { color: var(--accent-ink); }

/* ---------- Modal ---------- */
.overlay {
  position: fixed; inset: 0;
  background: rgba(46,45,40,0.32);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  z-index: 50;
}
.modal {
  background: var(--surface);
  color: var(--ink);
  width: 100%;
  max-width: 420px;
  border-radius: 18px;
  padding: 26px 26px 22px;
  box-shadow: 0 30px 60px -20px rgba(46,45,40,0.35);
  max-height: 88vh;
  overflow-y: auto;
}
.modal-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 18px;
}
.modal-head h3 { font-family: var(--font-display); font-size: 18px; margin: 0; font-weight: 600; }
.modal-head button { background: transparent; border: none; color: var(--ink-soft); }
.field { margin-bottom: 15px; }
.field label { display: block; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); margin-bottom: 6px; }
.field input {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--bg);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 14px;
  color: var(--ink);
  outline: none;
  transition: border-color 0.15s ease;
}
.field input:focus { border-color: var(--accent); }
.field-row { display: flex; gap: 12px; }
.field-row .field { flex: 1; }
.swatches { display: flex; gap: 10px; }
.swatch {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
}
.swatch.selected { border-color: var(--ink); }
.status-choice { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.status-choice button {
  border: 1px solid var(--border);
  background: var(--bg);
  padding: 9px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--ink);
}
.status-choice button.active { border-color: transparent; font-weight: 600; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.btn-cancel {
  background: transparent;
  border: 1px solid var(--border);
  padding: 9px 18px;
  border-radius: 10px;
  font-size: 14px;
  color: var(--ink);
}
.btn-save {
  background: var(--ink);
  color: #fff;
  border: none;
  padding: 9px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
}
.btn-save:disabled { opacity: 0.35; cursor: not-allowed; }

@media (max-width: 640px) {
  .bs-root { padding: 14px 10px 40px; max-width: none; }
  .topbar-inner { padding: 12px 14px; max-width: none; }
  .topbar-row { flex-wrap: nowrap; }
  .topbar-title { font-size: 19px; }
  .topbar-meta { display: none; }
  .topbar-back { width: 32px; height: 32px; }
  .topbar-title-line { gap: 10px; min-width: 0; flex: 1; }
  .topbar-actions { gap: 6px; }
  .topbar-actions .btn-text { display: none; }
  .topbar-type-toggle { display: none; }
  .topbar-actions .btn-primary,
  .topbar-actions .btn-outline {
    padding: 0;
    width: 34px;
    height: 34px;
    justify-content: center;
  }
  .topbar .search-box { max-width: none; min-width: 0; padding: 8px 12px; }
  .topbar .search-box input { min-width: 0; }
  .topbar-title-line.search-active .topbar-title { display: none; }
  .search-close { background: transparent; border: none; color: var(--ink-soft); display: flex; align-items: center; padding: 0; flex-shrink: 0; }

  .home-header h1 { font-size: 24px; }
  .home-header p { font-size: 13px; }

  .collection-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .collection-card { padding: 12px; border-radius: 12px; }
  .collection-icon { width: 56px; height: 56px; font-size: 22px; border-radius: 13px; margin-bottom: 14px; }
  .collection-name { font-size: 13px; }
  .collection-count { font-size: 11px; }

  .series-grid { grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .cover { padding: 6px; }
  .cover-title { font-size: 9.5px; }
  .type-pill { font-size: 9px; padding: 2px 7px; bottom: 5px; left: 5px; }
  .stack-layer.stack-1 { transform: translate(3px, 4px); }
  .stack-layer.stack-2 { transform: translate(6px, 8px); }

  .volume-grid { grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .volume-card { width: 100%; }
  .volume-face { border-radius: 9px; }
  .volume-number-text { font-size: 15px; }
  .volume-number-label { font-size: 9.5px; padding: 2px 6px; bottom: 5px; left: 5px; }
  .read-toggle { font-size: 10.5px; }
}
`;

/* ---------------------------------------------------------------------- */
/* Small building blocks                                                   */
/* ---------------------------------------------------------------------- */

function useConfirmDelete(onConfirm) {
  const [confirmingId, setConfirmingId] = useState(null);
  const timerRef = useRef(null);
  const trigger = useCallback((id, e) => {
    if (e) e.stopPropagation();
    if (confirmingId === id) {
      clearTimeout(timerRef.current);
      setConfirmingId(null);
      onConfirm(id);
    } else {
      setConfirmingId(id);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setConfirmingId(null), 3200);
    }
  }, [confirmingId, onConfirm]);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  return [confirmingId, trigger];
}

function Cover({ src, imgAlt, imgClassName, fallback }) {
  const [error, setError] = useState(false);
  useEffect(() => { setError(false); }, [src]);
  if (src && !error) {
    return <img src={src} alt={imgAlt || ""} className={imgClassName} loading="lazy" referrerPolicy="no-referrer" onError={() => setError(true)} />;
  }
  return fallback;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Main App                                                                */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState({ type: "home" });
  const isDesktop = useIsDesktop();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);
  const [search, setSearch] = useState("");

  const [showAddCollection, setShowAddCollection] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [editingSeries, setEditingSeries] = useState(null);
  const [showVolumeModal, setShowVolumeModal] = useState(false);

  const [syncCode, setSyncCode] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  // ---- get / create this device's sync code ----
  useEffect(() => {
    let code = null;
    try { code = localStorage.getItem(CODE_KEY); } catch (e) {}
    if (!code) {
      code = makeCode();
      try { localStorage.setItem(CODE_KEY, code); } catch (e) {}
    }
    setSyncCode(code);
  }, []);

  // ---- subscribe to Firestore for this sync code ----
  useEffect(() => {
    if (!syncCode) return;
    setLoading(true);
    setSyncError(null);
    const ref = doc(db, "bookshelves", syncCode);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const remote = snap.data();
          setData(remote);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(remote)); } catch (e) {}
        } else {
          let initial = null;
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) initial = JSON.parse(raw);
          } catch (e) {}
          if (!initial) initial = seedData();
          setDoc(ref, initial).catch(() => {});
          setData(initial);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setSyncError("เชื่อมต่อฐานข้อมูลไม่ได้ — ใช้ข้อมูลในเครื่องนี้ไปก่อน");
        let initial = null;
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) initial = JSON.parse(raw);
        } catch (e) {}
        setData(initial || seedData());
        setLoading(false);
      }
    );
    return () => unsub();
  }, [syncCode]);

  const persist = useCallback((next) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
    if (!syncCode) return;
    setDoc(doc(db, "bookshelves", syncCode), next).catch((e) => {
      console.error(e);
      setSyncError("บันทึกขึ้นฐานข้อมูลไม่ได้ — ตรวจสอบการเชื่อมต่อ");
    });
  }, [syncCode]);

  const changeSyncCode = useCallback((newCode) => {
    const cleaned = newCode.trim().toUpperCase();
    if (!cleaned) return;
    try { localStorage.setItem(CODE_KEY, cleaned); } catch (e) {}
    setSyncCode(cleaned);
  }, []);

  const update = useCallback((updater) => {
    setData((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  if (loading || !data) {
    return (
      <div className="bs-root">
        <style>{CSS}</style>
        <p className="muted">กำลังโหลดชั้นหนังสือ...</p>
      </div>
    );
  }

  const volumeCount = (seriesId) => data.volumes.filter((v) => v.seriesId === seriesId).length;
  const volumesDesc = (seriesId) => data.volumes.filter((v) => v.seriesId === seriesId).sort((a, b) => b.number - a.number);
  const collectionVolumeCount = (collectionId) =>
    data.series.filter((s) => s.collectionId === collectionId)
      .reduce((sum, s) => sum + volumeCount(s.id), 0);

  const addCollection = (name, colorIndex, iconUrl) => {
    update((prev) => ({ ...prev, collections: [...prev.collections, { id: uid(), name, colorIndex, iconUrl: iconUrl || null }] }));
  };
  const editCollection = (id, name, colorIndex, iconUrl) => {
    update((prev) => ({
      ...prev,
      collections: prev.collections.map((c) => c.id === id ? { ...c, name, colorIndex, iconUrl: iconUrl || null } : c),
    }));
  };
  const deleteCollection = (id) => {
    update((prev) => {
      const seriesIds = prev.series.filter((s) => s.collectionId === id).map((s) => s.id);
      return {
        collections: prev.collections.filter((c) => c.id !== id),
        series: prev.series.filter((s) => s.collectionId !== id),
        volumes: prev.volumes.filter((v) => !seriesIds.includes(v.seriesId)),
      };
    });
    setView({ type: "home" });
  };

  const addSeries = (collectionId, form) => {
    const seriesId = uid();
    update((prev) => ({
      ...prev,
      series: [...prev.series, {
        id: seriesId, collectionId, title: form.title, publisher: form.publisher,
        genre: form.genre, type: form.type, coverUrl: form.coverUrl,
      }],
      volumes: [...prev.volumes, { id: uid(), seriesId, number: Number(form.volume) || 1, coverUrl: form.coverUrl, read: false }],
    }));
  };
  const editSeries = (seriesId, form) => {
    update((prev) => ({
      ...prev,
      series: prev.series.map((s) => s.id === seriesId ? { ...s, title: form.title, publisher: form.publisher, genre: form.genre, type: form.type, coverUrl: form.coverUrl } : s),
    }));
  };
  const deleteSeries = (id) => {
    update((prev) => ({
      ...prev,
      series: prev.series.filter((s) => s.id !== id),
      volumes: prev.volumes.filter((v) => v.seriesId !== id),
    }));
    setView({ type: "collection", id: data.series.find((s) => s.id === id)?.collectionId });
  };
  const setSeriesType = (id, type) => {
    update((prev) => ({ ...prev, series: prev.series.map((s) => s.id === id ? { ...s, type } : s) }));
  };
  const touchSeries = (id) => {
    update((prev) => ({ ...prev, series: prev.series.map((s) => s.id === id ? { ...s, lastOpened: Date.now() } : s) }));
  };

  const addVolume = (seriesId, form) => {
    update((prev) => ({
      ...prev,
      volumes: [...prev.volumes, { id: uid(), seriesId, number: Number(form.number) || 1, coverUrl: form.coverUrl, read: !!form.read }],
    }));
  };
  const deleteVolume = (id) => {
    update((prev) => ({ ...prev, volumes: prev.volumes.filter((v) => v.id !== id) }));
  };
  const toggleVolumeRead = (id) => {
    update((prev) => ({ ...prev, volumes: prev.volumes.map((v) => v.id === id ? { ...v, read: !v.read } : v) }));
  };

  return (
    <>
      <style>{CSS}</style>

      {view.type === "home" && (
        <TopBar
          title="ชั้นหนังสือของฉัน"
          actions={
            <>
              <button className="btn-outline" onClick={() => setShowSyncModal(true)}><Smartphone size={15} /> <span className="btn-text">ซิงค์อุปกรณ์</span></button>
              <button className="btn-primary" onClick={() => { setEditingCollection(null); setShowAddCollection(true); }}><Plus size={16} /> <span className="btn-text">ชั้นใหม่</span></button>
            </>
          }
        />
      )}

      {view.type === "collection" && (() => {
        const collection = data.collections.find((c) => c.id === view.id);
        if (!collection) return null;
        const seriesInCollection = data.series.filter((s) => s.collectionId === view.id);
        return (
          <TopBar
            onBack={() => { setView({ type: "home" }); setSearch(""); setMobileSearchOpen(false); }}
            title={collection.name}
            meta={`${seriesInCollection.length} เรื่อง`}
            hideTitleOnMobile={mobileSearchOpen}
            actions={
              <>
                <SearchControl
                  value={search}
                  onChange={setSearch}
                  isDesktop={isDesktop}
                  open={mobileSearchOpen}
                  onOpenSearch={() => setMobileSearchOpen(true)}
                  onCloseSearch={() => setMobileSearchOpen(false)}
                />
                <button className="btn-primary" onClick={() => { setEditingSeries(null); setShowSeriesModal(true); }}>
                  <Plus size={15} /> <span className="btn-text">เพิ่มหนังสือ</span>
                </button>
              </>
            }
          />
        );
      })()}

      {view.type === "series" && (() => {
        const s = data.series.find((x) => x.id === view.id);
        if (!s) return null;
        return (
          <TopBar
            onBack={() => setView({ type: "collection", id: s.collectionId })}
            title={s.title}
            meta={s.genre || ""}
            actions={
              <>
                <div className="topbar-type-toggle">
                  {TYPES.map((tp) => (
                    <button
                      key={tp.key}
                      className={`status-pill${s.type === tp.key ? " active" : ""}`}
                      style={s.type === tp.key ? { background: tp.bg, color: tp.fg } : {}}
                      onClick={() => setSeriesType(s.id, tp.key)}
                    >
                      {tp.label}
                    </button>
                  ))}
                </div>
                <button className="icon-btn" title="แก้ไข" onClick={() => { setEditingSeries(s); setShowSeriesModal(true); }}><Pencil size={15} /></button>
                <DeleteSeriesButton seriesId={s.id} onDelete={deleteSeries} />
                <button className="btn-primary" onClick={() => setShowVolumeModal(true)}>
                  <Plus size={15} /> <span className="btn-text">เพิ่มเล่ม</span>
                </button>
              </>
            }
          />
        );
      })()}

      <div className="bs-root">
        {view.type === "home" && (
          <HomeView
            data={data}
            collectionVolumeCount={collectionVolumeCount}
            onOpen={(id) => setView({ type: "collection", id })}
            onEdit={(c) => { setEditingCollection(c); setShowAddCollection(true); }}
            onDelete={deleteCollection}
            syncError={syncError}
          />
        )}

        {view.type === "collection" && (
          <CollectionView
            collection={data.collections.find((c) => c.id === view.id)}
            seriesList={data.series.filter((s) => s.collectionId === view.id)}
            volumeCount={volumeCount}
            volumesDesc={volumesDesc}
            search={search}
            onOpenSeries={(id) => { touchSeries(id); setView({ type: "series", id }); }}
            onDeleteSeries={deleteSeries}
          />
        )}

        {view.type === "series" && (() => {
          const s = data.series.find((x) => x.id === view.id);
          if (!s) return null;
          const vols = data.volumes.filter((v) => v.seriesId === s.id).sort((a, b) => a.number - b.number);
          return (
            <SeriesView
              series={s}
              volumes={vols}
              onDeleteVolume={deleteVolume}
              onToggleRead={toggleVolumeRead}
            />
          );
        })()}

        {showAddCollection && (
          <AddCollectionModal
            initial={editingCollection}
            onClose={() => { setShowAddCollection(false); setEditingCollection(null); }}
            onSave={(name, colorIndex, iconUrl) => {
              if (editingCollection) editCollection(editingCollection.id, name, colorIndex, iconUrl);
              else addCollection(name, colorIndex, iconUrl);
              setShowAddCollection(false);
              setEditingCollection(null);
            }}
          />
        )}

        {showSyncModal && (
          <SyncModal
            code={syncCode}
            onClose={() => setShowSyncModal(false)}
            onConnect={(newCode) => { changeSyncCode(newCode); setShowSyncModal(false); }}
          />
        )}

        {showSeriesModal && (
          <SeriesModal
            initial={editingSeries}
            onClose={() => { setShowSeriesModal(false); setEditingSeries(null); }}
            onSave={(form) => {
              if (editingSeries) editSeries(editingSeries.id, form);
              else addSeries(view.id, form);
              setShowSeriesModal(false);
              setEditingSeries(null);
            }}
          />
        )}

        {showVolumeModal && view.type === "series" && (
          <VolumeModal
            nextNumber={(data.volumes.filter((v) => v.seriesId === view.id).length || 0) + 1}
            onClose={() => setShowVolumeModal(false)}
            onSave={(form) => { addVolume(view.id, form); setShowVolumeModal(false); }}
          />
        )}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Top bar (global, full width, sticky, shown on every page)              */
/* ---------------------------------------------------------------------- */

function SearchControl({ value, onChange, isDesktop, open, onOpenSearch, onCloseSearch }) {
  if (isDesktop || open) {
    return (
      <div className="search-box">
        <Search size={15} />
        <input
          autoFocus={!isDesktop}
          placeholder="ค้นหาชื่อเรื่อง..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {!isDesktop && (
          <button className="search-close" title="ปิดค้นหา" onClick={() => { onChange(""); onCloseSearch(); }}>
            <X size={14} />
          </button>
        )}
      </div>
    );
  }
  return (
    <button className="icon-btn" title="ค้นหา" onClick={onOpenSearch}><Search size={16} /></button>
  );
}

function TopBar({ onBack, title, meta, actions, secondary, hideTitleOnMobile }) {
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="topbar-row">
          <div className={`topbar-title-line${hideTitleOnMobile ? " search-active" : ""}`}>
            {onBack && <button className="topbar-back" title="กลับ" onClick={onBack}><ArrowLeft size={16} /></button>}
            <span className="topbar-title">{title}</span>
            {meta && <span className="topbar-meta">{meta}</span>}
          </div>
          {actions && <div className="topbar-actions">{actions}</div>}
        </div>
        {secondary && <div className="topbar-secondary">{secondary}</div>}
      </div>
    </div>
  );
}

function DeleteSeriesButton({ seriesId, onDelete }) {
  const [confirming, trigger] = useConfirmDelete(onDelete);
  return (
    <button className={`icon-btn danger${confirming === seriesId ? " confirming" : ""}`} title="ลบเรื่องนี้" onClick={(e) => trigger(seriesId, e)}>
      {confirming === seriesId ? <Check size={15} /> : <Trash2 size={15} />}
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* Home                                                                    */
/* ---------------------------------------------------------------------- */

function HomeView({ data, collectionVolumeCount, onOpen, onEdit, onDelete, syncError }) {
  const [confirmingId, trigger] = useConfirmDelete(onDelete);
  return (
    <div className="home">
      {syncError && <div className="sync-banner">{syncError}</div>}

      {data.collections.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={26} style={{ color: "var(--ink-faint)" }} />
          <h3>ยังไม่มีชั้นหนังสือ</h3>
          <p>เริ่มสร้างชั้นแรกของคุณ เช่น ชื่อสำนักพิมพ์ หรือหมวดหมู่ที่ต้องการ</p>
        </div>
      ) : (
        <div className="collection-grid">
          {data.collections.map((c) => {
            const tone = PALETTE[c.colorIndex % PALETTE.length];
            return (
              <div className="collection-card" key={c.id} onClick={() => onOpen(c.id)}>
                <div className="collection-icon" style={c.iconUrl ? { background: "#fff" } : { background: tone.bg, color: tone.fg }}>
                  {c.iconUrl ? <img src={c.iconUrl} alt="" className="collection-icon-img" /> : c.name.trim().charAt(0).toUpperCase()}
                </div>
                <p className="collection-name">{c.name}</p>
                <p className="collection-count">{collectionVolumeCount(c.id)} เล่ม</p>
                <div className="collection-card-actions">
                  <button className="card-edit" title="แก้ไขชั้นนี้" onClick={(e) => { e.stopPropagation(); onEdit(c); }}><Pencil size={12} /></button>
                  <button className={`card-del${confirmingId === c.id ? " confirming" : ""}`} title="ลบชั้นนี้" onClick={(e) => trigger(c.id, e)}>
                    {confirmingId === c.id ? <Check size={12} /> : <X size={12} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Collection                                                              */
/* ---------------------------------------------------------------------- */

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== "undefined" ? window.innerWidth > 640 : true));
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth > 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isDesktop;
}

const SHELF_CARD_W = 200;
const SHELF_GAP = 28;

function SeriesCard({ series: s, volumesDesc, confirmingId, trigger, onOpenSeries, style }) {
  const tp = typeOf(s.type);
  const tone = hashTone(s.title);
  const vols = volumesDesc(s.id); // sorted newest volume first
  const vc = vols.length;
  const latest = vols[0];
  const coverSrc = latest?.coverUrl || s.coverUrl || "";
  const second = vols[1];
  const third = vols[2];
  const toneA = hashTone(s.title + "b");
  const toneB = hashTone(s.title + "c");
  return (
    <div className={`series-card-wrap${vc > 1 ? " stacked" : ""}`} style={style} onClick={() => onOpenSeries(s.id)} title={s.title}>
      {vc > 1 && (
        <div className="stack-layer stack-2" style={{ background: toneB.bg }}>
          {third?.coverUrl && <img src={third.coverUrl} alt="" className="stack-img" />}
        </div>
      )}
      {vc > 1 && (
        <div className="stack-layer stack-1" style={{ background: toneA.bg }}>
          {second?.coverUrl && <img src={second.coverUrl} alt="" className="stack-img" />}
        </div>
      )}
      <div className="series-card">
        <div className="cover" style={{ background: tone.bg, color: tone.fg }}>
          <Cover src={coverSrc} imgAlt={s.title} imgClassName="cover-img" fallback={<span className="cover-title">{s.title}</span>} />
          <span className="type-pill" style={{ background: tp.bg, color: tp.fg }}>{tp.label}</span>
          <button className={`card-del${confirmingId === s.id ? " confirming" : ""}`} title="ลบเรื่องนี้" onClick={(e) => trigger(s.id, e)}>
            {confirmingId === s.id ? <Check size={12} /> : <X size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function CollectionView({ collection, seriesList, volumeCount, volumesDesc, search, onOpenSeries, onDeleteSeries }) {
  const [confirmingId, trigger] = useConfirmDelete(onDeleteSeries);
  const isDesktop = useIsDesktop();
  if (!collection) return null;
  const filtered = seriesList
    .filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));

  const rows = [];
  if (isDesktop) {
    for (let i = 0; i < filtered.length; i += 6) rows.push(filtered.slice(i, i + 6));
  }

  return (
    <div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>{search ? "ไม่พบเรื่องที่ค้นหา" : "ยังไม่มีหนังสือในชั้นนี้"}</h3>
          <p>{search ? "ลองค้นหาด้วยคำอื่น" : "กดปุ่ม “เพิ่มหนังสือ” เพื่อเริ่มเก็บเล่มแรก"}</p>
        </div>
      ) : isDesktop ? (
        <div className="shelf-rows">
          {rows.map((row, ri) => {
            const rowWidth = row.length * SHELF_CARD_W + (row.length - 1) * SHELF_GAP;
            return (
              <div className="shelf-row" key={ri}>
                <div className="shelf-row-cards" style={{ width: rowWidth }}>
                  {row.map((s) => (
                    <SeriesCard
                      key={s.id}
                      series={s}
                      volumesDesc={volumesDesc}
                      confirmingId={confirmingId}
                      trigger={trigger}
                      onOpenSeries={onOpenSeries}
                      style={{ width: SHELF_CARD_W, flexShrink: 0 }}
                    />
                  ))}
                </div>
                <div className="shelf-plank" style={{ width: rowWidth }} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="series-grid">
          {filtered.map((s) => (
            <SeriesCard key={s.id} series={s} volumesDesc={volumesDesc} confirmingId={confirmingId} trigger={trigger} onOpenSeries={onOpenSeries} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Series detail                                                           */
/* ---------------------------------------------------------------------- */

function SeriesView({ series, volumes, onDeleteVolume, onToggleRead }) {
  const [confirmingVolId, triggerVol] = useConfirmDelete(onDeleteVolume);

  return (
    <div>
      {volumes.length === 0 ? (
        <div className="empty-state">
          <h3>ยังไม่มีเล่มในเรื่องนี้</h3>
          <p>กดปุ่ม “เพิ่มเล่ม” ด้านบนเพื่อเริ่มเก็บเล่มแรก</p>
        </div>
      ) : (
        <div className="volume-grid">
          {volumes.map((v) => {
            const tone = hashTone(series.title + v.number);
            return (
              <div className="volume-card" key={v.id}>
                <div className="volume-face" style={{ background: tone.bg, color: tone.fg }}>
                  <Cover src={v.coverUrl} imgAlt={`เล่ม ${v.number}`} imgClassName="volume-img" fallback={<span className="volume-number-text">{v.number}</span>} />
                  <span className="volume-number-label">เล่ม {v.number}</span>
                  <button className={`volume-del${confirmingVolId === v.id ? " confirming" : ""}`} title="ลบเล่มนี้" onClick={(e) => triggerVol(v.id, e)}>
                    {confirmingVolId === v.id ? <Check size={11} /> : <X size={11} />}
                  </button>
                </div>
                <button className={`read-toggle${v.read ? " read" : ""}`} onClick={() => onToggleRead(v.id)}>
                  <span className="box">{v.read && <Check size={10} />}</span>
                  {v.read ? "อ่านแล้ว" : "ยังไม่อ่าน"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Modals                                                                   */
/* ---------------------------------------------------------------------- */

function SyncModal({ code, onClose, onConnect }) {
  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {}
  };

  return (
    <Modal title="ซิงค์ข้ามอุปกรณ์" onClose={onClose}>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 0 }}>
        พิมพ์รหัสเดียวกันนี้ในอุปกรณ์อีกเครื่อง เพื่อให้ข้อมูลซิงค์กันแบบเรียลไทม์
      </p>
      <div className="field">
        <label>รหัสซิงค์ของเครื่องนี้</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={code || ""} readOnly style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: 2, textAlign: "center" }} />
          <button className="btn-outline" onClick={copy} style={{ flexShrink: 0 }}>
            <Copy size={14} /> {copied ? "คัดลอกแล้ว" : "คัดลอก"}
          </button>
        </div>
      </div>
      <div className="field" style={{ marginTop: 20 }}>
        <label>เชื่อมกับรหัสอื่น (พิมพ์รหัสจากอีกเครื่อง)</label>
        <input
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          placeholder="เช่น A3F9K2"
          maxLength={6}
          style={{ fontFamily: "monospace", fontSize: 16, letterSpacing: 2, textAlign: "center" }}
        />
      </div>
      <div className="modal-actions">
        <button className="btn-cancel" onClick={onClose}>ปิด</button>
        <button className="btn-save" disabled={!inputCode.trim()} onClick={() => onConnect(inputCode)}>เชื่อมต่อ</button>
      </div>
    </Modal>
  );
}

function resizeImageFile(file, maxDim = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        } else {
          if (height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AddCollectionModal({ initial, onClose, onSave }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [colorIndex, setColorIndex] = useState(initial?.colorIndex || 0);
  const [iconUrl, setIconUrl] = useState(initial?.iconUrl || null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (file && file.type && file.type.startsWith("image/")) {
      try {
        const dataUrl = await resizeImageFile(file);
        setIconUrl(dataUrl);
      } catch (e) {}
    }
  };
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type && item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  };

  return (
    <Modal title={isEdit ? "แก้ไขชั้น" : "สร้างชั้นใหม่"} onClose={onClose}>
      <div className="field">
        <label>ชื่อชั้น / สำนักพิมพ์ *</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Luckpim" />
      </div>
      <div className="field">
        <label>โลโก้</label>
        <div
          className={`paste-zone${dragOver ? " drag-over" : ""}`}
          tabIndex={0}
          onPaste={handlePaste}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        >
          {iconUrl ? (
            <>
              <img src={iconUrl} alt="" className="paste-preview" />
              <button type="button" className="paste-remove" onClick={(e) => { e.stopPropagation(); setIconUrl(null); }} title="เอาโลโก้ออก">
                <X size={12} />
              </button>
            </>
          ) : (
            <span className="paste-hint">คลิกแล้ววาง (Ctrl+V)<br />หรือคลิกเพื่อเลือกไฟล์</span>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>
      <div className="field">
        <label>สีพื้นหลัง (ใช้เมื่อไม่มีโลโก้)</label>
        <div className="swatches">
          {PALETTE.map((p, i) => (
            <div key={p.bg} className={`swatch${colorIndex === i ? " selected" : ""}`} style={{ background: p.bg }} onClick={() => setColorIndex(i)} title={p.name} />
          ))}
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn-cancel" onClick={onClose}>ยกเลิก</button>
        <button className="btn-save" disabled={!name.trim()} onClick={() => onSave(name.trim(), colorIndex, iconUrl)}>บันทึก</button>
      </div>
    </Modal>
  );
}

function SeriesModal({ initial, onClose, onSave }) {
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title || "");
  const [volume, setVolume] = useState(1);
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl || "");
  const [publisher, setPublisher] = useState(initial?.publisher || "");
  const [genre, setGenre] = useState(initial?.genre || "");
  const [type, setType] = useState(initial?.type || "manga");

  return (
    <Modal title={isEdit ? "แก้ไขหนังสือ" : "เพิ่มหนังสือ"} onClose={onClose}>
      <div className="field">
        <label>ชื่อเรื่อง *</label>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น One Piece" />
      </div>
      {!isEdit && (
        <div className="field">
          <label>เล่มที่ *</label>
          <input type="number" min="1" value={volume} onChange={(e) => setVolume(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>URL รูปปก</label>
        <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div className="field-row">
        <div className="field">
          <label>สำนักพิมพ์</label>
          <input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="ชื่อสำนักพิมพ์" />
        </div>
        <div className="field">
          <label>แนวเรื่อง</label>
          <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Fantasy, Romance..." />
        </div>
      </div>
      <div className="field">
        <label>ประเภท</label>
        <div className="status-choice">
          {TYPES.map((tp) => (
            <button key={tp.key} className={type === tp.key ? "active" : ""} style={type === tp.key ? { background: tp.bg, color: tp.fg } : {}} onClick={() => setType(tp.key)}>{tp.label}</button>
          ))}
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn-cancel" onClick={onClose}>ยกเลิก</button>
        <button className="btn-save" disabled={!title.trim()} onClick={() => onSave({ title: title.trim(), volume, coverUrl: coverUrl.trim(), publisher: publisher.trim(), genre: genre.trim(), type })}>บันทึก</button>
      </div>
    </Modal>
  );
}

function VolumeModal({ nextNumber, onClose, onSave }) {
  const [number, setNumber] = useState(nextNumber);
  const [coverUrl, setCoverUrl] = useState("");
  const [read, setRead] = useState(false);
  return (
    <Modal title="เพิ่มเล่มใหม่" onClose={onClose}>
      <div className="field">
        <label>เล่มที่ *</label>
        <input autoFocus type="number" min="1" value={number} onChange={(e) => setNumber(e.target.value)} />
      </div>
      <div className="field">
        <label>URL รูปปก</label>
        <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div className="field">
        <button className={`read-toggle${read ? " read" : ""}`} style={{ fontSize: 13 }} onClick={() => setRead((r) => !r)}>
          <span className="box">{read && <Check size={10} />}</span>
          อ่านแล้ว
        </button>
      </div>
      <div className="modal-actions">
        <button className="btn-cancel" onClick={onClose}>ยกเลิก</button>
        <button className="btn-save" onClick={() => onSave({ number, coverUrl: coverUrl.trim(), read })}>บันทึก</button>
      </div>
    </Modal>
  );
}
