import { googleService } from '../../services/googleService.js';
import { react } from '../../utils/react.js';

export default async (sock, m, args) => {
    const subCommand = args[0]?.toLowerCase();
    const remoteJid = m.key.remoteJid;

    try {
        // --- CASE: DELETE TASK ---
        if (subCommand === 'del' || subCommand === 'hapus') {
            const index = parseInt(args[1]) - 1;
            if (isNaN(index)) return sock.sendMessage(remoteJid, { text: '❌ Masukkan nomor urut tugas yang ingin dihapus. Contoh: *!todo del 1*' });

            const tasks = await googleService.listTasks();
            if (!tasks || tasks.length === 0) return sock.sendMessage(remoteJid, { text: '❌ Tidak ada tugas yang bisa dihapus.' });
            
            if (index < 0 || index >= tasks.length) return sock.sendMessage(remoteJid, { text: `❌ Nomor tidak valid. Masukkan 1 sampai ${tasks.length}.` });

            const targetTask = tasks[index];
            await react(sock, m, '🗑️');
            await googleService.deleteTask(targetTask.id);
            await react(sock, m, '✅');
            return sock.sendMessage(remoteJid, { text: `✅ Berhasil menghapus tugas: *"${targetTask.title}"*` });
        }

        // --- CASE: LIST TASKS ---
        if (!subCommand || subCommand === 'list') {
            await react(sock, m, '📋');
            const tasks = await googleService.listTasks();
            
            if (!tasks || tasks.length === 0) {
                return sock.sendMessage(remoteJid, { text: '📋 *GOOGLE TASKS*\n\nTidak ada tugas aktif saat ini.' });
            }

            let taskList = `📋 *DAFTAR TUGAS ANDA*\n\n`;
            tasks.forEach((t, i) => {
                taskList += `${i + 1}. ${t.title}\n`;
            });
            taskList += `\n💡 _Gunakan *!todo del <nomor>* untuk menghapus._`;

            return sock.sendMessage(remoteJid, { text: taskList });
        }

        // --- CASE: ADD TASK (DEFAULT) ---
        const text = args.join(' ');
        await react(sock, m, '📝');
        await googleService.addTask(text);
        await react(sock, m, '✅');
        return sock.sendMessage(remoteJid, { text: `✅ Berhasil menambahkan ke Google Tasks:\n*"${text}"*` });

    } catch (err) {
        return sock.sendMessage(remoteJid, { text: `❌ Gagal: ${err.message}` });
    }
};
