// --- GANTI DENGAN LINK DEPLOY TERBARU ANDA ---
const API_URL = "https://script.google.com/macros/s/AKfycbyt9vQ4kPLTIxUoxTmQ873bnuZ98VXDI4Kv-JRHDnfIhG7jz3z_MJimlhNJgRxNELNj4g/exec";

let userData = null;
let allJadwalGuru = []; 
let allMapelData = []; 

const loginSection = document.getElementById('login-section');
const dashGuru = document.getElementById('dashboard-guru');
const dashAdmin = document.getElementById('dashboard-admin');

// ==========================================
// 1. PROSES LOGIN
// ==========================================
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    btn.textContent = "Memproses..."; btn.disabled = true;
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'login',
                username: document.getElementById('username').value,
                password: document.getElementById('password').value
            })
        });
        const result = await response.json();
        if (result.status === 'success') {
            userData = result;
            loginSection.classList.add('hidden');
            if(userData.role === 'admin') {
                tampilkanAdmin();
            } else {
                tampilkanGuru();
            }
        } else {
            document.getElementById('login-pesan').textContent = result.pesan;
        }
    } catch (error) {
        alert("Gagal terhubung ke server.");
    } finally {
        btn.textContent = "Masuk"; btn.disabled = false;
    }
});

// ==========================================
// 2. DASHBOARD GURU & MUAT DATA
// ==========================================
async function tampilkanGuru() {
    dashGuru.classList.remove('hidden');
    document.getElementById('guru-greeting').textContent = `Selamat datang, ${userData.nama}!`;
    
    // Listener untuk deteksi real-time
    document.getElementById('select-kelas').addEventListener('change', updateSesiAvailability);
    document.getElementById('select-hari').addEventListener('change', updateSesiAvailability);

    muatDataGuru();
}

async function muatDataGuru() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'getDashboard', username: userData.username })
        });
        const result = await response.json();
        
        allJadwalGuru = result.jadwal || [];
        allMapelData = result.mapel || []; 

        const selectMapel = document.getElementById('select-mapel');
        selectMapel.innerHTML = '<option value="">-- Pilih Mapel --</option>';
        
        allMapelData.forEach(m => {
            if(m.sisa_total_semua_kelas > 0) {
                selectMapel.innerHTML += `<option value="${m.kode}">${m.nama_mapel}</option>`;
            }
        });

        document.getElementById('select-kelas').innerHTML = '<option value="">-- Pilih Kelas --</option>';
        updateSesiAvailability();

    } catch (error) {
        console.error("Gagal muat data guru", error);
    }
}

// LOGIKA DROPDOWN MAPEL -> KELAS
document.getElementById('select-mapel').addEventListener('change', (e) => {
    const kodeDipilih = e.target.value;
    const selectKelas = document.getElementById('select-kelas');
    
    if(!kodeDipilih) {
        selectKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
        updateSesiAvailability(); 
        return;
    }
    
    const mapelAktif = allMapelData.find(m => m.kode === kodeDipilih);
    
    selectKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    mapelAktif.detail_kelas.forEach(item => {
        if (item.sisa_jam > 0) {
            selectKelas.innerHTML += `<option value="${item.kelas}">${item.kelas} (Sisa: ${item.sisa_jam} Jam)</option>`;
        }
    });
    
    updateSesiAvailability();
});

// LOGIKA WARNA JAM TERISI/KOSONG
function updateSesiAvailability() {
    const kelas = document.getElementById('select-kelas').value;
    const hari = document.getElementById('select-hari').value;
    const cbContainer = document.getElementById('checkbox-sesi');
    
    cbContainer.innerHTML = '';
    
    for(let i = 1; i <= 8; i++) {
        let isDisabled = false;
        let labelStatus = "";
        let customClass = "checkbox-item";
        
        if (kelas && hari) {
            let bentrokKelas = allJadwalGuru.find(j => j.hari === hari && j.sesi == i && j.kelas === kelas);
            let bentrokGuru = allJadwalGuru.find(j => j.hari === hari && j.sesi == i && j.username_guru === userData.username);
            
            if (bentrokKelas) {
                isDisabled = true;
                labelStatus = ` (Penuh: ${bentrokKelas.kode_mapel})`;
                customClass += " disabled-penuh";
            } else if (bentrokGuru) {
                isDisabled = true;
                labelStatus = " (Jadwal Anda)";
                customClass += " disabled-anda";
            }
        }
        
        cbContainer.innerHTML += `
            <label class="${customClass}">
                <input type="checkbox" name="sesi" value="${i}" ${isDisabled ? 'disabled' : ''}> 
                Jam ke-${i}${labelStatus}
            </label>
        `;
    }
}

