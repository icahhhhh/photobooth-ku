# Panduan Offline-First PhotoBooth Studio

## Ringkasan Perubahan

Dokumen ini menjelaskan **3 titik ketergantungan internet** di proyekmu
dan cara memperbaiki masing-masing agar software berjalan **100% offline**.

---

## 1. QR Code (Paling Kritis)

### Masalah
Di `script.js` baris 1052, QR code dibuat dengan memanggil server eksternal:
```js
// ❌ BUTUH INTERNET
document.getElementById('qrCodeImg').src =
  `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=...`;
```

### Solusi A — Library Offline (Direkomendasikan)

**Langkah:**
1. Download `qrcode.min.js` (1 file, ~12KB) dari:
   https://github.com/davidshimjs/qrcodejs/raw/master/qrcode.min.js
   → Taruh di `assets/qrcode.min.js`

2. Tambahkan di `index.html` **sebelum** `<script src="config.js">`:
   ```html
   <script src="assets/qrcode.min.js"></script>
   ```

3. Di `script.js`, ganti baris 1050–1053 dengan ini:
   ```js
   // ✅ OFFLINE — pakai config.js QRGenerator
   const localUrl = `photobooth://hasil/${uniqueId}`;
   window.QRGenerator.renderToImg(localUrl,
     document.getElementById('qrCodeImg'), 200);
   ```

### Solusi B — Tanpa Library (Zero Dependency)
`config.js` sudah menyertakan `QRGenerator._canvasFallback()`.
Ini menghasilkan pola visual yang mirip QR (tidak bisa di-scan kamera HP),
tapi cukup sebagai placeholder offline sambil menunggu share via WiFi lokal.

---

## 2. Frame Foto (Aset PNG)

### Masalah
Frame yang dibuat user disimpan di `localStorage` sebagai base64 string.
Ini berfungsi offline, **tapi ada 2 masalah**:

- `localStorage` terbatas ~5–10 MB per domain
- Jika browser di-reset atau di install ulang, semua frame hilang

### Solusi — `config.js` + folder `assets/frames/`

`config.js` mendefinisikan `window.OFFLINE_FRAMES[]` — array frame bawaan
yang **langsung tersedia** begitu file JavaScript dimuat, tanpa internet.

**Langkah:**
1. Taruh file PNG framenya di `assets/frames/`:
   ```
   assets/
   └── frames/
       ├── frame_wedding_aisyah.png
       ├── frame_event_ultah.png
       └── frame_classic_strip.png   ← dibundle default di config.js
   ```

2. Tambahkan entry di `OFFLINE_FRAMES` dalam `config.js`:
   ```js
   {
     id: "built_004",
     name: "Wedding Aisyah",
     category: "wedding",
     eventId: "*",   // "*" = muncul di semua event
     previewSrc: "assets/frames/frame_wedding_aisyah.png",
     config: {
       canvas: { w: 1200, h: 1800 },
       bgColor: "#fff8f3",
       elements: [
         { id: 1, type: "zone",  x: 100, y: 160, w: 1000, h: 650 },
         { id: 2, type: "zone",  x: 100, y: 860, w: 1000, h: 650 },
         // Overlay dekorasi di ATAS zona foto
         { id: 3, type: "image", x: 0, y: 0, w: 1200, h: 1800,
           src: "assets/frames/frame_wedding_aisyah.png" }
       ]
     }
   },
   ```

3. Di `script.js`, ganti semua penggunaan `S.savedFrames` untuk **membaca**
   dengan `FrameStore.getForEvent(S.selectedEventId)`.
   Untuk **menyimpan** frame baru, tetap gunakan seperti sekarang tapi
   panggil `FrameStore.save(frameObj)`.

   **Perubahan minimal di script.js:**

   ```js
   // Baris 807 — startKioskMode()
   // ❌ Lama:
   const frames = S.savedFrames.filter(f => f.eventId === S.selectedEventId);
   // ✅ Baru:
   const frames = window.FrameStore.getForEvent(S.selectedEventId);

   // Baris 873 — kioskStart()
   // ❌ Lama:
   const frames = S.savedFrames.filter(f => f.eventId === S.selectedEventId);
   // ✅ Baru:
   const frames = window.FrameStore.getForEvent(S.selectedEventId);

   // Baris 346 — openFrameManager()
   // ❌ Lama:
   const frames = S.savedFrames.filter(f => f.eventId === S.selectedEventId);
   // ✅ Baru:
   const frames = window.FrameStore.getForEvent(S.selectedEventId);

   // Baris 776 — saveFrameToEvent()
   // ❌ Lama:
   S.savedFrames.push({...});
   localStorage.setItem('pb_frames', JSON.stringify(S.savedFrames));
   // ✅ Baru:
   window.FrameStore.save({ id: Date.now(), eventId: S.selectedEventId, name, config, preview });

   // Baris 210 — LB.deleteFrame()
   // ❌ Lama:
   S.savedFrames = S.savedFrames.filter(f => f.id !== id);
   localStorage.setItem('pb_frames', JSON.stringify(S.savedFrames));
   // ✅ Baru:
   if (!window.FrameStore.delete(id)) {
     notify("Frame bawaan tidak bisa dihapus.", "error"); return;
   }
   ```

---

## 3. Font Google (CSS)

### Masalah
Di `index.html`, font dimuat dari Google Fonts — butuh internet:
```html
<!-- ❌ BUTUH INTERNET -->
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@..." rel="stylesheet">
```

### Solusi — Self-hosted font

**Langkah:**
1. Buka https://fonts.google.com/download?family=Plus+Jakarta+Sans
   dan https://fonts.google.com/download?family=Syne
   dan https://fonts.google.com/download?family=DM+Mono

2. Ekstrak file `.woff2` ke folder `assets/fonts/`

3. Buat file `assets/fonts/fonts.css`:
   ```css
   @font-face {
     font-family: 'Plus Jakarta Sans';
     src: url('PlusJakartaSans-Regular.woff2') format('woff2');
     font-weight: 400; font-style: normal;
   }
   @font-face {
     font-family: 'Plus Jakarta Sans';
     src: url('PlusJakartaSans-Bold.woff2') format('woff2');
     font-weight: 700; font-style: normal;
   }
   @font-face {
     font-family: 'Syne';
     src: url('Syne-ExtraBold.woff2') format('woff2');
     font-weight: 800; font-style: normal;
   }
   @font-face {
     font-family: 'DM Mono';
     src: url('DMMono-Regular.woff2') format('woff2');
     font-weight: 500; font-style: normal;
   }
   ```

4. Di `index.html`, ganti:
   ```html
   <!-- ❌ Hapus ini: -->
   <link href="https://fonts.googleapis.com/..." rel="stylesheet">

   <!-- ✅ Ganti dengan: -->
   <link rel="stylesheet" href="assets/fonts/fonts.css">
   ```

---

## Struktur Folder Final

```
Project_Photobooth/
├── index.html          ← ubah link font (poin 3)
├── style.css           ← tidak perlu diubah
├── script.js           ← ubah 5 titik (poin 1 & 2 di atas)
├── config.js           ← FILE BARU ini ← tambahkan!
├── assets/
│   ├── fonts/
│   │   ├── fonts.css
│   │   ├── PlusJakartaSans-Regular.woff2
│   │   ├── PlusJakartaSans-Bold.woff2
│   │   ├── Syne-ExtraBold.woff2
│   │   └── DMMono-Regular.woff2
│   ├── qrcode.min.js   ← download dari davidshimjs/qrcodejs
│   ├── frames/
│   │   ├── frame_classic_strip.png  ← buat atau import
│   │   ├── frame_wedding_aisyah.png
│   │   └── frame_event_ultah.png
│   └── icons/
│       └── camera-icon.png
└── photos/             ← hasil foto tersimpan di sini (Electron)
```

---

## Cara Menambah Frame Baru (Tanpa Internet)

Setelah setup di atas, proses tambah frame bisa dilakukan dengan 2 cara:

### Cara 1 — Bundling (frame selalu ada)
1. Taruh PNG frame di `assets/frames/`
2. Tambahkan entry di `OFFLINE_FRAMES` dalam `config.js`
3. Tidak perlu buka aplikasi dulu — langsung tersedia saat software jalan

### Cara 2 — Upload lewat UI (seperti sekarang)
1. Buka menu Layout di software
2. Upload PNG dekorasi, atur zona foto
3. Klik Simpan → tersimpan ke `localStorage`
4. Frame langsung muncul di kiosk

### Perbedaan keduanya:
| | Cara 1 (Bundled) | Cara 2 (Upload UI) |
|---|---|---|
| Butuh edit file? | Ya (config.js) | Tidak |
| Hilang jika browser reset? | **Tidak** | Ya |
| Cocok untuk | Frame tetap per paket | Frame custom per event |
| Bisa dihapus user? | Tidak | Ya |

---

## Untuk Dijadikan Software (Electron)

Jika kamu ingin wrap ke `.exe` dengan Electron:

1. `npm init` di folder proyek
2. `npm install electron`
3. Buat `main.js`:
   ```js
   const { app, BrowserWindow, ipcMain } = require('electron');
   const path = require('path');
   const fs = require('fs');

   app.whenReady().then(() => {
     const win = new BrowserWindow({
       width: 1440, height: 900, fullscreen: false,
       webPreferences: {
         preload: path.join(__dirname, 'preload.js'),
         contextIsolation: true
       }
     });
     win.loadFile('index.html');
   });

   // Handler simpan foto ke disk
   ipcMain.handle('save-photo', (event, filename, base64) => {
     const dir = path.join(__dirname, 'photos');
     if (!fs.existsSync(dir)) fs.mkdirSync(dir);
     fs.writeFileSync(path.join(dir, filename), Buffer.from(base64, 'base64'));
     return { success: true };
   });
   ```

4. Buat `preload.js`:
   ```js
   const { contextBridge, ipcRenderer } = require('electron');
   contextBridge.exposeInMainWorld('electronAPI', {
     savePhoto: (filename, base64) =>
       ipcRenderer.invoke('save-photo', filename, base64)
   });
   ```

5. `npx electron .` untuk test
6. `npx electron-builder` untuk build `.exe`

Setelah ini, `window.PhotoExporter.save()` (sudah ada di `config.js`)
akan otomatis tulis foto ke folder `photos/` di disk lokal.
