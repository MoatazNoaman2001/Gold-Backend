import bcrypt from 'bcrypt';
bcrypt.hash('Admin123', 10, function(err, hash) {
  console.log(hash);
});
