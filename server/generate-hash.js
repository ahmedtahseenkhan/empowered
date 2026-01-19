const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'admin123';
const hash = bcrypt.hashSync(password, 10);

console.log('\n=================================');
console.log('Password:', password);
console.log('Hash:', hash);
console.log('=================================\n');
console.log('Copy the hash above and paste it into the password_hash field in Prisma Studio');
