// check-password.js
import bcrypt from 'bcrypt';

const plainPassword = 'Admin123';
const storedHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZagujdbpOXRf4RnG8dC4B1Pb6F3H6'; // replace with your stored hash

bcrypt.compare(plainPassword, storedHash, function(err, result) {
  if (err) {
    console.error('Error comparing passwords:', err);
    process.exit(1);
  }

  if (result) {
    console.log('✅ Password is correct');
  } else {
    console.log('❌ Password is incorrect');
  }
});

