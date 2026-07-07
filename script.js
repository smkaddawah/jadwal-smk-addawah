// GANTI DENGAN URL GOOGLE APPS SCRIPT BARUMU!
const GAS_URL = "https://script.google.com/macros/s/AKfycbwW1vBnkF3qkGRefOi2-qW5AULt0Yv6ZnUU7czqUFE5Mngdb7s1xWhhRvkR5ENPE7bN/exec";

// ================= 1. VARIABEL GLOBAL & INISIALISASI =================
let currentUser = null, currentRole = null, currentNamaAsli = null;
let productsData = [], cart = [], currentPaymentMethod = "Tunai";
let scannerKasirAktif = null, scannerAdminAktif = null;
let isScanningPausedKasir = false, isScanningPausedAdmin = false;
let rawLaporanData = [], rawDetailData = []; 
let shiftWaktuBuka = null, shiftTransaksiCount = 0, shiftOmset = 0;
let qrisModal = null, chartOmsetObj = null, chartBestSellerObj = null;

document.addEventListener("DOMContentLoaded", () => {
    qrisModal = new bootstrap.Modal(document.getElementById('qrisModal'));
});

// Sound Beep Scanner
function playBeep() { 
    try { const audioCtx = new (window.AudioContext || window.webkitAudioContext)(); const osc = audioCtx.createOscillator(); const gainNode = audioCtx.createGain(); osc.connect(gainNode); gainNode.connect(audioCtx.destination); osc.type = 'sine'; osc.frequency.setValueAtTime(900, audioCtx.currentTime); gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); osc.start(); osc.stop(audioCtx.currentTime + 0.1); } catch (e) { } 
}

