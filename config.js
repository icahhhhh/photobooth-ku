/**
 * Konfigurasi Awal PhotoBooth Studio
 * Berisi Frame Bawaan yang bisa digunakan secara offline
 */
const DEFAULT_FRAMES = [
   {
     id: "built_001",
     name: "Classic White 4R",
     category: "standard",
     eventId: "*",
     config: {
       canvas: { w: 1200, h: 1800 },
       bgColor: "#ffffff",
       elements: [
         { id: 1, type: "zone", x: 100, y: 100, w: 1000, h: 750 },
         { id: 2, type: "zone", x: 100, y: 950, w: 1000, h: 750 }
       ]
     }
   },
   {
     id: "built_004",
     name: "Wedding Aisyah",
     category: "wedding",
     eventId: "*",
     previewSrc: "assets/frames/frame-wedding.png",
     config: {
       canvas: { w: 1200, h: 1800 },
       bgColor: "assets/frames/frame-wedding.png",
       elements: [
         { id: 1, type: "zone", x: 100, y: 160, w: 1000, h: 650 },
         { id: 2, type: "zone", x: 100, y: 860, w: 1000, h: 650 },
         // Gambar bingkai yang menimpa zona foto
         { id: 3, type: "image", x: 0, y: 0, w: 1200, h: 1800, src: "assets/icons/icon-frame-wedding.png" }
       ]
     }
   }
];

// ============================================================
// FRAME STORE — sumber tunggal untuk baca/tulis/hapus frame
// Menggabungkan: built-in (config.js) + user (localStorage)
// ============================================================
window.FrameStore = {

    // Ambil frame user dari localStorage
    getUserFrames(eventId) {
        const all = JSON.parse(localStorage.getItem('pb_frames') || '[]');
        return eventId ? all.filter(f => f.eventId === eventId) : all;
    },

    // Ambil semua frame untuk suatu event (built-in + user)
    async getForEvent(eventId) {
        const builtin = DEFAULT_FRAMES.filter(
            f => f.eventId === '*' || f.eventId === eventId
        );
        const userFrames = this.getUserFrames(eventId);
        return [...builtin, ...userFrames];
    },

    // Cari satu frame by id (cek built-in dulu, lalu user)
    async findById(id) {
        const builtin = DEFAULT_FRAMES.find(f => f.id === id);
        if (builtin) return builtin;
        const all = JSON.parse(localStorage.getItem('pb_frames') || '[]');
        return all.find(f => f.id === id) || null;
    },

    // Simpan frame baru ke localStorage
    save(frameObj) {
        const frames = JSON.parse(localStorage.getItem('pb_frames') || '[]');
        frames.push(frameObj);
        localStorage.setItem('pb_frames', JSON.stringify(frames));
    },

    // Hapus frame user (built-in tidak bisa dihapus — return false)
    delete(id) {
        const isBuiltin = DEFAULT_FRAMES.some(f => f.id === id);
        if (isBuiltin) return false;
        const frames = JSON.parse(localStorage.getItem('pb_frames') || '[]');
        localStorage.setItem('pb_frames', JSON.stringify(frames.filter(f => f.id !== id)));
        return true;
    }
};

// Bersihkan localStorage dari duplikat frame bawaan lama (jika ada)
(function cleanLegacyBuiltins() {
    const builtinIds = DEFAULT_FRAMES.map(f => f.id);
    const stored = JSON.parse(localStorage.getItem('pb_frames') || '[]');
    const cleaned = stored.filter(f => !builtinIds.includes(f.id));
    if (cleaned.length !== stored.length) {
        localStorage.setItem('pb_frames', JSON.stringify(cleaned));
    }
})();