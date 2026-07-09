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
            let bentrokKelas = allJadwalGuru.find(j => j.hari.trim().toLowerCase() === hari.trim().toLowerCase() && j.sesi == i && j.kelas.trim().toLowerCase() === kelas.trim().toLowerCase());
            let bentrokGuru = allJadwalGuru.find(j => j.hari.trim().toLowerCase() === hari.trim().toLowerCase() && j.sesi == i && j.username_guru === userData.username);
            
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
// FITUR GENERATE WARNA PASTEL SUPER KONTRAS (HSL GOLDEN RATIO WHEEL)
// ==========================================
function stringToColorPastel(str) {
    if(!str) return '#ffffff';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Lompat spektrum warna sejauh 137.5 derajat (Sudut Emas / Golden Ratio) setiap pergantian hash teks.
    // Menghilangkan masalah warna kembar/mirip antar mata pelajaran yang berdekatan.
    let hue = Math.abs(hash * 137.5) % 360;
    
    // Saturation 80% (Warna hidup dan tegas, tidak pudar)
    // Lightness 78% (Cukup terang sebagai background agar teks hitam di depannya sangat jelas terlihat)
    return `hsl(${hue}, 80%, 78%)`;
}

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
        susunRekapAdmin(result.summary); 
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
                // Perbaikan: gunakan lowercase dan trim untuk akurasi pencarian data
                let jadwalSel = data.jadwal.find(j => 
                    j.hari.trim().toLowerCase() === hari.trim().toLowerCase() && 
                    j.sesi == sesi && 
                    j.kelas.trim().toLowerCase() === kelasStr.trim().toLowerCase()
                );
                
                if (jadwalSel) {
                    let kodeLower = jadwalSel.kode_mapel.toLowerCase();
                    // Perbaikan: Deteksi Pembiasaan jika username nya adalah "-" atau teks mapel bernilai upacara/yasinan/tahlilan/panjang
                    if (jadwalSel.username_guru === "-" || kodeLower === 'upacara' || kodeLower === 'yasinan' || kodeLower === 'tahlilan' || jadwalSel.kode_mapel.length > 5) {
                        // WARNA PEMBIASAAN (Slate grey tua)
                        row.innerHTML += `<td style="background-color: #475569; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; font-size: 11px; text-align: center;">${jadwalSel.kode_mapel.toUpperCase()}</td>`;
                    } else {
                        // WARNA KODE MAPEL GURU
                        let bgColor = stringToColorPastel(jadwalSel.kode_mapel);
                        row.innerHTML += `<td style="background-color: ${bgColor}; color: #111827; font-weight: bold; border: 1px solid #cbd5e1; text-align: center;">${jadwalSel.kode_mapel}</td>`;
                    }
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
    
    summaryData.forEach(guru => {
        let totalMapel = guru.daftar_mapel.length;
        
        guru.daftar_mapel.forEach((mapelObj, index) => {
            let row = document.createElement('tr');
            let bgColor = stringToColorPastel(mapelObj.kode); 
            
            let isiMasingMasingKolom = '';
            
            if (index === 0) {
                isiMasingMasingKolom += `
                    <td rowspan="${totalMapel}" style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; vertical-align: middle; background-color: #ffffff;">
                        ${guru.nama_guru}
                    </td>
                `;
            }
            
            isiMasingMasingKolom += `
                <td style="background-color: ${bgColor}; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; padding: 6px;">
                    ${mapelObj.kode}
                </td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">
                    ${mapelObj.nama_mapel}
                </td>
                <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">
                    ${mapelObj.jp_mapel}
                </td>
            `;
            
            if (index === 0) {
                isiMasingMasingKolom += `
                    <td rowspan="${totalMapel}" style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px; vertical-align: middle; background-color: #f8fafc; color: #1e3a8a;">
                        ${guru.jumlah_jp}
                    </td>
                `;
            }
            
            row.innerHTML = isiMasingMasingKolom;
            tbody.appendChild(row);
        });
    });
}