// ================= 2. FUNGSI LOGIN & SHIFT LOGOUT =================
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const btn = document.getElementById('btn-login');

    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Loading...';
    btn.disabled = true;

    try {
        const response = await fetch(`${GAS_URL}?action=login&username=${user}&password=${pass}`);
        const result = await response.json();

        if (result.status === "success") {
            currentUser = result.username;
            currentRole = result.role;
            currentNamaAsli = result.nama_lengkap;
            shiftWaktuBuka = new Date().toLocaleTimeString("id-ID");
            
            document.getElementById('login-page').classList.add('d-none');
            document.getElementById('app-page').classList.remove('d-none');
            document.getElementById('user-display').textContent = `${currentRole}: ${currentNamaAsli}`;
            
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Selamat datang, ${currentNamaAsli}!`, showConfirmButton: false, timer: 2500 });
            
            if (currentRole === "Admin") {
                document.getElementById('admin-panel').classList.remove('d-none');
                loadAdminDashboard(); loadSuppliersDropdown(); 
            } else if (currentRole === "Supplier") {
                document.getElementById('supplier-panel').classList.remove('d-none');
                document.getElementById('supplier-name-display').textContent = currentNamaAsli;
                loadSupplierDashboard(); 
            } else {
                document.getElementById('kasir-panel').classList.remove('d-none');
                loadProducts(); 
            }
        } else { Swal.fire('Gagal Login', result.message, 'error'); }
    } catch (error) { Swal.fire('Error', 'Gagal terhubung ke database server.', 'error'); }
    
    btn.textContent = "Masuk"; btn.disabled = false;
});

document.getElementById('btn-logout').addEventListener('click', () => {
    let htmlText = (currentRole === "Kasir") 
        ? `Shift aktif sejak: <b>${shiftWaktuBuka}</b><br>Jumlah Transaksi: <b>${shiftTransaksiCount}</b><br>Omset Shift: <b class="text-success">Rp ${shiftOmset.toLocaleString('id-ID')}</b><br><br>Akhiri shift dan keluar?` 
        : `Yakin ingin keluar dari sistem?`;

    Swal.fire({
        title: 'Tutup Sesi?', html: htmlText, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Tutup & Keluar!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            if(currentRole === "Kasir" && shiftTransaksiCount > 0) {
                await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "closeShift", kasir: currentNamaAsli, waktu_buka: shiftWaktuBuka, trx_count: shiftTransaksiCount, omset: shiftOmset }) });
            }
            location.reload(); 
        }
    });
});

// ================= 3. FUNGSI KERANJANG KASIR & PEMBAYARAN =================
async function loadProducts() {
    const list = document.getElementById('product-list');
    list.innerHTML = "<div class='col-12 text-center text-muted'>Memuat katalog...</div>";
    try {
        const res = await fetch(`${GAS_URL}?action=getProducts`); const result = await res.json();
        if (result.status === "success") {
            productsData = result.data; list.innerHTML = "";
            productsData.forEach(p => {
                const border = p.stok <= p.min_stok ? "border: 2px solid red;" : "";
                list.innerHTML += `<div class="col-6 col-md-4 col-lg-3"><div class="card product-card h-100 text-center" style="${border}" onclick="addToCart('${p.kode_barang}')"><div class="card-body p-3"><h6 class="fw-bold mb-1" style="font-size:13px;">${p.nama_barang}</h6><p class="custom-text-green fw-bold mb-1">Rp ${p.harga_jual.toLocaleString('id-ID')}</p><small class="text-muted" style="font-size:11px;">Stok: <span class="${p.stok <= p.min_stok ? 'text-danger fw-bold' : ''}">${p.stok}</span></small></div></div></div>`;
            });
        }
    } catch (error) { list.innerHTML = "<div class='text-danger'>Gagal memuat produk.</div>"; }
}

function addToCart(kode) {
    const p = productsData.find(x => x.kode_barang == kode); if (!p) return;
    const item = cart.find(x => x.kode_barang == kode);
    if (item) { item.qty += 1; item.subtotal = item.qty * item.harga_jual; } 
    else { cart.push({ kode_barang: p.kode_barang, nama_barang: p.nama_barang, harga_jual: p.harga_jual, qty: 1, subtotal: p.harga_jual }); }
    updateCartUI();
}

function updateCartUI() {
    const tbody = document.getElementById('cart-body'); tbody.innerHTML = ""; let subtotal = 0;
    cart.forEach((c, i) => { 
        subtotal += c.subtotal; 
        tbody.innerHTML += `<tr><td><small class="fw-bold">${c.nama_barang}</small></td><td>${c.qty}</td><td>${c.subtotal.toLocaleString('id-ID')}</td><td><button class="btn btn-sm btn-danger py-0" onclick="cart.splice(${i},1); updateCartUI();">x</button></td></tr>`; 
    });
    document.getElementById('subtotal-price').textContent = subtotal.toLocaleString('id-ID'); 
    calcFinalTotal();
}

function calcFinalTotal() {
    const sub = cart.reduce((s, c) => s + c.subtotal, 0); 
    const diskon = Number(document.getElementById('input-diskon').value) || 0;
    document.getElementById('total-price').textContent = Math.max(0, sub - diskon).toLocaleString('id-ID');
}
document.getElementById('input-diskon').addEventListener('input', calcFinalTotal);

document.getElementById('btn-pay-cash').addEventListener('click', () => {
    if(!cart.length) return Swal.fire('Kosong', 'Pilih barang dulu!', 'warning');
    const finalTotal = parseInt(document.getElementById('total-price').textContent.replace(/\./g, ''));
    const diskon = Number(document.getElementById('input-diskon').value) || 0;
    
    Swal.fire({ title: 'Bayar Tunai', html: `Total Bayar: <b>Rp ${finalTotal.toLocaleString('id-ID')}</b>`, input: 'number', inputPlaceholder: 'Masukkan uang pelanggan...', showCancelButton: true, confirmButtonColor: '#2E8B57',
        inputValidator: (v) => { if(!v || Number(v)<finalTotal) return 'Uang pelanggan kurang!'; }
    }).then((r) => { 
        if (r.isConfirmed) { 
            const uangBayar = Number(r.value);
            processTrx(uangBayar, uangBayar - finalTotal, diskon, finalTotal, "Tunai"); 
            Swal.fire('Sukses!', `Kembalian:<br><h1 class="text-success mt-2">Rp ${(uangBayar - finalTotal).toLocaleString('id-ID')}</h1>`, 'success'); 
        }
    });
});

document.getElementById('btn-pay-qr').addEventListener('click', () => {
    if(!cart.length) return Swal.fire('Kosong', 'Pilih barang dulu!', 'warning');
    document.getElementById('modal-total').textContent = document.getElementById('total-price').textContent; 
    qrisModal.show();
});

document.getElementById('btn-confirm-qr').addEventListener('click', () => {
    qrisModal.hide(); 
    const finalTotal = parseInt(document.getElementById('total-price').textContent.replace(/\./g, ''));
    const diskon = Number(document.getElementById('input-diskon').value) || 0;
    processTrx(finalTotal, 0, diskon, finalTotal, "QRIS");
    Swal.fire({toast:true, position:'top-end', icon:'success', title:'QRIS Sukses!', showConfirmButton:false, timer:2000});
});

async function processTrx(bayar, kembali, diskon, total, metode) {
    const trxId = "TRX-" + new Date().getTime(); 
    const payload = { action: "addTransaction", kasir: currentNamaAsli, total_bayar: total, diskon: diskon, metode_pembayaran: metode, items: cart };

    const sb = document.getElementById('struk-body'); sb.innerHTML = "";
    cart.forEach(c => { sb.innerHTML += `<tr><td colspan="2">${c.nama_barang}</td></tr><tr><td>${c.qty} x ${c.harga_jual}</td><td style="text-align:right;">${c.subtotal}</td></tr>`; });
    
    document.getElementById('struk-id').textContent = trxId; 
    document.getElementById('struk-tanggal').textContent = new Date().toLocaleString('id-ID');
    document.getElementById('struk-total').textContent = total.toLocaleString('id-ID');
    
    if(diskon > 0){ document.getElementById('struk-diskon-area').classList.remove('d-none'); document.getElementById('struk-diskon').textContent = diskon.toLocaleString('id-ID'); } 
    else { document.getElementById('struk-diskon-area').classList.add('d-none'); }
    
    if(metode === "QRIS") { document.getElementById('struk-tunai-area').classList.add('d-none'); } 
    else { document.getElementById('struk-tunai-area').classList.remove('d-none'); document.getElementById('struk-bayar').textContent = bayar.toLocaleString('id-ID'); document.getElementById('struk-kembali').textContent = kembali.toLocaleString('id-ID'); }
    
    document.getElementById('print-area').classList.remove('d-none'); window.print(); document.getElementById('print-area').classList.add('d-none'); 
    
    shiftTransaksiCount++; shiftOmset += total; cart = []; document.getElementById('input-diskon').value = "0"; updateCartUI(); 
    try { await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) }); loadProducts(); } catch (e) { }
}

// ================= 4. SCANNER KASIR & ADMIN =================
document.getElementById('barcode-input').addEventListener('keypress', (e) => { if(e.key === 'Enter' && e.target.value) { addToCart(e.target.value.trim()); e.target.value = ""; } });

document.getElementById('mode-fisik-kasir').addEventListener('click', () => { 
    if (scannerKasirAktif) { scannerKasirAktif.clear(); scannerKasirAktif = null; } 
    document.getElementById('reader').classList.add('d-none'); document.getElementById('barcode-input').classList.remove('d-none'); document.getElementById('barcode-input').focus(); 
});
document.getElementById('mode-kamera-kasir').addEventListener('click', () => {
    document.getElementById('barcode-input').classList.add('d-none'); document.getElementById('reader').classList.remove('d-none');
    if (!scannerKasirAktif) {
        scannerKasirAktif = new Html5QrcodeScanner("reader", { fps: 15, qrbox: {width: 250, height: 150} }, false);
        scannerKasirAktif.render((decodedText) => {
            if (isScanningPausedKasir) return;
            isScanningPausedKasir = true; playBeep(); addToCart(decodedText); Swal.fire({ toast: true, position: 'bottom', icon: 'success', title: 'Berhasil Scan!', showConfirmButton: false, timer: 1500 });
            setTimeout(() => { isScanningPausedKasir = false; }, 2000);
        }, (err) => { });
    }
});

document.getElementById('input-kode').addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('input-nama').focus(); } });
document.getElementById('mode-fisik-admin').addEventListener('click', () => { if (scannerAdminAktif) { scannerAdminAktif.clear(); scannerAdminAktif = null; } document.getElementById('reader-admin').classList.add('d-none'); document.getElementById('input-kode').focus(); });
document.getElementById('mode-kamera-admin').addEventListener('click', () => {
    document.getElementById('reader-admin').classList.remove('d-none');
    if (!scannerAdminAktif) {
        scannerAdminAktif = new Html5QrcodeScanner("reader-admin", { fps: 15, qrbox: {width: 250, height: 150} }, false);
        scannerAdminAktif.render((decodedText) => {
            if (isScanningPausedAdmin) return;
            isScanningPausedAdmin = true; playBeep(); document.getElementById('input-kode').value = decodedText; document.getElementById('input-kode').style.backgroundColor = "#d4edda"; document.getElementById('input-nama').focus(); 
            setTimeout(() => { isScanningPausedAdmin = false; document.getElementById('input-kode').style.backgroundColor = ""; }, 2000);
        }, (err) => { });
    }
});

// ================= 5. FUNGSI ADMIN & ANALITIK TAB =================
document.querySelectorAll('#admin-tabs .nav-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#admin-tabs .nav-link').forEach(b => { b.classList.replace('custom-bg-green', 'bg-secondary'); });
        e.target.classList.replace('bg-secondary', 'custom-bg-green');
        document.querySelectorAll('.admin-tab-content').forEach(panel => { panel.classList.add('d-none'); });
        document.getElementById(e.target.dataset.target).classList.remove('d-none');
        
        const t = e.target.dataset.target;
        if(t === 'admin-dashboard') loadAdminDashboard();
        if(t === 'admin-daftar-barang') loadAdminKatalog();
        if(t === 'admin-laporan' || t === 'admin-analitik') loadAdminReports();
        if(t === 'admin-mutasi') loadMutasiStok();
        if(t === 'admin-akun') loadAdminAkun();
    });
});

async function loadAdminDashboard() {
    try {
        const res = await fetch(`${GAS_URL}?action=getDashboardData`); const data = (await res.json());
        if(chartOmsetObj) chartOmsetObj.destroy();
        chartOmsetObj = new Chart(document.getElementById('chartOmset'), { type: 'line', data: { labels: Object.keys(data.chart_omset), datasets: [{ label: 'Omset (Rp)', data: Object.values(data.chart_omset), borderColor: '#2E8B57', tension: 0.3, fill: true, backgroundColor: 'rgba(46, 139, 87, 0.1)' }] }});
        
        if(chartBestSellerObj) chartBestSellerObj.destroy();
        chartBestSellerObj = new Chart(document.getElementById('chartBestSeller'), { type: 'bar', data: { labels: data.top_products.map(x => x[0]), datasets: [{ label: 'Terjual (Qty)', data: data.top_products.map(x => x[1]), backgroundColor: '#3CB371' }] }, options: { indexAxis: 'y' }});
    } catch(e){}
}

async function loadAdminReports() {
    const tLaporan = document.getElementById('laporan-body'); tLaporan.innerHTML = "<tr><td colspan='9' class='text-center'>Memuat Data...</td></tr>";
    try {
        const resFin = await fetch(`${GAS_URL}?action=getFinanceReport`); rawLaporanData = (await resFin.json()).data;
        const resDet = await fetch(`${GAS_URL}?action=getDetailReport`); rawDetailData = (await resDet.json()).data;
        
        renderLaporan(rawLaporanData);
        generateAnalisisLaba(rawLaporanData, rawDetailData);
    } catch (e) { tLaporan.innerHTML = "<tr><td colspan='9' class='text-danger text-center'>Gagal Load DB</td></tr>"; }
}

function renderLaporan(dataArray) {
    const tbody = document.getElementById('laporan-body'); tbody.innerHTML = "";
    if (dataArray.length === 0) { tbody.innerHTML = "<tr><td colspan='9' class='text-center'>Data kosong.</td></tr>"; return; }
    
    dataArray.forEach(r => {
        let tgl = r.tanggal; if(tgl.includes('T') || tgl.includes('Z')) tgl = new Date(r.tanggal).toLocaleDateString('id-ID');
        const d = rawDetailData.filter(x => x.id_transaksi === r.id_transaksi);
        
        let rowCount = d.length + (r.diskon > 0 ? 1 : 0) + 1; 

        d.forEach((b, i) => {
            const isF = (i === 0);
            let rowHtml = `<tr>`;
            
            if (isF) {
                rowHtml += `
                <td rowspan="${rowCount}" class="align-middle fw-bold bg-light">${r.id_transaksi}</td>
                <td rowspan="${rowCount}" class="align-middle bg-light">${tgl}<br><small>${r.waktu}</small></td>
                <td rowspan="${rowCount}" class="align-middle bg-light">${r.kasir}</td>
                <td rowspan="${rowCount}" class="align-middle bg-light"><span class="badge bg-secondary">${r.metode_pembayaran}</span></td>`;
            }
            
            rowHtml += `<td>${b.nama_barang}</td><td>${b.qty}</td><td>Rp ${Number(b.harga_jual).toLocaleString('id-ID')}</td><td class="text-end">Rp ${Number(b.subtotal).toLocaleString('id-ID')}</td>`;
            
            if (isF) { rowHtml += `<td rowspan="${rowCount}" class="align-middle bg-light"><button class="btn btn-sm btn-outline-danger w-100" onclick="voidTrx('${r.id_transaksi}')">Void / Batal</button></td>`; }
            
            rowHtml += `</tr>`;
            tbody.innerHTML += rowHtml;
        });

        if (r.diskon > 0) {
            tbody.innerHTML += `<tr><td colspan="3" class="text-end text-danger fw-bold">Diskon</td><td class="text-end text-danger fw-bold">- Rp ${Number(r.diskon).toLocaleString('id-ID')}</td></tr>`;
        }
        
        tbody.innerHTML += `<tr class="table-success"><td colspan="3" class="text-end fw-bold">TOTAL TRANSAKSI INI:</td><td class="text-end fw-bold fs-6">Rp ${Number(r.total_bayar).toLocaleString('id-ID')}</td></tr>`;
    });
}

function generateAnalisisLaba(laporan, detail) {
    let labaMap = {}; let totalNetLaba = 0;
    laporan.forEach(r => {
        let tgl = r.tanggal; if(tgl.includes('T') || tgl.includes('Z')) tgl = new Date(r.tanggal).toLocaleDateString('id-ID');
        if(!labaMap[tgl]) labaMap[tgl] = { omset:0, modal:0, diskon:0 };
        labaMap[tgl].omset += Number(r.total_bayar) + Number(r.diskon); 
        labaMap[tgl].diskon += Number(r.diskon);
        
        const d = detail.filter(x => x.id_transaksi === r.id_transaksi && !String(x.status_retur).includes("VOID"));
        d.forEach(b => { labaMap[tgl].modal += (Number(b.harga_beli) * Number(b.qty)); });
    });
    
    const lBody = document.getElementById('laba-body'); lBody.innerHTML = "";
    Object.keys(labaMap).forEach(k => {
        let l = labaMap[k]; let bersih = l.omset - l.modal - l.diskon; totalNetLaba += bersih;
        lBody.innerHTML += `<tr><td>${k}</td><td>Rp ${l.omset.toLocaleString('id-ID')}</td><td class="text-danger">Rp ${l.modal.toLocaleString('id-ID')}</td><td class="text-warning">Rp ${l.diskon.toLocaleString('id-ID')}</td><td class="fw-bold text-success">Rp ${bersih.toLocaleString('id-ID')}</td></tr>`;
    });
    document.getElementById('total-laba-bersih').textContent = totalNetLaba.toLocaleString('id-ID');

    let prodMap = {};
    detail.forEach(b => {
        if(String(b.status_retur).includes("VOID")) return;
        if(!prodMap[b.nama_barang]) prodMap[b.nama_barang] = { qty:0, rev:0 };
        prodMap[b.nama_barang].qty += Number(b.qty); prodMap[b.nama_barang].rev += Number(b.subtotal);
    });
    let sProd = []; for(let p in prodMap) sProd.push({n: p, q: prodMap[p].qty, r: prodMap[p].rev});
    sProd.sort((a,b) => b.q - a.q);
    
    const bsBody = document.getElementById('bestseller-body'); bsBody.innerHTML = "";
    sProd.forEach((p,i) => { bsBody.innerHTML += `<tr><td>#${i+1}</td><td class="fw-bold">${p.n}</td><td>${p.q} Pcs</td><td>Rp ${p.r.toLocaleString('id-ID')}</td></tr>`; });
}

window.toggleAnalitik = function(jenis) {
    document.getElementById('btn-show-laba').classList.toggle('active', jenis==='laba'); document.getElementById('btn-show-bestseller').classList.toggle('active', jenis==='bestseller');
    document.getElementById('area-laba').classList.toggle('d-none', jenis!=='laba'); document.getElementById('area-bestseller').classList.toggle('d-none', jenis!=='bestseller');
}

async function loadMutasiStok() {
    const tbody = document.getElementById('mutasi-body'); tbody.innerHTML = "<tr><td colspan='6'>Memuat Ledger...</td></tr>";
    try {
        const res = await fetch(`${GAS_URL}?action=getStockLedger`); const result = await res.json();
        tbody.innerHTML = "";
        if(result.data.length === 0) return tbody.innerHTML = "<tr><td colspan='6'>Buat Sheet 'Stock_Ledger' di Google Sheets Anda terlebih dahulu.</td></tr>";
        result.data.forEach(m => {
            let badge = m.jenis==="MASUK" ? `<span class="badge bg-success">MASUK</span>` : `<span class="badge bg-danger">KELUAR</span>`;
            tbody.innerHTML += `<tr><td>${m.waktu}</td><td>${m.kode}</td><td>${m.nama}</td><td>${badge}</td><td class="fw-bold">${m.qty}</td><td>${m.ket}</td></tr>`;
        });
    } catch(e) {}
}

window.voidTrx = function(idTrx) {
    Swal.fire({ title: 'Void Transaksi?', text: 'Membatalkan dan mengembalikan stok.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Void!' }).then(async (r) => {
        if(r.isConfirmed) { Swal.fire({title:'Memproses...'}); await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "voidTransaction", id_transaksi: idTrx, admin: currentNamaAsli }) }); Swal.fire('Sukses', 'Void berhasil!', 'success'); loadAdminReports(); }
    });
}