// SIMPAN JADWAL GURU
document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    
    const kode_mapel = document.getElementById('select-mapel').value;
    const kelas = document.getElementById('select-kelas').value;
    const hari = document.getElementById('select-hari').value;
    
    if(!kode_mapel || !kelas || !hari) {
        alert("Harap lengkapi Mapel, Kelas, dan Hari!"); return;
    }

    const sesiChecked = document.querySelectorAll('input[name="sesi"]:checked');
    const sesiArray = Array.from(sesiChecked).map(cb => cb.value);

    if(sesiArray.length === 0) {
        alert("Pilih minimal 1 jam sesi!"); return;
    }

    // Ambil nama mapel dari data yang tersimpan di memory
    const mapelAktif = allMapelData.find(m => m.kode === kode_mapel);
    const nama_mapel = mapelAktif ? mapelAktif.nama_mapel : "";

    const konfirmasi = confirm(`Kirim Jadwal:\nMapel: ${nama_mapel}\nKelas: ${kelas}\nHari: ${hari}\nJam Ke: ${sesiArray.join(', ')}\n\nYakin?`);
    if (!konfirmasi) return;

    btn.textContent = "Menyimpan..."; btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'simpanJadwal',
                dataBooking: {
                    username: userData.username,
                    nama_guru: userData.nama,
                    kode_mapel: kode_mapel,
                    nama_mapel: nama_mapel,
                    kelas: kelas,
                    hari: hari,
                    sesiArray: sesiArray
                }
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            alert("Berhasil disimpan!");
            document.getElementById('booking-form').reset();
            muatDataGuru(); 
        } else {
            alert(result.pesan);
        }
    } catch (error) {
        alert("Terjadi kesalahan sistem.");
    } finally {
        btn.textContent = "Kirim Jadwal"; btn.disabled = false;
    }
});

// ==========================================
// 3. DASHBOARD ADMIN
// ==========================================
// ==========================================
// FITUR GENERATE WARNA PASTEL OTOMATIS (Berdasarkan Teks Kode)
// ==========================================
function stringToColorPastel(str) {
    if(!str) return '#ffffff';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Konversi hash ke RGB
    let r = (hash & 0xFF0000) >> 16;
    let g = (hash & 0x00FF00) >> 8;
    let b = hash & 0x0000FF;
    
    // Campur dengan warna putih (255) agar warnanya pastel dan teks di dalamnya mudah dibaca
    r = Math.floor((r + 255) / 2);
    g = Math.floor((g + 255) / 2);
    b = Math.floor((b + 255) / 2);
    
    return `rgb(${r}, ${g}, ${b})`;
}

// ==========================================
// 3. DASHBOARD ADMIN
// ==========================================
async function tampilkanAdmin() {
    dashAdmin.classList.remove('hidden');
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'getAdminData' })
        });
        const result = await response.json();
        
        susunMatriksAdmin(result);
        susunRekapAdmin(result.summary); // Panggil fungsi susun rekap kanan
    } catch (error) {
        alert("Gagal muat data admin");
    }
}

function susunMatriksAdmin(data) {
    const headerRow = document.getElementById('matriks-header');
    const tbody = document.getElementById('matriks-body');
    
    headerRow.innerHTML = `<th>Hari</th><th>Jam Ke-</th>`;
    data.kelas.forEach(k => {
        headerRow.innerHTML += `<th>${k}</th>`;
    });

    tbody.innerHTML = '';
    const daftarHari = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    
    daftarHari.forEach(hari => {
        for(let sesi = 1; sesi <= 8; sesi++) {
            let row = document.createElement('tr');
            
            if (sesi === 1) {
                row.innerHTML += `<td rowspan="8" class="day-row">${hari}</td>`;
            }
            row.innerHTML += `<td>${sesi}</td>`;
            
            data.kelas.forEach(kelasStr => {
                let jadwalSel = data.jadwal.find(j => j.hari === hari && j.sesi == sesi && j.kelas === kelasStr);
                
                if (jadwalSel) {
                    // Generate warna unik berdasarkan KODE MAPEL
                    let bgColor = stringToColorPastel(jadwalSel.kode_mapel);
                    
                    // Hanya Tampilkan KODE MAPEL dengan warna background
                    row.innerHTML += `<td style="background-color: ${bgColor}; color: #111827; font-weight: bold; border: 1px solid #cbd5e1;">${jadwalSel.kode_mapel}</td>`;
                } else {
                    row.innerHTML += `<td>-</td>`;
                }
            });
            
            if (sesi === 8) {
                row.classList.add('day-end');
            }
            tbody.appendChild(row);
        }
    });
}

