const net = require('net');

const PORTS = [3306, 3307, 3308, 3309];

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(1500);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve({ port, open: true });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ port, open: false, reason: 'timeout' });
    });
    
    socket.on('error', (err) => {
      socket.destroy();
      resolve({ port, open: false, reason: err.code });
    });
    
    socket.connect(port, '127.0.0.1');
  });
}

async function runProbe() {
  console.log('=========================================');
  console.log('Memulai Pemindaian Port Database MySQL...');
  console.log('Memeriksa port: ' + PORTS.join(', '));
  console.log('=========================================');

  const results = [];
  for (const port of PORTS) {
    const res = await checkPort(port);
    results.push(res);
  }

  const openPorts = results.filter(r => r.open);
  
  if (openPorts.length > 0) {
    console.log('\n✔ HASIL PEMINDAIAN:');
    openPorts.forEach(op => {
      console.log(`- Port ${op.port} TERBUKA (Layanan aktif di sini!)`);
    });
    console.log('\nTIPS PERBAIKAN:');
    console.log(`Buka file backend/.env, lalu ubah nilai DB_PORT sesuai port di atas, misal: DB_PORT=${openPorts[0].port}`);
  } else {
    console.log('\n❌ HASIL PEMINDAIAN:');
    console.log('Semua port database (3306, 3307, 3308, 3309) tertutup.');
    console.log('\nTIPS PERBAIKAN:');
    console.log('1. MySQL server Anda belum dinyalakan sama sekali.');
    console.log('2. Buka XAMPP Control Panel, klik tombol "Start" di samping MySQL agar berwarna hijau.');
  }
  console.log('=========================================');
}

runProbe();