document.getElementById('btn-export-excel').addEventListener('click', () => { const wb = XLSX.utils.table_to_book(document.getElementById('laporan-table'), {sheet:"Laporan"}); XLSX.writeFile(wb, "Data_Kantin.xlsx"); });

// ================= 6. DAFTAR BARANG & INPUT PRODUK =================
async function loadAdminKatalog() {
    const list = document.getElementById('katalog-admin-list');
    list.innerHTML = "<div class='col-12 text-center'>Memuat data barang dari server...</div>";
    try {
        const res = await fetch(`${GAS_URL}?action=getProducts`);
        const result = await res.json();
        
        productsData = result.data; // Menyimpan data ke memori agar bisa diedit
        list.innerHTML = "";
        
        result.data.forEach(p => {
            const bgClass = p.stok <= p.min_stok ? "bg-danger text-white" : "bg-white";
            const textClass = p.stok <= p.min_stok ? "text-white" : "text-muted";
            list.innerHTML += `
            <div class="col-md-4 col-sm-6">
                <div class="card shadow-sm border-0 h-100 ${bgClass}">
                    <div class="card-body">
                        <h6 class="fw-bold border-bottom pb-2 ${textClass}">${p.nama_barang}</h6>
                        <small class="d-block mb-1">Kode: <b>${p.kode_barang}</b></small>
                        <small class="d-block mb-1">Harga Jual: <b>Rp ${Number(p.harga_jual).toLocaleString('id-ID')}</b></small>
                        <small class="d-block mb-1">Pemilik: <b>${p.pemilik}</b></small>
                        <h5 class="mt-2 mb-0">Stok: ${p.stok}</h5>
                    </div>
                    <div class="card-footer bg-transparent border-0 d-flex gap-2">
                        <button class="btn btn-sm btn-primary flex-grow-1" onclick="editProduk('${p.kode_barang}')">Edit</button>
                        <button class="btn btn-sm btn-dark flex-grow-1" onclick="hapusProduk('${p.kode_barang}')">Hapus</button>
                    </div>
                </div>
            </div>`;
        });
    } catch(e) { list.innerHTML = "<div class='text-danger'>Gagal muat daftar barang.</div>"; }
}