const btnAuto = document.getElementById('btn-auto-generate');
const loadingContainer = document.getElementById('loading-container');
const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');

const btnLaporan = document.getElementById('btn-laporan-gagal');
const wadahLaporan = document.getElementById('laporan-gagal-container');
const listLaporan = document.getElementById('list-laporan-gagal');

if(btnAuto) {
    btnAuto.addEventListener('click', async () => {
        const konfirmasi = confirm("Yakin ingin Auto-Generate jadwal?\n\nSistem akan mempertahankan jadwal manual guru yang sudah ada dan mencarikan slot kosong untuk sisa jam pelajaran lainnya.");
        if (!konfirmasi) return;

        btnAuto.textContent = "Menyusun... Harap Tunggu"; 
        btnAuto.disabled = true;

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

    btnLaporan.addEventListener('click', () => {
        wadahLaporan.classList.toggle('hidden');
    });
}

const btnSuperAuto = document.getElementById('btn-super-auto');

if (btnSuperAuto) {
    btnSuperAuto.addEventListener('click', async () => {
        const konfirmasi = confirm("YAKIN INGIN SUPER AUTO-GENERATE?\n\nSistem akan mengunci jadwal manual yang sudah ada, lalu mengocok ribuan kombinasi sisa jam pelajaran selama maksimal 5,5 Menit untuk mencari hasil 100% Sempurna.\n\nHarap sabar menunggu!");
        if (!konfirmasi) return;

        btnSuperAuto.textContent = "🚀 SEDANG MENCARI 100%... (Bisa 5 Menit)"; 
        btnSuperAuto.disabled = true;
        btnAuto.disabled = true; 

        btnLaporan.classList.add('hidden');
        wadahLaporan.classList.add('hidden');
        listLaporan.innerHTML = '';
        loadingContainer.classList.remove('hidden');
        
        let progress = 0;
        loadingBar.style.width = '0%';
        loadingText.textContent = 'Menganalisis Jutaan Pola... 0%';

        const progressInterval = setInterval(() => {
            if (progress < 95) {
                progress += Math.random() * 2; 
                loadingBar.style.width = progress + '%';
                loadingText.textContent = 'Menganalisis Jutaan Pola... ' + Math.floor(progress) + '%';
            }
        }, 1000); 

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'superAutoGenerate' })
            });
            const result = await response.json();
            
            clearInterval(progressInterval);
            loadingBar.style.width = '100%';
            loadingText.textContent = '100% SELESAI!';
            loadingText.style.color = '#10b981'; 
            loadingBar.style.backgroundColor = '#10b981'; 
            
            setTimeout(() => {
                let pesanAlert = result.pesan;
                if (result.laporanGagal && result.laporanGagal.length > 0) {
                    pesanAlert += "\n\n⚠️ Waktu habis (5.5 Menit). Sistem memberikan HASIL TERBAIK tanpa mengubah jadwal manual guru, namun masih ada sisa jam gagal karena bentrok struktural.";
                    btnLaporan.classList.remove('hidden');
                    result.laporanGagal.forEach(item => {
                        let li = document.createElement('li');
                        li.textContent = item;
                        listLaporan.appendChild(li);
                    });
                } else {
                    pesanAlert += "\n\n🎉 SUKSES BESAR! Sisa jam pelajaran berhasil terplot 100% Sempurna!";
                }
                
                alert(pesanAlert);
                tampilkanAdmin(); 
                
                loadingContainer.classList.add('hidden');
            }, 500);

        } catch (error) {
            clearInterval(progressInterval);
            alert("Gagal koneksi ke server.");
            loadingContainer.classList.add('hidden');
        } finally {
            btnSuperAuto.textContent = "🚀 Super Auto-Generate (Target 100%)"; 
            btnSuperAuto.disabled = false;
            btnAuto.disabled = false;
        }
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
