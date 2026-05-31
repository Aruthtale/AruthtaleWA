import { exec } from 'child_process';
import { log } from '../utils/logger.js';
import { routeCommand } from './commandRouter.js';
import { settings } from '../config/settings.js';
import { db, firebaseAdmin as admin } from './firebaseService.js';

class FirebaseBridge {
  constructor() {
    this.db = db;
    this.client = null;
  }

  /**
   * Upload system metrics to Firestore
   * Called by resourceWatcher.js
   */
  async uploadSystemMetrics(metricsData) {
    try {
      await this.db.collection('system_stats').doc('Cloverz').set({
        ...metricsData,
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
        device_name: 'Arverz-Laptop'
      }, { merge: true });
    } catch (error) {
      log.error("Gagal mengunggah metrik ke Firebase:", error.message);
    }
  }

  /**
   * Listen for remote commands from Flutter app via Firestore
   */
  listenToFlutterCommands(sock) {
    this.client = sock;
    log.system("⚡ Arverz Bridge: Mendengarkan perintah dari Firebase...");

    this.db.collection('commands')
      .where('target_device', 'in', ['Cloverz', 'Arverz'])
      .where('status', '==', 'pending')
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const doc = change.doc;
            const data = doc.data();
            
            log.info(`📥 Menerima perintah jarak jauh: [${data.action}] ${data.payload || ''}`);

            try {
              if (data.action === 'SHELL_EXEC') {
                exec(data.payload, (err, stdout, stderr) => {
                  doc.ref.update({
                    status: 'completed',
                    result: err ? stderr : stdout,
                    completed_at: admin.firestore.FieldValue.serverTimestamp()
                  });
                });
              } else if (data.action === 'BOT_COMMAND') {
                // Mock message object for commandRouter
                const m = {
                  key: {
                    remoteJid: `${settings.ownerNumber}@s.whatsapp.net`,
                    fromMe: true,
                    id: `FIREBASE_${doc.id}`
                  },
                  message: { conversation: data.payload },
                  pushName: 'Firebase Remote',
                  broadcast: false
                };

                await routeCommand(this.client, m, data.payload);

                await doc.ref.update({
                  status: 'completed',
                  result: `Perintah ${data.payload} berhasil diteruskan ke Core System.`,
                  completed_at: admin.firestore.FieldValue.serverTimestamp()
                });
              } else {
                await doc.ref.update({
                  status: 'unsupported',
                  result: `Action ${data.action} tidak dikenali.`,
                  completed_at: admin.firestore.FieldValue.serverTimestamp()
                });
              }
            } catch (err) {
                log.error(`Error executing Firebase command:`, err.message);
                doc.ref.update({
                    status: 'failed',
                    result: err.message,
                    completed_at: admin.firestore.FieldValue.serverTimestamp()
                });
            }
          }
        });
      });
  }
}

export const firebaseBridge = new FirebaseBridge();