if(document.getElementById('btn-refresh-daftar')){
    document.getElementById('btn-refresh-daftar').addEventListener('click', loadAdminKatalog);
}

window.editProduk = function(kode) {
    const p = productsData.find(x => x.kode_barang == kode);
    if(p) {
        document.getElementById('input-kode').value = p.kode_barang;
        document.getElementById('input-nama').value = p.nama_barang;
        document.getElementById('input-kategori').value = p.kategori;
        document.getElementById('input-beli').value = p.harga_beli;
        document.getElementById('input-jual').value = p.harga_jual;
        document.getElementById('input-stok').value = p.stok;
        document.getElementById('input-minstok').value = p.min_stok;
        
        // Pindah ke tab Input Produk
        document.querySelector('[data-target="admin-stok"]').click();
        Swal.fire({toast:true, position:'top', icon:'info', title:'Mode Edit Diaktifkan', showConfirmButton:false, timer:2000});
    }
}

window.hapusProduk = function(kode) {
    Swal.fire({ title: 'Hapus Barang?', text: `Barang dengan kode ${kode} akan dihapus permanen!`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus!'
    }).then(async (result) => {
        if(result.isConfirmed) {
            Swal.fire({title:'Menghapus...', allowOutsideClick:false});
            await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "deleteProduct", kode_barang: kode }) });
            Swal.fire('Terhapus!', 'Barang berhasil dihapus.', 'success');
            loadAdminKatalog(); 
        }
    });
}