function susunRekapAdmin(summaryData) {
    const tbody = document.getElementById('rekap-body');
    tbody.innerHTML = '';
    
    // Susun data rekap ke dalam tabel sebelah kanan
    summaryData.forEach(item => {
        let bgColor = stringToColorPastel(item.kode);
        tbody.innerHTML += `
            <tr>
                <td style="background-color: ${bgColor}; font-weight: bold; text-align: center; border: 1px solid #cbd5e1;">${item.kode}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px;">${item.mapel}</td>
                <td style="border: 1px solid #cbd5e1; padding: 4px;">${item.nama_guru}</td>
                <td style="text-align: center; border: 1px solid #cbd5e1;">${item.jp}</td>
                <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${item.jumlah_jp}</td>
            </tr>
        `;
    });
}

// FITUR AUTO-GENERATE ADMIN
const btnAuto = document.getElementById('btn-auto-generate');
const loadingContainer = document.getElementById('loading-container');
const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');

// Elemen Laporan Baru
const btnLaporan = document.getElementById('btn-laporan-gagal');
const wadahLaporan = document.getElementById('laporan-gagal-container');
const listLaporan = document.getElementById('list-laporan-gagal');

if(btnAuto) {
    btnAuto.addEventListener('click', async () => {
        const konfirmasi = confirm("Yakin ingin Auto-Generate jadwal?\n\nSistem akan otomatis mencarikan slot kosong untuk semua sisa jam guru yang belum terisi.");
        if (!konfirmasi) return;

        btnAuto.textContent = "Menyusun... Harap Tunggu"; 
        btnAuto.disabled = true;

        // Reset UI Laporan
        btnLaporan.classList.add('hidden');
        wadahLaporan.classList.add('hidden');
        listLaporan.innerHTML = '';

        loadingContainer.classList.remove('hidden');
        let progress = 0;
        loadingBar.style.width = '0%';
        loadingText.textContent = '0%';

        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.floor(Math.random() * 8) + 1; 
                if (progress > 90) progress = 90;
                loadingBar.style.width = progress + '%';
                loadingText.textContent = progress + '%';
            }
        }, 400); 

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'autoGenerate' })
            });
            const result = await response.json();
            
            clearInterval(progressInterval);
            loadingBar.style.width = '100%';
            loadingText.textContent = '100%';
            loadingText.style.color = '#10b981'; 
            loadingBar.style.backgroundColor = '#10b981'; 
            
            setTimeout(() => {
                let pesanAlert = result.pesan;
                
                // Jika ada laporan gagal, tampilkan tombolnya dan susun datanya
                if (result.laporanGagal && result.laporanGagal.length > 0) {
                    pesanAlert += "\n\n⚠️ Terdapat jam yang gagal masuk. Silakan cek menu Laporan.";
                    
                    btnLaporan.classList.remove('hidden');
                    
                    result.laporanGagal.forEach(item => {
                        let li = document.createElement('li');
                        li.textContent = item;
                        listLaporan.appendChild(li);
                    });
                }
                
                alert(pesanAlert);
                tampilkanAdmin(); 
                
                loadingContainer.classList.add('hidden');
                loadingText.style.color = '#8b5cf6';
                loadingBar.style.backgroundColor = '#8b5cf6';
            }, 500);

        } catch (error) {
            clearInterval(progressInterval);
            alert("Gagal melakukan Auto-Generate.");
            loadingContainer.classList.add('hidden');
        } finally {
            btnAuto.textContent = "⚡ Auto-Generate Jadwal"; 
            btnAuto.disabled = false;
        }
    });

    // Fitur Buka/Tutup Kotak Laporan saat tombol kuning diklik
    btnLaporan.addEventListener('click', () => {
        wadahLaporan.classList.toggle('hidden');
    });
}

// DOWNLOAD EXCEL ADMIN
const btnDownload = document.getElementById('btn-download');
if(btnDownload) {
    btnDownload.addEventListener('click', () => {
        const table = document.getElementById("tabel-matriks");
        const excelTemplate = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta charset="UTF-8">
            <style>
              table { border-collapse: collapse; }
              th { background-color: #16a34a; color: white; border: 1px solid #94a3b8; padding: 10px; font-weight: bold; }
              td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
              td.day-row { background-color: #f1f5f9; font-weight: bold; }
              td.filled { background-color: #dcfce7; color: #166534; font-weight: bold; }
            </style>
          </head>
          <body>${table.outerHTML}</body>
          </html>`;

        const blob = new Blob([excelTemplate], { type: "application/vnd.ms-excel;charset=utf-8;" });
        const downloadLink = document.createElement("a");
        downloadLink.download = "Matriks_Jadwal_Sekolah.xls";
        downloadLink.href = window.URL.createObjectURL(blob);
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    });
}

// ==========================================
// 4. LOGOUT
// ==========================================
document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', () => {
        userData = null;
        allJadwalGuru = [];
        allMapelData = [];
        document.getElementById('login-form').reset();
        dashGuru.classList.add('hidden');
        dashAdmin.classList.add('hidden');
        loginSection.classList.remove('hidden');
    });
});
