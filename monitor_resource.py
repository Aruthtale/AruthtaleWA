#!/usr/bin/env python3
import psutil
import subprocess
import os
import sys

# Konfigurasi Batas
THRESHOLD_RAM_MB = 1500
THRESHOLD_CPU_PERCENT = 80
PROCESS_NAME = "node index.js"

def get_system_stats():
    """Mengambil informasi penggunaan RAM dan CPU sistem."""
    ram = psutil.virtual_memory()
    ram_used_mb = ram.used / (1024 * 1024)
    cpu_percent = psutil.cpu_percent(interval=1)
    return ram_used_mb, cpu_percent

def is_process_running(name):
    """Mengecek apakah proses dengan nama tertentu sedang berjalan."""
    try:
        # Menggunakan pgrep untuk mencari process secara efisien
        output = subprocess.check_output(["pgrep", "-f", name])
        return len(output) > 0
    except subprocess.CalledProcessError:
        return False

def kill_process(name):
    """Mematikan proses menggunakan pkill."""
    try:
        print(f"[*] Mencoba mematikan proses: {name}")
        subprocess.run(["pkill", "-f", name], check=True)
        print(f"[SUCCESS] Proses '{name}' berhasil dimatikan.")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Gagal mematikan proses: {e}")
        return False
    except Exception as e:
        print(f"[ERROR] Terjadi kesalahan saat mematikan proses: {e}")
        return False

def main():
    try:
        # 1. Ambil statistik saat ini
        ram_used, cpu_usage = get_system_stats()
        
        print(f"--- Monitoring Resource ---")
        print(f"RAM Terpakai: {ram_used:.2f} MB / Batas: {THRESHOLD_RAM_MB} MB")
        print(f"CPU Usage  : {cpu_usage:.2f}% / Batas: {THRESHOLD_CPU_PERCENT}%")
        
        # 2. Cek apakah melebihi batas
        over_limit = False
        reason = ""
        
        if ram_used > THRESHOLD_RAM_MB:
            over_limit = True
            reason = f"RAM melebihi batas ({ram_used:.2f} MB > {THRESHOLD_RAM_MB} MB)"
        elif cpu_usage > THRESHOLD_CPU_PERCENT:
            over_limit = True
            reason = f"CPU melebihi batas ({cpu_usage:.2f}% > {THRESHOLD_CPU_PERCENT}%)"
            
        if over_limit:
            print(f"[!] {reason}")
            
            # 3. Cek apakah process target ada
            if is_process_running(PROCESS_NAME):
                kill_process(PROCESS_NAME)
            else:
                print(f"[-] Informasi: Proses '{PROCESS_NAME}' tidak ditemukan / tidak sedang berjalan.")
        else:
            print("[+] Resource dalam batas aman. Tidak ada tindakan yang diambil.")
            
    except Exception as e:
        print(f"[FATAL ERROR] Terjadi kesalahan pada script monitor: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
    print("--- Selesai ---")