if(document.getElementById('btn-generate-barcode')){
    document.getElementById('btn-generate-barcode').addEventListener('click', () => {
        const randomCode = 'BRC' + Math.floor(Math.random() * 100000000);
        document.getElementById('input-kode').value = randomCode;
        document.getElementById('barcode-preview-area').classList.remove('d-none');
        JsBarcode("#barcodeCanvas", randomCode, { format: "CODE128", lineColor: "#000", width: 2, height: 50, displayValue: true });
    });
}

document.getElementById('form-barang').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-simpan-barang'); btn.innerHTML = "Menyimpan..."; btn.disabled = true;
    const payload = {
        action: "upsertProduct", kode_barang: document.getElementById('input-kode').value, nama_barang: document.getElementById('input-nama').value,
        kategori: document.getElementById('input-kategori').value, pemilik: document.getElementById('input-pemilik').value, 
        harga_beli: document.getElementById('input-beli').value, harga_jual: document.getElementById('input-jual').value,
        stok: document.getElementById('input-stok').value, min_stok: document.getElementById('input-minstok').value
    };
    try {
        const res = await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) });
        if((await res.json()).status === "success") { Swal.fire('Tersimpan!', 'Barang disimpan.', 'success'); document.getElementById('form-barang').reset(); }
    } catch (error) { Swal.fire('Error', 'Gagal menyimpan.', 'error'); }
    btn.innerHTML = "Simpan Produk"; btn.disabled = false;
});

// ================= 7. FUNGSI SUPPLIER & KELOLA RETUR =================
async function loadSuppliersDropdown() { 
    try { const res = await fetch(`${GAS_URL}?action=getSuppliers`); const r = await res.json(); let o = `<option value="Kantin">Kantin Pribadi</option>`; r.data.forEach(n => { o += `<option value="${n}">${n}</option>`; }); document.getElementById('input-pemilik').innerHTML = o; document.getElementById('filter-pemilik').innerHTML = `<option value="Semua">Semua Pemilik</option>` + o; } catch (e) {} 
}

let tempQtyRetur = 0; let tempUangRetur = 0;
if(document.getElementById('btn-hitung-titipan')){
    document.getElementById('btn-hitung-titipan').addEventListener('click', async () => {
        const pemilikDipilih = document.getElementById('filter-pemilik').value;
        const tbody = document.getElementById('laporan-detail-body');
        const btnRetur = document.getElementById('btn-retur-titipan');
        
        tbody.innerHTML = "<tr><td colspan='5' class='text-center'>Menghitung...</td></tr>";
        if (pemilikDipilih !== "Semua" && pemilikDipilih !== "Kantin") { btnRetur.classList.remove('d-none'); } else { btnRetur.classList.add('d-none'); }

        try {
            const resPro = await fetch(`${GAS_URL}?action=getProducts`); productsData = (await resPro.json()).data;
            const resDet = await fetch(`${GAS_URL}?action=getDetailReport`); rawDetailData = (await resDet.json()).data;
            
            tbody.innerHTML = ""; tempQtyRetur = 0; tempUangRetur = 0;
            let produkTerkait = (pemilikDipilih !== "Semua") ? productsData.filter(p => p.pemilik === pemilikDipilih) : productsData;

            produkTerkait.forEach(produk => {
                const terjual = rawDetailData.filter(d => d.kode_barang == produk.kode_barang && d.status_retur !== "LUNAS");
                const qtyTerjual = terjual.reduce((sum, item) => sum + Number(item.qty), 0);
                if (qtyTerjual > 0) {
                    tempQtyRetur += qtyTerjual;
                    const hakPemilik = qtyTerjual * Number(produk.harga_beli);
                    tempUangRetur += hakPemilik;
                    tbody.innerHTML += `<tr><td><b>${produk.nama_barang}</b></td><td>${produk.pemilik}</td><td>${qtyTerjual}</td><td class="text-danger fw-bold">${produk.stok} Pcs</td><td>Rp ${hakPemilik.toLocaleString('id-ID')}</td></tr>`;
                }
            });
            if (tempQtyRetur === 0) tbody.innerHTML = "<tr><td colspan='5' class='text-center text-muted'>Belum ada barang terjual.</td></tr>";
            document.getElementById('titipan-qty').textContent = tempQtyRetur; document.getElementById('titipan-uang').textContent = tempUangRetur.toLocaleString('id-ID');
        } catch (e) { tbody.innerHTML = "<tr><td colspan='5' class='text-danger'>Gagal load data.</td></tr>"; }
    });
}

if(document.getElementById('btn-retur-titipan')){
    document.getElementById('btn-retur-titipan').addEventListener('click', async () => {
        if (tempQtyRetur === 0) return;
        const pemilikDipilih = document.getElementById('filter-pemilik').value;
        Swal.fire({
            title: 'Konfirmasi Retur', html: `Hak Uang: Rp ${tempUangRetur.toLocaleString('id-ID')}<br>Selesaikan pembayaran ke <b>${pemilikDipilih}</b>?`,
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#28a745', confirmButtonText: 'Ya, Selesaikan!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                document.getElementById('btn-retur-titipan').disabled = true;
                try {
                    await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "returTitipan", pemilik: pemilikDipilih, qty_total: tempQtyRetur, uang_total: tempUangRetur, admin: currentUser }) });
                    Swal.fire('Selesai!', 'Data retur direkam.', 'success'); document.getElementById('btn-hitung-titipan').click(); 
                } catch(e) { Swal.fire('Gagal!', 'Error koneksi.', 'error'); }
                document.getElementById('btn-retur-titipan').disabled = false;
            }
        });
    });
}

if(document.getElementById('btn-refresh-supplier')){
    document.getElementById('btn-refresh-supplier').addEventListener('click', loadSupplierDashboard);
}

async function loadSupplierDashboard() {
    const tbody = document.getElementById('supplier-body');
    const tbodyRiwayat = document.getElementById('supplier-riwayat-body');
    tbody.innerHTML = "<tr><td colspan='4' class='text-center'>Mengambil data...</td></tr>";
    try {
        const resPro = await fetch(`${GAS_URL}?action=getProducts`); const allProducts = (await resPro.json()).data;
        const resDet = await fetch(`${GAS_URL}?action=getDetailReport`); const allDetails = (await resDet.json()).data;
        const resHist = await fetch(`${GAS_URL}?action=getSupplierHistory&pemilik=${currentNamaAsli}`); const historyRetur = (await resHist.json()).data;
        
        const myProducts = allProducts.filter(p => p.pemilik === currentNamaAsli);
        let totalQty = 0; let totalUang = 0; tbody.innerHTML = "";
        
        myProducts.forEach(produk => {
            const terjual = allDetails.filter(d => d.kode_barang == produk.kode_barang && d.status_retur !== "LUNAS");
            const qty = terjual.reduce((sum, item) => sum + Number(item.qty), 0);
            
            totalQty += qty; 
            const uang = qty * Number(produk.harga_beli); 
            totalUang += uang;
            
            const isLaku = qty > 0 ? "fw-bold text-success" : "text-muted";
            tbody.innerHTML += `<tr><td><b>${produk.nama_barang}</b></td><td class="${isLaku}">${qty} Terjual</td><td class="text-danger fw-bold">${produk.stok}</td><td>Rp ${uang.toLocaleString('id-ID')}</td></tr>`;
        });
        if (myProducts.length === 0) tbody.innerHTML = "<tr><td colspan='4' class='text-center text-muted'>Belum ada barang yang didaftarkan Admin.</td></tr>";
        
        document.getElementById('sup-qty').textContent = totalQty; document.getElementById('sup-uang').textContent = totalUang.toLocaleString('id-ID');

        if(tbodyRiwayat){
            tbodyRiwayat.innerHTML = "";
            if(historyRetur.length === 0) { tbodyRiwayat.innerHTML = "<tr><td colspan='4' class='text-center text-muted'>Belum ada riwayat pencairan uang.</td></tr>"; }
            historyRetur.forEach(h => {
                tbodyRiwayat.innerHTML += `<tr><td>${h.id}</td><td>${h.tgl}<br><small>${h.waktu}</small></td><td>${h.qty} Pcs</td><td class="fw-bold">Rp ${Number(h.uang).toLocaleString('id-ID')}</td></tr>`;
            });
        }
    } catch (error) { tbody.innerHTML = "<tr><td colspan='4' class='text-danger text-center'>Gagal mengambil data.</td></tr>"; }
}

// ================= 8. FITUR KELOLA AKUN ADMIN =================
async function loadAdminAkun() {
    const tbody = document.getElementById('akun-body');
    if(!tbody) return; // Mencegah error jika bukan admin
    tbody.innerHTML = "<tr><td colspan='5' class='text-center'>Memuat data akun...</td></tr>";
    try {
        const res = await fetch(`${GAS_URL}?action=getUsers`);
        const result = await res.json();
        tbody.innerHTML = "";
        result.data.forEach(u => {
            const roleBadge = u.role === 'Admin' ? 'bg-danger' : (u.role === 'Supplier' ? 'bg-warning text-dark' : 'bg-primary');
            tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${u.username}</td>
                <td>${u.password}</td>
                <td><span class="badge ${roleBadge}">${u.role}</span></td>
                <td>${u.nama_lengkap}</td>
                <td>
                    <button class="btn btn-sm btn-info text-white" onclick="editAkun('${u.username}', '${u.password}', '${u.role}', '${u.nama_lengkap}')">Edit</button>
                    <button class="btn btn-sm btn-dark" onclick="hapusAkun('${u.username}')">Hapus</button>
                </td>
            </tr>`;
        });
    } catch(e) { tbody.innerHTML = "<tr><td colspan='5' class='text-danger'>Gagal memuat data akun. Pastikan Code.gs sudah di Deploy Ulang.</td></tr>"; }
}

window.editAkun = function(user, pass, role, nama) {
    document.getElementById('akun-username').value = user; 
    document.getElementById('akun-username').readOnly = true; 
    document.getElementById('akun-password').value = pass;
    document.getElementById('akun-role').value = role;
    document.getElementById('akun-nama').value = nama;
}

window.hapusAkun = function(user) {
    if(user === currentUser) return Swal.fire('Ditolak', 'Anda tidak bisa menghapus akun yang sedang dipakai!', 'error');
    Swal.fire({ title: 'Hapus Akun?', text: `Akun ${user} akan dihapus permanen!`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus!'
    }).then(async (result) => {
        if(result.isConfirmed) {
            Swal.fire({title:'Menghapus...', allowOutsideClick:false});
            await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: "deleteUser", username: user }) });
            Swal.fire('Terhapus!', 'Akun berhasil dihapus.', 'success'); 
            loadAdminAkun();
        }
    });
}

// INI ADALAH PENAHAN FORM AKUN AGAR TIDAK LOGOUT
if(document.getElementById('form-akun')){
    document.getElementById('form-akun').addEventListener('submit', async (e) => {
        e.preventDefault(); // Menahan refresh
        
        const btn = document.getElementById('btn-simpan-akun'); 
        btn.textContent = "Menyimpan..."; 
        btn.disabled = true;
        
        const payload = {
            action: "upsertUser", 
            username: document.getElementById('akun-username').value,
            password: document.getElementById('akun-password').value, 
            role: document.getElementById('akun-role').value,
            nama_lengkap: document.getElementById('akun-nama').value
        };
        
        try {
            await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) });
            Swal.fire({toast:true, position:'top', icon:'success', title:'Akun disimpan!', showConfirmButton:false, timer:2000});
            document.getElementById('form-akun').reset(); 
            document.getElementById('akun-username').readOnly = false;
            loadAdminAkun(); 
        } catch(err) {
            Swal.fire('Error', 'Gagal menyimpan akun', 'error');
        }
        
        btn.textContent = "Simpan Akun"; 
        btn.disabled = false;
    });
}